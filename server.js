try { process.loadEnvFile(); } catch (e) {}
const express = require('express');
const path = require('path');
const fs = require('fs');
const agent = require('./agent');
const db = require('./db');
const waha = require('./waha_bridge');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/audio', express.static(path.join(__dirname, 'audio_out')));

// Health check endpoint for 24/7 Anti-Sleep Keepalive Cron
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'AgriBot CRM Engine',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

const CONFIG_PATH = path.join(__dirname, 'config.json');
let botSocketRef = null;

function setBotSocket(sock) {
    botSocketRef = sock;
}

// Stats Endpoint
app.get('/api/stats', (req, res) => {
    res.json(db.getStats());
});

// WAHA Cloud Status Endpoint
app.get('/api/waha/status', async (req, res) => {
    try {
        const sessionRes = await waha.wahaRequest('GET', '/api/sessions');
        const sessions = sessionRes.data || [];
        const active = sessions.find(s => s.status === 'WORKING') || sessions[0] || null;
        res.json({
            connected: Boolean(active && active.status === 'WORKING'),
            session: active ? active.name : null,
            status: active ? active.status : 'DISCONNECTED',
            phone: active?.me?.id ? active.me.id.split('@')[0] : null,
            pushName: active?.me?.pushName || 'Agriculture Guidance',
            serverUrl: 'https://waha-whatsapp-server.onrender.com'
        });
    } catch (e) {
        res.json({
            connected: false,
            error: e.message,
            serverUrl: 'https://waha-whatsapp-server.onrender.com'
        });
    }
});

// Contacts list
app.get('/api/contacts', (req, res) => {
    res.json(db.getContacts());
});

// Single contact chat history with enriched backend telemetry
app.get('/api/chat/:jid', (req, res) => {
    const chat = db.getChat(req.params.jid);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    // Attach backend telemetry info for the admin inspector
    const limitInfo = db.checkDailyLimit(req.params.jid, 20);
    const mode = db.getChatMode(req.params.jid);
    const ytStatus = db.shouldSendYtLink(req.params.jid);

    res.json({
        ...chat,
        telemetry: {
            mode,
            isAdmin: Boolean(chat.isAdmin),
            limitCount: limitInfo.count || 0,
            limitMax: 20,
            limitAllowed: limitInfo.allowed,
            canSendYtLink: ytStatus,
            llmModel: 'gemini-3.5-flash-lite (Temperature 0.2)',
            sttEngine: 'Groq Whisper Large-v3 (~720ms)',
            ttsVoice: 'ur-PK-AsadNeural (24kHz Native WhatsApp Opus PTT)',
            weatherSource: 'IBM Weather (Open-Meteo Satellite Grounding)'
        }
    });
});

// Toggle Chat Mode (@AgriBot vs @General)
app.post('/api/chat/:jid/mode', (req, res) => {
    const { mode } = req.body;
    db.setChatMode(req.params.jid, mode || 'agri');
    res.json({ success: true, mode: mode || 'agri' });
});

// Toggle Admin Godmode (@adminzeb)
app.post('/api/chat/:jid/admin', (req, res) => {
    const { isAdmin } = req.body;
    db.setAdmin(req.params.jid, Boolean(isAdmin));
    res.json({ success: true, isAdmin: Boolean(isAdmin) });
});

// Reset Rate Limit for a farmer
app.post('/api/chat/:jid/reset-limit', (req, res) => {
    const chat = db.getChat(req.params.jid);
    if (chat) {
        // Clear recent timestamps by marking them older
        if (Array.isArray(chat.messages)) {
            const twelveHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
            for (const m of chat.messages) {
                m.timestamp = twelveHoursAgo;
            }
        }
        res.json({ success: true, message: 'Rate limit reset successfully' });
    } else {
        res.status(404).json({ error: 'Chat not found' });
    }
});

// Syngenta 50 Products Catalog Explorer
app.get('/api/syngenta/products', (req, res) => {
    try {
        const prodPath = path.join(__dirname, 'data', 'syngenta_products.json');
        if (fs.existsSync(prodPath)) {
            const data = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
            res.json(data);
        } else {
            res.json([]);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Request WhatsApp Pairing Code for phone linking
app.post('/api/waha/pair-code', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const phone = (phoneNumber || '923026964085').replace(/\D/g, '');
        const session = waha.getActiveSession() || 'default';
        const pairRes = await waha.wahaRequest('POST', `/api/${session}/auth/request-code`, {
            phoneNumber: phone
        });
        res.json(pairRes.data || pairRes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Latest QR Code for WhatsApp linking
app.get('/api/waha/qr-image', async (req, res) => {
    try {
        const session = waha.getActiveSession() || 'default';
        const qrBuffer = await waha.downloadMedia(`/api/${session}/auth/qr`);
        res.setHeader('Content-Type', 'image/png');
        res.send(qrBuffer);
    } catch (e) {
        const localQr = path.join(__dirname, 'public', 'waha_qr.png');
        if (fs.existsSync(localQr)) {
            res.sendFile(localQr);
        } else {
            res.status(404).json({ error: 'QR not available' });
        }
    }
});

// Send manual WhatsApp message from dashboard
app.post('/api/send', async (req, res) => {
    const { jid, text } = req.body;
    if (!jid || !text) return res.status(400).json({ error: 'jid and text required' });

    try {
        const session = waha.getActiveSession();
        await waha.sendTextMessage(session, jid, text);

        db.saveMessage({
            jid,
            role: 'bot',
            text: text + ' (Admin Manual Reply)',
            msgId: 'manual_' + Date.now()
        });
        res.json({ success: true });
    } catch (e) {
        if (botSocketRef) {
            try {
                await botSocketRef.sendMessage(jid, { text });
                db.saveMessage({
                    jid,
                    role: 'bot',
                    text: text + ' (Admin Manual Reply)',
                    msgId: 'manual_' + Date.now()
                });
                return res.json({ success: true });
            } catch (err2) {
                return res.status(500).json({ error: err2.message });
            }
        }
        res.status(500).json({ error: e.message });
    }
});

// Config endpoints
app.get('/api/config', (req, res) => {
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/config', (req, res) => {
    try {
        const current = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        const updated = { ...current, ...req.body };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
        res.json({ success: true, updated });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const COMPANIES_FILE = path.join(__dirname, 'data', 'companies.json');

// Companies API
app.get('/api/companies', (req, res) => {
    try {
        if (!fs.existsSync(COMPANIES_FILE)) return res.json([]);
        const list = JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf-8'));
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/companies', (req, res) => {
    try {
        let list = [];
        if (fs.existsSync(COMPANIES_FILE)) {
            list = JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf-8'));
        }
        const newCo = {
            id: 'co_' + Date.now(),
            status: 'Ready to Deploy',
            createdAt: new Date().toISOString(),
            ...req.body
        };
        list.push(newCo);
        fs.writeFileSync(COMPANIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
        res.json({ success: true, company: newCo });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Simulator chat endpoint
app.post('/api/simulator', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const result = await agent.processFarmerQuery(message);
        let audioUrl = null;
        if (result.audioPath) {
            audioUrl = '/audio/' + path.basename(result.audioPath);
        }
        res.json({ reply: result.replyText, audioUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function startServer() {
    app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`🌿 Enterprise WhatsApp AI CRM Dashboard: http://localhost:${PORT}`);
        console.log(`======================================================\n`);
    });
}

module.exports = {
    startServer,
    setBotSocket
};

if (require.main === module) {
    startServer();
}
