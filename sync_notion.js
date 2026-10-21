const fs = require('fs');
const path = require('path');

const PRODUCTS_HUB_ID = '2eee6ec6-d6f2-8062-92b5-db6fcd28ad2e';
const CROPS_HUB_ID = '327e6ec6-d6f2-811b-b699-ecccef4ea891';

const HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
};

async function fetchPage(pageId) {
    const res = await fetch('https://www.notion.so/api/v3/loadPageChunk', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            pageId: pageId,
            chunkNumber: 0,
            limit: 300,
            verticalColumns: false
        })
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch ${pageId}: HTTP ${res.status}`);
    }
    return await res.json();
}

function parseNotionPage(recordMap, pageId) {
    const root = recordMap.block[pageId]?.value?.value || recordMap.block[pageId]?.value;
    const pageTitle = root?.properties?.title ? root.properties.title.map(x => x[0]).join('') : '';
    const sections = [];
    let currentSection = { title: 'General', tables: [], text: [] };

    const content = root?.content || [];
    for (const cid of content) {
        const b = recordMap.block[cid]?.value?.value || recordMap.block[cid]?.value;
        if (!b) continue;

        if (['header', 'sub_header', 'sub_sub_header'].includes(b.type)) {
            if (currentSection.tables.length > 0 || currentSection.text.length > 0) {
                sections.push(currentSection);
            }
            const title = b.properties?.title ? b.properties.title.map(x => x[0]).join('') : '';
            currentSection = { title, tables: [], text: [] };
        } else if (b.type === 'text') {
            const txt = b.properties?.title ? b.properties.title.map(x => x[0]).join('') : '';
            if (txt) currentSection.text.push(txt);
        } else if (b.type === 'table') {
            const colOrder = b.format?.table_block_column_order || [];
            const rowIds = b.content || [];
            if (rowIds.length === 0) continue;

            const headerRowB = recordMap.block[rowIds[0]]?.value?.value || recordMap.block[rowIds[0]]?.value;
            const headers = colOrder.map(cid => {
                return headerRowB?.properties?.[cid] ? headerRowB.properties[cid].map(x => x[0]).join('').trim() : cid;
            });

            const rows = [];
            for (let i = 1; i < rowIds.length; i++) {
                const rowB = recordMap.block[rowIds[i]]?.value?.value || recordMap.block[rowIds[i]]?.value;
                if (!rowB) continue;
                const rowObj = {};
                colOrder.forEach((cid, idx) => {
                    const colName = headers[idx] || cid;
                    const val = rowB.properties?.[cid] ? rowB.properties[cid].map(x => x[0]).join('').trim() : '';
                    rowObj[colName] = val;
                });
                rows.push(rowObj);
            }
            currentSection.tables.push({ headers, rows });
        }
    }
    if (currentSection.tables.length > 0 || currentSection.text.length > 0) {
        sections.push(currentSection);
    }
    return { id: pageId, title: pageTitle, sections };
}

function processProductData(parsed) {
    const p = {
        id: parsed.id,
        rawTitle: parsed.title,
        name: parsed.title.replace(/_/g, ' ').trim(),
        attributes: {},
        topPicks: [],
        usage: [],
        labelInfo: []
    };

    for (const sec of parsed.sections) {
        const titleLower = sec.title.toLowerCase();
        for (const table of sec.tables) {
            if (table.headers.includes('Attribute') && table.headers.includes('Details')) {
                for (const r of table.rows) {
                    if (r['Attribute'] && r['Details']) {
                        p.attributes[r['Attribute'].trim()] = r['Details'].trim();
                    }
                }
            } else if (titleLower.includes('top pick') || (table.headers.includes('Target') && table.headers.includes('Crop'))) {
                p.topPicks.push(...table.rows);
            } else if (titleLower.includes('usage') || table.headers.some(h => h.includes('Dosage') || h.includes('Weeds/Pests'))) {
                p.usage.push(...table.rows);
            } else if (titleLower.includes('label') || table.headers.some(h => h.includes('PHI') && h.includes('Dose'))) {
                p.labelInfo.push(...table.rows);
            }
        }
    }

    if (p.attributes['Product Name']) {
        p.name = p.attributes['Product Name'];
    }
    return p;
}

function processCropData(parsed) {
    const c = {
        id: parsed.id,
        crop: parsed.title.replace(/_/g, ' ').trim(),
        growthPlan: [],
        insecticides: [],
        fungicides: [],
        herbicides: [],
        seedAndNutrition: []
    };

    for (const sec of parsed.sections) {
        const titleLower = sec.title.toLowerCase();
        for (const table of sec.tables) {
            if (titleLower.includes('growth') || titleLower.includes('nutrition plan')) {
                c.growthPlan.push(...table.rows);
            } else if (titleLower.includes('insecticide')) {
                c.insecticides.push(...table.rows);
            } else if (titleLower.includes('fungicide')) {
                c.fungicides.push(...table.rows);
            } else if (titleLower.includes('herbicide')) {
                c.herbicides.push(...table.rows);
            } else if (titleLower.includes('seed') || titleLower.includes('nutrition reference')) {
                c.seedAndNutrition.push(...table.rows);
            }
        }
    }
    return c;
}

async function runPool(items, workerFn, concurrency = 4) {
    const results = [];
    let idx = 0;

    async function worker() {
        while (idx < items.length) {
            const currentIdx = idx++;
            const item = items[currentIdx];
            try {
                const res = await workerFn(item, currentIdx);
                results.push(res);
            } catch (err) {
                console.error(`❌ Error fetching ${item.title} (${item.id}):`, err.message);
            }
            await new Promise(r => setTimeout(r, 100));
        }
    }

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
    return results;
}

async function main() {
    console.log('🌾 Starting Full Syngenta Pakistan Notion Scrape...');
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // 1. Fetch Hubs
    console.log('📦 Loading Products and Crops hubs...');
    const [productsHub, cropsHub] = await Promise.all([
        fetchPage(PRODUCTS_HUB_ID),
        fetchPage(CROPS_HUB_ID)
    ]);

    const getChildren = (data, hubId) => {
        const root = data.recordMap.block[hubId]?.value?.value || data.recordMap.block[hubId]?.value;
        const items = [];
        for (const cid of (root.content || [])) {
            const b = data.recordMap.block[cid]?.value?.value || data.recordMap.block[cid]?.value;
            const title = b?.properties?.title ? b.properties.title.map(x => x[0]).join('') : cid;
            items.push({ id: cid, title });
        }
        return items;
    };

    const productItems = getChildren(productsHub, PRODUCTS_HUB_ID);
    const cropItems = getChildren(cropsHub, CROPS_HUB_ID);
    console.log(`📋 Found ${productItems.length} Products and ${cropItems.length} Crops!`);

    // 2. Fetch all products
    console.log('\n🧴 Ingesting all Syngenta Products...');
    const productsData = await runPool(productItems, async (item, i) => {
        const chunk = await fetchPage(item.id);
        const parsed = parseNotionPage(chunk.recordMap, item.id);
        const processed = processProductData(parsed);
        process.stdout.write(`\r  [${i + 1}/${productItems.length}] ${processed.name.padEnd(30).slice(0, 30)}`);
        return processed;
    }, 5);
    console.log(`\n✅ Completed ${productsData.length} Products!`);

    // 3. Fetch all crops
    console.log('\n🌱 Ingesting all Crop Protection & Nutrition Guides...');
    const cropsData = await runPool(cropItems, async (item, i) => {
        const chunk = await fetchPage(item.id);
        const parsed = parseNotionPage(chunk.recordMap, item.id);
        const processed = processCropData(parsed);
        process.stdout.write(`\r  [${i + 1}/${cropItems.length}] ${processed.crop.padEnd(30).slice(0, 30)}`);
        return processed;
    }, 5);
    console.log(`\n✅ Completed ${cropsData.length} Crops!`);

    // 4. Save Knowledge Base
    const outProductsPath = path.join(dataDir, 'syngenta_products.json');
    const outCropsPath = path.join(dataDir, 'syngenta_crops.json');
    const outKbPath = path.join(dataDir, 'syngenta_knowledge_base.json');

    fs.writeFileSync(outProductsPath, JSON.stringify(productsData, null, 2), 'utf-8');
    fs.writeFileSync(outCropsPath, JSON.stringify(cropsData, null, 2), 'utf-8');

    const fullKB = {
        updatedAt: new Date().toISOString(),
        totalProducts: productsData.length,
        totalCrops: cropsData.length,
        products: productsData,
        crops: cropsData
    };
    fs.writeFileSync(outKbPath, JSON.stringify(fullKB, null, 2), 'utf-8');

    console.log('\n======================================================');
    console.log(`🎉 Syngenta Knowledge Base successfully compiled!`);
    console.log(`📁 Saved to: ${outKbPath}`);
    console.log(`📊 Total Products: ${productsData.length}`);
    console.log(`🌾 Total Crops: ${cropsData.length}`);
    console.log('======================================================\n');
}

main().catch(err => {
    console.error('Fatal sync error:', err);
});
