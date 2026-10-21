const https = require('https');

const BASE_URL = process.env.WAHA_BASE_URL || 'https://waha-whatsapp-server.onrender.com';
const API_KEY = process.env.WAHA_API_KEY || 'agri_secret_123';
const PING_URLS = [
    `${BASE_URL}/api/sessions?all=true`,
    `${BASE_URL}/`
];

function pingUrl(url) {
    return new Promise((resolve) => {
        try {
            const req = https.get(url, {
                headers: {
                    'X-Api-Key': API_KEY,
                    'User-Agent': 'RenderKeepAliveCron/1.0'
                },
                timeout: 10000
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    resolve({ ok: true, status: res.statusCode, body });
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ ok: false, error: 'Timeout after 10s' });
            });

            req.on('error', (err) => {
                resolve({ ok: false, error: err.message });
            });
        } catch (e) {
            resolve({ ok: false, error: e.message });
        }
    });
}

async function runCronKeepAlive() {
    const timestamp = new Date().toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi' });
    try {
        const sessionRes = await pingUrl(PING_URLS[0]);
        let sessionStatus = 'UNKNOWN';
        if (sessionRes.ok) {
            try {
                const data = JSON.parse(sessionRes.body);
                sessionStatus = data[0]?.status || 'NO_SESSION';
            } catch {
                sessionStatus = 'PARSED_RAW';
            }
        }

        // Also ping root endpoint
        await pingUrl(PING_URLS[1]);

        console.log(`⏰ [CRON KEEP-ALIVE ${timestamp} PKT] Render Pinged OK! WAHA Status: [${sessionStatus}]`);
        return { ok: true, status: sessionStatus, timestamp };
    } catch (err) {
        console.error(`⚠️ [CRON KEEP-ALIVE ${timestamp} PKT] Error:`, err.message);
        return { ok: false, error: err.message };
    }
}

function startKeepAlive(intervalMinutes = 5) {
    console.log(`🛡️ Render Anti-Sleep Cron Job activated! Interval: Every ${intervalMinutes} minutes.`);
    // Run immediately on boot
    runCronKeepAlive();
    // Schedule repeating interval
    const intervalMs = intervalMinutes * 60 * 1000;
    return setInterval(runCronKeepAlive, intervalMs);
}

module.exports = {
    startKeepAlive,
    runCronKeepAlive
};
