// High-Speed Autonomous Web & Real Estate Search Engine (Zero API Key, Cloud-Native)
async function searchWeb(query, maxResults = 5) {
    if (!query || typeof query !== 'string') return [];
    try {
        console.log(`🌐 [Autonomous Agent] Searching web for: "${query}"...`);
        const res = await fetch('https://lite.duckduckgo.com/lite/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            signal: AbortSignal.timeout(10000), // 10s timeout
            body: 'q=' + encodeURIComponent(query)
        });

        if (!res.ok) {
            console.warn(`Web search returned HTTP ${res.status}`);
            return [];
        }

        const html = await res.text();
        const linkRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;
        const snippetRegex = /<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi;

        const links = [...html.matchAll(linkRegex)];
        const snippets = [...html.matchAll(snippetRegex)];

        const results = [];
        for (let i = 0; i < Math.min(maxResults, links.length); i++) {
            let u = links[i][1];
            if (u.includes('uddg=')) {
                try {
                    const match = u.match(/uddg=([^&]+)/);
                    if (match) u = decodeURIComponent(match[1]);
                } catch (e) {}
            }
            const cleanTitle = links[i][2].replace(/<[^>]+>/g, '').trim();
            const cleanSnippet = snippets[i] ? snippets[i][1].replace(/<[^>]+>/g, '').trim() : '';
            results.push({
                title: cleanTitle,
                snippet: cleanSnippet,
                url: u
            });
        }
        console.log(`🌐 [Autonomous Agent] Found ${results.length} live results for "${query}".`);
        return results;
    } catch (err) {
        console.error('Web search error:', err.message);
        return [];
    }
}

module.exports = {
    searchWeb
};
