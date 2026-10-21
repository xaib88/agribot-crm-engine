try { process.loadEnvFile(); } catch (e) {}
const server = require("./server");
const waha = require("./waha_bridge");
const keepalive = require("./keepalive");

console.log("\n=======================================================");
console.log("🚀 Enterprise Agri WhatsApp Bot & CRM Engine Starting...");
console.log("🌿 Supervised by: Agriculture Specialist Shahzaib Arshad");
console.log("🌐 Web Admin CRM Dashboard: http://localhost:3000");
console.log("☁️ Cloud WhatsApp Gateway: https://waha-whatsapp-server.onrender.com");
console.log("=======================================================\n");

// 1. Start Web CRM Dashboard
server.startServer();

// 2. Connect to WAHA Cloud Gateway (WebSocket Live Stream)
waha.connectWebSocket();

// 3. Start Render 24/7 Anti-Sleep Cron Job (Pings every 5 minutes)
keepalive.startKeepAlive(5);
