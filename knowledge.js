const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(__dirname, 'data', 'syngenta_products.json');
const CUSTOM_RAG_FILE = path.join(DATA_DIR, 'custom_rag.json');
const COMPANIES_FILE = path.join(DATA_DIR, 'companies.json');

try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {}

let productsList = [];
try {
    if (fs.existsSync(PRODUCTS_FILE)) {
        productsList = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
    }
} catch (e) {
    console.error('Error loading products JSON:', e.message);
}

// Function Storage: Load dynamic custom RAG data
function loadCustomRag() {
    try {
        if (fs.existsSync(CUSTOM_RAG_FILE)) {
            return JSON.parse(fs.readFileSync(CUSTOM_RAG_FILE, 'utf-8'));
        }
    } catch (e) {}
    return [];
}

// Function Storage: Save dynamic custom RAG data
function saveCustomRag(entries) {
    try {
        fs.writeFileSync(CUSTOM_RAG_FILE, JSON.stringify(entries, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error saving custom RAG:', e.message);
        return false;
    }
}

// Function Storage: Load companies knowledge
function loadCompaniesKnowledge() {
    try {
        if (fs.existsSync(COMPANIES_FILE)) {
            return JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf-8'));
        }
        const seed = path.join(__dirname, 'data', 'companies.json');
        if (fs.existsSync(seed)) {
            return JSON.parse(fs.readFileSync(seed, 'utf-8'));
        }
    } catch (e) {}
    return [];
}

// Built-in Pakistani Agricultural Knowledge Base (Syngenta + Naya Savera + NARC / Agri Dept Pakistan)
const MAJOR_CROPS_KB = {
    cotton: {
        names: ['کپاس', 'cotton', 'kapas', 'kappas', 'phutti'],
        pests: [
            {
                name: 'سفید مکھی (Whitefly)',
                solutions: [
                    'پولو (Polo 500 SC) - ڈوز: 200 سے 250 ملی لیٹر فی ایکڑ (Top Pick)',
                    'الیسٹل نیو (Elestal Neo) - ڈوز: 100 گرام + 200 ملی لیٹر ایڈجوینٹ فی ایکڑ',
                    'پائیری پروکسی فن (Pyriproxyfin) - ڈوز: 500 ملی لیٹر فی ایکڑ (انڈوں اور بچوں کے لیے)',
                    'سیموڈس (Simodis 100 DC) - ڈوز: 150 ملی لیٹر فی ایکڑ'
                ],
                notes: 'سفید مکھی کا سپرے ہمیشہ پودوں کے نچلے پتوں تک پہنچائیں، اور پانی کم از کم 100 سے 120 لیٹر فی ایکڑ استعمال کریں۔'
            },
            {
                name: 'سبز تیلا اور تھرپس (Jassid & Thrips)',
                solutions: [
                    'سیموڈس (Simodis 100 DC) - ڈوز: 120 تا 150 ملی لیٹر فی ایکڑ (Top Pick)',
                    'ایکٹارا (Actara 25 WG) - ڈوز: 24 گرام فی ایکڑ (80 تا 100 لیٹر پانی)',
                    'کراٹے (Karate 2.5 EC) - ڈوز: 330 تا 400 ملی لیٹر فی ایکڑ'
                ]
            },
            {
                name: 'گلابی اور چتکبری سنڈی (Pink & Spotted Bollworm)',
                solutions: [
                    'ایمپلیگو (Ampligo 150 ZC) - ڈوز: 100 ملی لیٹر فی ایکڑ',
                    'پروکلیم (Proclaim 019 EC) - ڈوز: 200 تا 250 ملی لیٹر فی ایکڑ',
                    'میچ (Match 050 EC) - ڈوز: 200 ملی لیٹر فی ایکڑ'
                ],
                notes: 'سنڈیوں کے لیے گڈھیوں اور ڈوڈوں کا معائنہ لازمی کریں۔ جوں ہی معاشی نقصان کی حد (ETL) پہنچے، فوری سپرے کریں۔'
            }
        ],
        nutrition: 'شروعات میں ڈی اے پی یا این پی کے، بوائی کے 35 دن بعد یوریا کی اقساط، اور پھول و ٹینڈے بنتے وقت نیا پوٹاش (3 لیٹر فی ایکڑ فلڈ) اور ازابیون (Isabion 500 ml فی ایکڑ سپرے) پھولوں اور ٹینڈوں کے کیرا روکنے کے لیے۔'
    },
    wheat: {
        names: ['گندم', 'wheat', 'gandum', 'kanak', 'gandham'],
        sowing_and_temperature: {
            title: 'گندم کی بوائی اور درجہ حرارت کی سائنسی رہنمائی',
            optimal_temp: 'گندم کے بہترین اگاؤ اور شگوفہ سازی کے لیے مثالی درجہ حرارت 20 سے 25 ڈگری سینٹی گریڈ ہے۔',
            high_temp_risks: '30 سے 35 ڈگری سینٹی گریڈ یا زائد گرم درجہ حرارت میں گندم کی بوائی کے شدید نقصانات: 1) بیج کا اگاؤ (Germination) بری طرح متاثر ہوتا ہے اور گرم زمین میں بیج سڑ جاتا ہے۔ 2) گندم ٹھنڈے موسم کی فصل ہے؛ گرمی کے دباؤ میں پودے شگوفے (Tillers) نہیں بناتے اور پودا وقت سے پہلے نالی (Early heading / piping) پر آ جاتا ہے۔ 3) وقت سے پہلے سٹا نکلنے کی وجہ سے سٹے چھوٹے اور دانے پچکے ہوئے بنتے ہیں، جس سے فی ایکڑ پیداوار 30 سے 40 فیصد تک گر جاتی ہے۔',
            recommendation: 'پنجاب، سندھ اور خیبر پختونخوا کے تمام کاشتکار 10 سے 15 نومبر تک موسم کے ٹھنڈا ہونے کا لازمی انتظار کریں۔ یکم نومبر سے 20 نومبر گندم کی کاشت کا بہترین اور سنہری وقت ہے جب درجہ حرارت معتدل ہو جاتا ہے۔'
        },
        weeds: [
            'چوڑی پتے کی جڑی بوٹیاں (باتھو، لیہلی، شاہترہ): بروموکسینل + ایم سی پی اے (Bromoxynil+MCPA) یا ایلی میکس (Ally Max) 16 گرام فی ایکڑ۔',
            'باریک پتے (دمبی سٹی، جنگلی جئی): ایکسیل (Axial 050 EC) 330 ملی لیٹر فی ایکڑ۔'
        ],
        diseases: [
            'پیلے اور بھورے زنگ (Rust): ٹلٹ (Tilt 250 EC) 200 ملی لیٹر یا سکور (Score 250 EC) 100 تا 125 ملی لیٹر فی ایکڑ۔'
        ],
        nutrition: 'بوائی پر فاسفورس (DAP/Nitrophos)، پہلے پانی پر 1 بوری یوریا، گوبھ کے وقت پوٹاش کا سپرے اور زنک پلس کا استعمال۔'
    },
    rice: {
        names: ['چاول', 'rice', 'chawal', 'dhan', 'munji', 'basmati'],
        pests: [
            'تنے کی سنڈیاں اور پتہ لپیٹ (Stem Borer / Leaf Folder): ورٹاکو (Virtako 0.6 GR) 4 کلو فی ایکڑ یا انسیپیو (Incipio 200 SC) 80 ملی لیٹر فی ایکڑ۔'
        ],
        diseases: [
            'چاول کا جھلساؤ اور برgroupن لیف سپاٹ (Blast & Leaf Spot): امیستار ٹاپ (Amistar Top 325 SC) 200 تا 300 ملی لیٹر فی ایکڑ۔'
        ],
        nutrition: 'پنیری لگاتے وقت زنک پلس 7.5 کلو، پنیری کی منتقلی کے بعد یوریا کی اقساط، اور دانوں کی بھرائی کے وقت پوٹاش اور ازابیون گولڈ۔'
    },
    maize: {
        names: ['مکئی', 'maize', 'corn', 'makkai', 'makki'],
        pests: [
            'فال آرمی ورم (Fall Armyworm): ایمپلیگو (Ampligo 150 ZC) 100 ملی لیٹر یا میچ (Match 050 EC) 200 ملی لیٹر پودوں کی کونپلوں میں سپرے کریں۔'
        ],
        nutrition: 'بوائی کے وقت ڈی اے پی اور پوٹاش، گھٹنے کے قد پر یوریا اور نائٹروجن کی بھرپور فراہمی۔'
    },
    sugarcane: {
        names: ['کماد', 'گنا', 'sugarcane', 'kamad', 'ganna'],
        pests: [
            'تنے اور چوٹی کے کیڑے (Borers): ورٹاکو (Virtako 0.6 GR) یا فیپرونل 8 کلو گرام فی ایکڑ۔'
        ],
        weeds: [
            'جڑی بوٹیاں: پریماسٹرا گولڈ (Primextra Gold) بوائی کے 24 سے 48 گھنٹے کے اندر تر وتر میں سپرے کریں۔'
        ]
    },
    livestock: {
        names: ['جانور', 'مویشی', 'گائے', 'بھینس', 'بکری', 'دودھ', 'سائیلج', 'ونڈا', 'livestock', 'cow', 'buffalo', 'dairy'],
        advice: 'دودھ بڑھانے کے لیے متوازن ونڈا (کم از کم 16 سے 18 فیصد پروٹین)، روزانہ 30 سے 50 کلو معیاری مکئی کا سائیلج، 100 گرام منرل مکسچر، اور بائی پاس فیٹ کا استعمال کریں۔ منہ کھر اور گل گھوٹو سے بچاؤ کے لیے حکومتی محکمہ لائیو اسٹاک سے بروقت ویکسینیشن لازمی کروائیں۔'
    }
};

function searchKnowledge(query) {
    const q = query.toLowerCase();
    const hits = [];

    // 1. Search products database
    for (const prod of productsList) {
        const pName = prod.name.toLowerCase();
        const pTargets = (prod.attributes?.Targets || '').toLowerCase();
        const pCrops = (prod.attributes?.['Applicable Crops'] || '').toLowerCase();
        
        if (q.includes(pName) || (pTargets && q.split(' ').some(word => word.length > 3 && pTargets.includes(word)))) {
            let info = `پروڈکٹ: ${prod.name} (${prod.attributes?.Category || 'زراعت'})\n`;
            if (prod.attributes?.Composition) info += `اجزاء: ${prod.attributes.Composition}\n`;
            if (prod.attributes?.['Applicable Crops']) info += `فصلیں: ${prod.attributes['Applicable Crops']}\n`;
            if (prod.attributes?.Targets) info += `ہدف کیڑے/بیماریاں: ${prod.attributes.Targets}\n`;
            if (prod.usage && prod.usage.length > 0) {
                const u = prod.usage[0];
                info += `ڈوز: ${u['Dosage per Acre'] || u['Dose per Acre'] || 'لیبل کے مطابق'} | وقفہ PHI: ${u['Pre-Harvest Interval (PHI)'] || u['PHI'] || 'مقررہ دن'}\n`;
            }
            hits.push(info);
            if (hits.length >= 3) break;
        }
    }

    // 2. Search built-in Crop/Livestock KB
    for (const [key, cropData] of Object.entries(MAJOR_CROPS_KB)) {
        if (cropData.names.some(n => q.includes(n))) {
            let cropInfo = `فصل/شعبہ: ${cropData.names[0]}\n`;
            if (cropData.sowing_and_temperature) {
                cropInfo += `بوائی اور درجہ حرارت کی سائنسی رہنمائی:\n- ${cropData.sowing_and_temperature.optimal_temp}\n- زیادہ درجہ حرارت (30 تا 35 ڈگری) کے خطرات: ${cropData.sowing_and_temperature.high_temp_risks}\n- بوائی کا وقت: ${cropData.sowing_and_temperature.recommendation}\n`;
            }
            if (cropData.pests) {
                cropInfo += `کیڑے اور تدارک:\n` + cropData.pests.map(p => typeof p === 'string' ? `- ${p}` : `- ${p.name}: ${p.solutions ? p.solutions.join('، ') : ''}`).join('\n') + `\n`;
            }
            if (cropData.weeds) {
                cropInfo += `جڑی بوٹیوں کا تدارک:\n` + cropData.weeds.join('\n') + `\n`;
            }
            if (cropData.diseases) {
                cropInfo += `بیماریاں اور علاج:\n` + cropData.diseases.join('\n') + `\n`;
            }
            if (cropData.nutrition) {
                cropInfo += `کھاد و غذائیت:\n${cropData.nutrition}\n`;
            }
            if (cropData.advice) {
                cropInfo += `ہدایات:\n${cropData.advice}\n`;
            }
            hits.push(cropInfo);
        }
    }

    // 3. Search Function Storage Custom RAG data
    const customEntries = loadCustomRag();
    for (const item of customEntries) {
        const itemText = (item.title + ' ' + (item.crops || '') + ' ' + (item.content || '')).toLowerCase();
        if (q.split(' ').some(w => w.length > 2 && itemText.includes(w))) {
            hits.push(`[مصدقہ اضافی ڈیٹا]: ${item.title}\n${item.content}\nڈوز/ہدایات: ${item.dosage || 'لیبل کے مطابق'}`);
            if (hits.length >= 4) break;
        }
    }

    // 4. Search Company Knowledge (e.g. FMC, Bayer, Syngenta)
    const companies = loadCompaniesKnowledge();
    for (const co of companies) {
        if (co.productsKnowledge) {
            const coText = (co.companyName + ' ' + (co.focusCrops || '') + ' ' + co.productsKnowledge).toLowerCase();
            if (q.split(' ').some(w => w.length > 3 && coText.includes(w))) {
                hits.push(`[کمپنی پروڈکٹ ڈیٹا (${co.companyName})]:\n${co.productsKnowledge}`);
                if (hits.length >= 4) break;
            }
        }
    }

    return hits.join('\n---\n');
}

module.exports = {
    searchKnowledge,
    loadCustomRag,
    saveCustomRag
};
