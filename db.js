const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {}

let chatsData = {};
try {
    const seedFile = path.join(__dirname, 'data', 'chats.json');
    if (!fs.existsSync(CHATS_FILE) && fs.existsSync(seedFile)) {
        try { fs.copyFileSync(seedFile, CHATS_FILE); } catch (e) {}
    }
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

function hasMessage(msgId) {
    if (!msgId) return false;
    for (const jid in chatsData) {
        if (Array.isArray(chatsData[jid]?.messages)) {
            if (chatsData[jid].messages.some(m => m.id === msgId)) {
                return true;
            }
        }
    }
    return false;
}

function getChatMode(jid) {
    if (!jid) return 'agri';
    if (isMasterAdmin(jid)) {
        return chatsData[jid]?.mode || 'autonomous';
    }
    return chatsData[jid]?.mode || 'agri';
}

// YouTube Link Gate: STRICTLY ONCE PER FARMER EVER (Never repeated)
function shouldSendYtLink(jid) {
    if (!jid) return false;
    // 1. Check persistent ytLinkSent flag or previous timestamp
    if (chatsData[jid]?.ytLinkSent || chatsData[jid]?.lastYtSentTimestamp) {
        return false;
    }
    // 2. Check if any message in farmer history already contains the YouTube link
    if (Array.isArray(chatsData[jid]?.messages)) {
        const alreadyHasLink = chatsData[jid].messages.some(m => m.text && m.text.includes('youtube.com/@AgricultureGuidance'));
        if (alreadyHasLink) {
            chatsData[jid].ytLinkSent = true;
            return false;
        }
    }
    return true;
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
            ytLinkSent: true,
            lastYtSentTimestamp: Date.now(),
            messages: []
        };
    } else {
        chatsData[jid].ytLinkSent = true;
        chatsData[jid].lastYtSentTimestamp = Date.now();
    }
    persist();
}

// Welcome Gate: STRICTLY ONCE PER DAY (24 Hours) PER FARMER
function shouldSendWelcome(jid) {
    if (!jid) return false;
    const chat = chatsData[jid];
    if (!chat) return true;
    
    // 1. Check if welcomed in the last 24 hours
    if (chat.lastWelcomeTimestamp) {
        const diff = Date.now() - chat.lastWelcomeTimestamp;
        if (diff < 24 * 60 * 60 * 1000) {
            return false;
        }
    }

    // 2. Check if any message in chat history within last 24 hours already contained خوش آمدید
    if (Array.isArray(chat.messages)) {
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const welcomedRecently = chat.messages.some(m => {
            if (m.role !== 'bot' || !m.text) return false;
            const isWelcome = m.text.includes('خوش آمدید');
            const msgTime = new Date(m.timestamp).getTime();
            return isWelcome && (now - msgTime) < ONE_DAY;
        });
        if (welcomedRecently) {
            chat.lastWelcomeTimestamp = Date.now();
            return false;
        }
    }

    return true;
}

function markWelcomeSent(jid) {
    if (!jid) return;
    if (!chatsData[jid]) {
        chatsData[jid] = {
            jid,
            phone: cleanPhone(jid),
            name: cleanPhone(jid),
            lastMessage: '',
            lastTime: new Date().toISOString(),
            lastWelcomeTimestamp: Date.now(),
            messages: []
        };
    } else {
        chatsData[jid].lastWelcomeTimestamp = Date.now();
    }
    persist();
}

// Voice Note Delivery Preference: Text-Only Mode vs Default (Text + Audio)
function isVoiceDisabled(jid) {
    if (!jid) return false;
    return !!chatsData[jid]?.voiceDisabled;
}

function setVoiceDisabled(jid, disabled = true) {
    if (!jid) return;
    if (!chatsData[jid]) {
        chatsData[jid] = {
            jid,
            phone: cleanPhone(jid),
            name: cleanPhone(jid),
            lastMessage: '',
            lastTime: new Date().toISOString(),
            voiceDisabled: !!disabled,
            messages: []
        };
    } else {
        chatsData[jid].voiceDisabled = !!disabled;
    }
    persist();
}

const MASTER_ADMIN_NUMBERS = [
    '923285247115', '03285247115',
    '923317824038', '03317824038',
    '173632709984503' // Shahzaib Irshad (WhatsApp Privacy LID)
];

function isMasterAdmin(jid) {
    if (!jid) return false;
    const cleanId = jid.replace(/[^0-9]/g, '');
    const isNumMatch = MASTER_ADMIN_NUMBERS.some(num => {
        const cleanNum = num.replace(/^0/, '92');
        return cleanId.includes(cleanNum) || cleanId.includes(num);
    });
    if (isNumMatch) return true;
    if (chatsData[jid]?.name && /شاہزیب|ارشاد|shahzaib/i.test(chatsData[jid].name)) {
        return true;
    }
    return false;
}

// Daily Rate Limiter: 20 messages per user per day (24-hour window), across both Agri and General modes
function checkDailyLimit(jid, maxLimit = 20) {
    if (!jid) return { allowed: true, count: 0, remaining: maxLimit };
    
    // Admin Godmode Bypass (@adminzeb, 03285247115, 03317824038, etc.)
    if (isMasterAdmin(jid) || chatsData[jid]?.isAdmin) {
        return { allowed: true, count: 0, isAdmin: true, remaining: 9999 };
    }

    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000; // 24-hour rolling daily window

    const chat = chatsData[jid];
    if (!chat || !Array.isArray(chat.messages)) {
        return { allowed: true, count: 0, remaining: maxLimit };
    }

    // Count user messages within the 24-hour window (regardless of mode)
    const recentUserMsgs = chat.messages.filter(m => {
        if (m.role !== 'user') return false;
        const msgTime = new Date(m.timestamp).getTime();
        return (now - msgTime) <= ONE_DAY;
    });

    const count = recentUserMsgs.length;
    if (count >= maxLimit) {
        return {
            allowed: false,
            count,
            remaining: 0,
            message: "محترم صارف! آپ کے آج کے 20 سوالات کی یومیہ حد (Daily Limit: 20 messages per day) مکمل ہو چکی ہے۔\n\nآپ کا نیا کوٹہ 24 گھنٹے بعد خودکار طور پر ری سیٹ ہو جائے گا۔ شکریہ! 🌾"
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

// Master Bot Power State (Active vs Paused/Standby)
const STATE_FILE = path.join(DATA_DIR, 'bot_state.json');
let botState = { active: true };
try {
    const seedState = path.join(__dirname, 'data', 'bot_state.json');
    if (!fs.existsSync(STATE_FILE) && fs.existsSync(seedState)) {
        try { fs.copyFileSync(seedState, STATE_FILE); } catch (e) {}
    }
    if (fs.existsSync(STATE_FILE)) {
        botState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
} catch (e) {
    botState = { active: true };
}

function isBotActive() {
    return botState.active !== false;
}

function setBotActive(active) {
    botState.active = Boolean(active);
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(botState, null, 2), 'utf-8');
    } catch (e) {}
    return botState.active;
}

function clearAllHistory() {
    for (const jid in chatsData) {
        chatsData[jid].messages = [];
        chatsData[jid].lastMessage = '';
        chatsData[jid].ytLinkSent = false;
        delete chatsData[jid].lastWelcomeTimestamp;
        delete chatsData[jid].lastYtSentTimestamp;
    }
    persist();
    return true;
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
    shouldSendWelcome,
    markWelcomeSent,
    isVoiceDisabled,
    setVoiceDisabled,
    checkDailyLimit,
    setAdmin,
    hasMessage,
    isBotActive,
    setBotActive,
    isMasterAdmin,
    clearAllHistory
};
