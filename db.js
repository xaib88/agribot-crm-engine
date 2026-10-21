const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let chatsData = {};
try {
    if (fs.existsSync(CHATS_FILE)) {
        chatsData = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf-8'));
    }
} catch (e) {
    console.error('Error reading chats.json:', e.message);
    chatsData = {};
}

function persist() {
    try {
        fs.writeFileSync(CHATS_FILE, JSON.stringify(chatsData, null, 2), 'utf-8');
    } catch (e) {
        console.error('Error saving chats.json:', e.message);
    }
}

function cleanPhone(jid) {
    if (!jid) return "Unknown";
    const num = jid.split('@')[0];
    if (num.startsWith('92')) {
        return '+' + num.slice(0, 2) + ' ' + num.slice(2, 5) + ' ' + num.slice(5);
    }
    return '+' + num;
}

function saveMessage({ jid, role, text, audioUrl = null, pushName = '', msgId = null }) {
    if (!jid) return;

    if (!chatsData[jid]) {
        chatsData[jid] = {
            jid,
            phone: cleanPhone(jid),
            name: pushName || cleanPhone(jid),
            lastMessage: text,
            lastTime: new Date().toISOString(),
            messages: []
        };
    } else {
        if (pushName && !chatsData[jid].name.includes(pushName)) {
            chatsData[jid].name = pushName;
        }
        chatsData[jid].lastMessage = text;
        chatsData[jid].lastTime = new Date().toISOString();
    }

    chatsData[jid].messages.push({
        id: msgId || Date.now().toString(),
        role,
        text,
        audioUrl,
        timestamp: new Date().toISOString()
    });

    // Keep up to 200 messages per contact
    if (chatsData[jid].messages.length > 200) {
        chatsData[jid].messages.shift();
    }

    persist();
}

function getContacts() {
    return Object.values(chatsData)
        .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime))
        .map(c => ({
            jid: c.jid,
            name: c.name,
            phone: c.phone,
            lastMessage: c.lastMessage,
            lastTime: c.lastTime,
            messageCount: c.messages.length
        }));
}

function getChat(jid) {
    return chatsData[jid] || null;
}

function getStats() {
    const contacts = Object.values(chatsData);
    let totalMessages = 0;
    let todayMessages = 0;
    const today = new Date().toDateString();

    for (const c of contacts) {
        totalMessages += c.messages.length;
        for (const m of c.messages) {
            if (new Date(m.timestamp).toDateString() === today) {
                todayMessages++;
            }
        }
    }

    return {
        totalFarmers: contacts.length,
        totalMessages,
        todayMessages
    };
}

function isFirstContact(jid) {
    if (!chatsData[jid] || !chatsData[jid].messages || chatsData[jid].messages.length === 0) {
        return true;
    }
    return false;
}

function setChatMode(jid, mode) {
    if (!jid) return;
    if (!chatsData[jid]) {
        chatsData[jid] = {
            jid,
            phone: cleanPhone(jid),
            name: cleanPhone(jid),
            lastMessage: '',
            lastTime: new Date().toISOString(),
            mode: mode,
            messages: []
        };
    } else {
        chatsData[jid].mode = mode;
    }
    persist();
}

function getChatMode(jid) {
    if (!jid || !chatsData[jid]) return 'agri';
    return chatsData[jid].mode || 'agri';
}

function shouldSendYtLink(jid) {
    if (!jid) return false;
    const lastSent = chatsData[jid]?.lastYtSentTimestamp || 0;
    const hoursSinceLast = (Date.now() - lastSent) / (1000 * 60 * 60);
    return hoursSinceLast >= 24;
}

function markYtLinkSent(jid) {
    if (!jid) return;
    if (!chatsData[jid]) {
        chatsData[jid] = {
            jid,
            phone: cleanPhone(jid),
            name: cleanPhone(jid),
            lastMessage: '',
            lastTime: new Date().toISOString(),
            lastYtSentTimestamp: Date.now(),
            messages: []
        };
    } else {
        chatsData[jid].lastYtSentTimestamp = Date.now();
    }
    persist();
}

// Daily Rate Limiter: 20 messages per user, 12-hour cool-off
function checkDailyLimit(jid, maxLimit = 20) {
    if (!jid) return { allowed: true, count: 0 };
    
    // Admin Godmode Bypass (@adminzeb)
    if (chatsData[jid]?.isAdmin) {
        return { allowed: true, count: 0, isAdmin: true };
    }

    const now = Date.now();
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    const chat = chatsData[jid];
    if (!chat || !Array.isArray(chat.messages)) {
        return { allowed: true, count: 0, remaining: maxLimit };
    }

    // Count user messages within the 12-hour window
    const recentUserMsgs = chat.messages.filter(m => {
        if (m.role !== 'user') return false;
        const msgTime = new Date(m.timestamp).getTime();
        return (now - msgTime) <= TWELVE_HOURS;
    });

    const count = recentUserMsgs.length;
    if (count >= maxLimit) {
        return {
            allowed: false,
            count,
            message: "آپ کی لمٹ پوری ہو گئی ہے، براہِ کرم 12 گھنٹے بعد میسج کریں۔ 🌾"
        };
    }

    return { allowed: true, count, remaining: maxLimit - count };
}

function setAdmin(jid, isAdmin = true) {
    if (!jid) return;
    if (!chatsData[jid]) {
        chatsData[jid] = {
            jid,
            phone: cleanPhone(jid),
            name: cleanPhone(jid),
            lastMessage: '',
            lastTime: new Date().toISOString(),
            isAdmin: Boolean(isAdmin),
            messages: []
        };
    } else {
        chatsData[jid].isAdmin = Boolean(isAdmin);
    }
    persist();
}

module.exports = {
    saveMessage,
    getContacts,
    getChat,
    getStats,
    isFirstContact,
    setChatMode,
    getChatMode,
    shouldSendYtLink,
    markYtLinkSent,
    checkDailyLimit,
    setAdmin
};
