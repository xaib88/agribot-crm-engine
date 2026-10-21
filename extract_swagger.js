const https = require('https');
const fs = require('fs');
const path = require('path');

const options = {
  hostname: 'waha-whatsapp-server.onrender.com',
  path: '/swagger-ui-init.js',
  headers: {
    'Authorization': 'Basic ' + Buffer.from('admin:admin123').toString('base64')
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const match = data.match(/\"swaggerDoc\":\s*(\{[\s\S]*?\})\s*,\s*\"customOptions\"/);
    if (match) {
      const swagger = JSON.parse(match[1]);
      const checkPaths = ['/api/sendText', '/api/sendVoice', '/api/reaction', '/api/sendSeen'];
      const details = {
        paths: {},
        components: swagger.components ? swagger.components.schemas : {}
      };
      for (const p of checkPaths) {
        details.paths[p] = swagger.paths[p];
      }
      const outPath = path.join(__dirname, 'waha_send_schemas.json');
      fs.writeFileSync(outPath, JSON.stringify(details, null, 2));
      console.log("Saved to:", outPath);
    }
  });
});
