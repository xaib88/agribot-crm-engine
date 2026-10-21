const https = require('https');

const API_KEY = process.env.WAHA_API_KEY || 'agri_secret_123';
const BASE_URL = process.env.WAHA_BASE_URL || 'https://waha-whatsapp-server.onrender.com';

async function wahaRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log("Checking WAHA sessions...");
  const sessions = await wahaRequest('GET', '/api/sessions');
  console.log("Sessions:", JSON.stringify(sessions, null, 2));

  // Check me info
  if (sessions.data && sessions.data.length > 0) {
    const activeSession = sessions.data.find(s => s.status === 'WORKING') || sessions.data[0];
    console.log("Active Session:", activeSession.name);

    console.log("Checking me info for session:", activeSession.name);
    const me = await wahaRequest('GET', `/api/sessions/${activeSession.name}/me`);
    console.log("Me:", me);
  }
}

main().catch(console.error);
