const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const agent = require('./agent');
const db = require('./db');

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || 'https://waha-whatsapp-server.onrender.com';
const WAHA_API_KEY = process.env.WAHA_API_KEY || 'agri_secret_123';
const WAHA_WS_URL = process.env.WAHA_WS_URL || `wss://${new URL(WAHA_BASE_URL).hostname}/ws?x-api-key=${WAHA_API_KEY}`;

const LOCK_DIR = process.env.VERCEL ? path.join('/tmp', 'locks') : path.join(__dirname, 'locks');
try {
    if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
} catch (e) {}

// Triple-Barrier Deduplication Engine (Eliminates double responses)
const processedMsgIds = new Set();
function isDuplicate(id) {
    if (!id) return false;

    // Barrier 1: In-memory LRU Set (microsecond check)
    if (processedMsgIds.has(id)) {
        console.log(`🧹 [DEDUP BARRIER 1] In-memory drop for duplicate msg: ${id}`);
        return true;
    }
    processedMsgIds.add(id);
    if (processedMsgIds.size > 2000) {
        const first = processedMsgIds.values().next().value;
        processedMsgIds.delete(first);
    }

    // Barrier 2: Atomic OS File Lock (eliminates parallel serverless race conditions)
    try {
        const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const lockPath = path.join(LOCK_DIR, `lock_${cleanId}`);
        // Flag 'wx' exclusively creates file; throws EEXIST if file already exists
        fs.writeFileSync(lockPath, String(Date.now()), { flag: 'wx' });
    } catch (e) {
        if (e.code === 'EEXIST') {
            console.warn(`🧹 [DEDUP BARRIER 2] Atomic lock drop for duplicate msg: ${id}`);
            return true;
        }
    }

    // Barrier 3: Persistent Database history check
    if (db.hasMessage(id)) {
        console.warn(`🧹 [DEDUP BARRIER 3] Database history drop for msg: ${id}`);
        return true;
    }

    return false;
}

// REST helper using modern resilient fetch with 8s strict timeout
async function wahaRequest(method, endpoint, body = null) {
    try {
        const fullUrl = new URL(endpoint, WAHA_BASE_URL).toString();
        const options = {
            method,
            headers: {
                'X-Api-Key': WAHA_API_KEY,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(8000)
        };
        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }
        const res = await fetch(fullUrl, options);
        let data = null;
        try {
            data = await res.json();
        } catch {
            data = await res.text();
        }
        return { status: res.status, data };
    } catch (e) {
        console.error(`wahaRequest error (${method} ${endpoint}):`, e.message);
        return { status: 500, error: e.message };
    }
}

// Download media files (voice notes) from WAHA
async function downloadMedia(mediaUrl) {
    return new Promise((resolve, reject) => {
        let downloadPath = mediaUrl;
        if (downloadPath.includes('/api/files/')) {
            downloadPath = downloadPath.substring(downloadPath.indexOf('/api/files/'));
        }

        const options = {
            hostname: 'waha-whatsapp-server.onrender.com',
            port: 443,
            path: downloadPath,
            method: 'GET',
            headers: {
                'X-Api-Key': WAHA_API_KEY
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download media, HTTP ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });

        req.on('error', reject);
        req.end();
    });
}

// React to a message
async function reactToMessage(session, messageId, emoji) {
    try {
        await wahaRequest('PUT', '/api/reaction', {
            session,
            messageId,
            reaction: emoji
        });
    } catch (e) {
        console.error(`Error setting reaction ${emoji}:`, e.message);
    }
}

// Mark chat as seen
async function sendSeen(session, chatId) {
    try {
        await wahaRequest('POST', '/api/sendSeen', {
            session,
            chatId
        });
    } catch (e) {
        console.error('Error sending seen:', e.message);
    }
}

const botSentTexts = new Set();

// Send Text message
async function sendTextMessage(session, chatId, text) {
    if (text) {
        botSentTexts.add(text.trim());
        if (botSentTexts.size > 200) {
            const first = botSentTexts.values().next().value;
            botSentTexts.delete(first);
        }
    }
    return await wahaRequest('POST', '/api/sendText', {
        session,
        chatId,
        text
    });
}

// Send Voice Note (Gemini Charon / Edge Studio Audio)
async function sendVoiceNote(session, chatId, audioPath) {
    try {
        if (!fs.existsSync(audioPath)) return;
        const audioBuffer = fs.readFileSync(audioPath);
        const base64Data = audioBuffer.toString('base64');
        const lower = audioPath.toLowerCase();
        const isMp3 = lower.endsWith('.mp3');
        const isWav = lower.endsWith('.wav');

        let mimetype = 'audio/ogg; codecs=opus';
        let filename = 'voice-note.ogg';
        let convert = false;

        if (isMp3) {
            mimetype = 'audio/mp3';
            filename = 'voice-note.mp3';
            convert = true; // WAHA converts MP3 to WhatsApp PTT on server!
        } else if (isWav) {
            mimetype = 'audio/wav';
            filename = 'voice-note.wav';
            convert = true; // WAHA converts WAV to WhatsApp PTT on server!
        }

        return await wahaRequest('POST', '/api/sendVoice', {
            session,
            chatId,
            file: {
                mimetype,
                filename,
                data: base64Data
            },
            convert
        });
    } catch (e) {
        console.error('Error sending voice note:', e.message);
    }
}

// Active session cache
let activeSessionName = 'default';
let activeSessionPhone = '923026964085@c.us';
let activeSessionLid = '';

async function updateActiveSession() {
    try {
        const res = await wahaRequest('GET', '/api/sessions');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            const working = res.data.find(s => s.status === 'WORKING');
            if (working) {
                activeSessionName = working.name;
                activeSessionPhone = working.me?.id || '923026964085@c.us';
                activeSessionLid = working.me?.lid || '';
                console.log(`📡 WAHA Active Working Session: ${activeSessionName} (${working.me?.pushName || activeSessionPhone})`);
            } else {
                activeSessionName = res.data[0].name;
                console.log(`📡 WAHA Current Session: ${activeSessionName} (Status: ${res.data[0].status})`);
            }
        } else {
            // If no session exists, auto-create and start 'default'
            console.log('📡 No sessions found on WAHA. Auto-creating default session...');
            await wahaRequest('POST', '/api/sessions', { name: 'default' });
            await wahaRequest('POST', '/api/sessions/default/start');
            activeSessionName = 'default';
        }
    } catch (e) {
        console.error('Failed to query sessions:', e.message);
    }
}

let wsClient = null;

function connectWebSocket() {
    console.log(`🔌 Connecting to WAHA Cloud Gateway: ${WAHA_WS_URL}`);
    wsClient = new WebSocket(WAHA_WS_URL);

    wsClient.on('open', () => {
        console.log('✅ WAHA Cloud Gateway Connected & Listening for WhatsApp messages!');
        updateActiveSession();
    });

    wsClient.on('message', async (data) => {
        try {
            const event = JSON.parse(data.toString());
            await processWahaEvent(event);
        } catch (err) {
            console.error('Error parsing WebSocket message:', err.message);
        }
    });

    wsClient.on('error', (err) => {
        console.error('❌ WAHA WebSocket error:', err.message);
    });

    wsClient.on('close', (code, reason) => {
        console.log(`⚠️ WAHA WebSocket connection closed (${code}). Reconnecting in 3 seconds...`);
        setTimeout(connectWebSocket, 3000);
    });
}

// Universal Event Processor for both WebSocket and Webhook
async function processWahaEvent(event) {
    if (!event) return;
    try {
        const eventType = event.event;
        const session = event.session || activeSessionName;

        console.log(`\n⚡ [WAHA EVENT] Event: "${eventType}" | Session: "${session}" | FromMe: ${event.payload?.fromMe} | From: "${event.payload?.from}" | Body: "${event.payload?.body}"`);

        // 📞 Incoming call rejection
        if (eventType && (eventType.startsWith('call') || eventType === 'call.received')) {
            const callerId = event.payload?.from || event.payload?.caller;
            console.log(`\n📞 [NO CALLS ALLOWED] Incoming WhatsApp Call detected from ${callerId}!`);
            if (callerId) {
                wahaRequest('POST', '/api/rejectCall', {
                    session,
                    callId: event.payload?.id
                }).catch(() => {});

                const noCallMsg = "محترم کاشتکار بھائی! اس نمبر پر براہِ راست فون یا واٹس ایپ کال کی سہولت موجود نہیں ہے۔ 📵\n\nبراہِ کرم اپنا زرعی سوال یہاں لکھ کر بھیجیں یا وائس نوٹ (Voice Note) ریکارڈ کر کے بھیجیں، میں فوری رہنمائی کروں گا۔ شکریہ! 🌾";
                await sendTextMessage(session, callerId, noCallMsg);

                db.saveMessage({
                    jid: callerId,
                    role: 'bot',
                    text: '[📵 کال مسترد - خودکار الرٹ]: ' + noCallMsg,
                    msgId: 'call_reject_' + Date.now()
                });
            }
            return;
        }

        if (eventType === 'message' || eventType === 'message.any') {
            const payload = event.payload;
            if (!payload) return;

            const msgId = payload.id;
            if (isDuplicate(msgId)) return;

            const chatId = payload.from;
            if (!chatId || chatId.endsWith('@broadcast')) return;

            const userQuery = payload.body ? payload.body.trim() : '';

            // Prevent infinite loop
            if (userQuery && botSentTexts.has(userQuery)) {
                botSentTexts.delete(userQuery);
                return;
            }

            // NEVER reply to messages sent by the bot itself (Eliminates self-reply infinite loop)
            if (payload.fromMe) return;

            // Drop message if sent by bot's own session phone (prevent self-loop)
            if (activeSessionPhone && chatId === activeSessionPhone) {
                console.log(`🛑 [SELF-DROP] Dropping message sent by bot session phone (${chatId}).`);
                return;
            }

            // WhatsApp Group Handling: Silenced unless mentioned
            if (chatId.endsWith('@g.us')) {
                const lower = userQuery.toLowerCase();
                const isMentioned = lower.includes('بشیر') || lower.includes('basheer');
                if (!isMentioned) return;
            }

            const pushName = payload._data?.pushName || payload._data?.notifyName || 'Farmer';
            const isAudio = payload.hasMedia && (payload.media?.mimetype?.includes('audio') || payload.type === 'ptt');
            const isImage = payload.hasMedia && (payload.media?.mimetype?.includes('image') || payload.type === 'image' || payload._data?.type === 'image');
            const isLocation = payload.type === 'location' || 
                               payload._data?.type === 'location' || 
                               Boolean(payload.location) ||
                               (payload.lat !== undefined && payload.lng !== undefined) ||
                               (payload.latitude !== undefined && payload.longitude !== undefined);
            const hasMedia = payload.hasMedia;

            console.log(`\n📩 Incoming WhatsApp from ${chatId} (${pushName}): ${isAudio ? '[🎙️ Voice Note]' : isLocation ? '[📍 Location Pin]' : `"${userQuery}"`}`);

            // 0. Master Admin & Global Killswitch Controller (Primary Admin: 03317824038 & 03285247115)
            const rawText = userQuery.toLowerCase().trim();
            const isMasterAdmin = db.isMasterAdmin(chatId);

            if (isMasterAdmin) {
                db.setAdmin(chatId, true);
            }

            const isStopCmd = (isMasterAdmin && /^(stop|pause|band|بند|روکو)$/i.test(rawText)) ||
                              /^(@stop|@pause|@admin\s*stop|@admin\s*pause)$/i.test(rawText);

            const isStartCmd = (isMasterAdmin && /^(start|resume|on|شروع|چلاؤ)$/i.test(rawText)) ||
                               /^(@start|@resume|@admin\s*start|@admin\s*resume)$/i.test(rawText);

            if (isStopCmd) {
                db.setBotActive(false);
                console.log(`🛑 [GLOBAL KILLSWITCH ACTIVATED] Bot paused for ALL users by Admin ${chatId}`);
                const stopReply = "🛑 [بوٹ تمام کسانوں کے لیے بند (STOP) کر دیا گیا ہے]\n\nسرور، رینڈر گیٹ وے اور واٹس ایپ نمبر 24/7 کنیکٹڈ رہے گا، لیکن اب بوٹ کسی بھی کسان کے میسج کا خودکار جواب نہیں دے گا۔\n\nدوبارہ شروع کرنے کے لیے اسی نمبر سے 'start' لکھ کر بھیجیں، یا ویب ڈیش بورڈ سے بٹن آن کریں۔ 🌾";
                await sendTextMessage(session, chatId, stopReply);
                db.saveMessage({ jid: chatId, role: 'bot', text: stopReply, pushName, msgId: 'bot_' + Date.now() });
                return;
            }

            if (isStartCmd) {
                db.setBotActive(true);
                console.log(`✅ [GLOBAL KILLSWITCH DEACTIVATED] Bot resumed for ALL users by Admin ${chatId}`);
                const startReply = "✅ [بوٹ تمام کسانوں کے لیے دوبارہ فعال (ACTIVE) کر دیا گیا ہے]\n\nاب کسانوں کے سوالات، وائس نوٹس اور زرعی رہنمائی کے خودکار جوابات دوبارہ شروع ہو چکے ہیں۔ 🚜🌾";
                await sendTextMessage(session, chatId, startReply);
                db.saveMessage({ jid: chatId, role: 'bot', text: startReply, pushName, msgId: 'bot_' + Date.now() });
                return;
            }

            // Check Master Power State: If stopped, do not reply, do not process
            if (!db.isBotActive()) {
                console.log(`⏸️ [BOT STANDBY] WhatsApp connected, but auto-replies are paused. Ignoring incoming message from ${chatId}.`);
                return;
            }

            // 1. Thinking Reaction
            await reactToMessage(session, msgId, '💭');

            // 2. Passkey check
            if (rawText.includes('@adminzeb') || rawText.includes('ایڈمن زیب')) {
                db.setAdmin(chatId, true);
                console.log(`👑 Admin godmode activated for ${chatId}!`);
                const adminReply = "وعلیکم السلام ایڈمن صاحب! آپ کا گوڈ موڈ ایکٹیو کر دیا گیا ہے۔ آپ کے تمام پیغامات اور وائس نوٹس پر کوئی ڈیلی لمٹ لاگو نہیں ہو گی۔ 👑";
                await sendTextMessage(session, chatId, adminReply);
                db.saveMessage({ jid: chatId, role: 'bot', text: adminReply, pushName, msgId: 'bot_' + Date.now() });
                return;
            }

            // Revoke Admin Passkey
            if (rawText.includes('@revokeadmin') || rawText.includes('@unadmin')) {
                db.setAdmin(chatId, false);
                console.log(`👥 Revoked admin status for ${chatId}.`);
                const unlockReply = "ایڈمن اسٹیٹس ختم کر دیا گیا ہے۔ اب روزانہ 20 سوالات کی حد لاگو ہے۔ 🌾";
                await sendTextMessage(session, chatId, unlockReply);
                db.saveMessage({ jid: chatId, role: 'bot', text: unlockReply, pushName, msgId: 'bot_' + Date.now() });
                return;
            }

            // Mode Switching Triggers (@Autonomous vs @General vs Default AgriBot Mode)
            const isAutonomousTrigger = /ایکٹ\s*ایز\s*ا[ٹٹ]ونوم[سک]\s*باٹ|ایکٹ\s*ایز\s*آٹونوم[سک]|act\s*as\s*autonomous(\s*bot|\s*agent)?|@autonomous|@agent|ا[ٹٹ]ونوم[سک]\s*باٹ/i.test(rawText);
            if (isAutonomousTrigger) {
                if (isMasterAdmin) {
                    db.setChatMode(chatId, 'autonomous');
                    console.log(`⚡ [AUTONOMOUS MODE ACTIVATED] Master Admin ${chatId} switched to Autonomous Agent Mode.`);
                    const stripped = userQuery.replace(/@autonomous|@agent/gi, '').trim();
                    if (!stripped || /ایکٹ\s*ایز\s*ا[ٹٹ]ونوم[سک]\s*باٹ|act\s*as\s*autonomous/i.test(stripped)) {
                        const modeReply = "⚡ **اٹونومک ایجنٹ موڈ فعال ہو گیا ہے!** (Autonomous Agent Mode Active)\n\nخوش آمدید باس! میں آپ کے ذاتی احکامات، گوگل سرچ اور پراپرٹی ٹاسکس انجام دینے کے لیے مکمل تیار ہوں۔\n\nاب آپ مجھ سے:\n1. 🔍 **گوگل و ویب سرچ:** انٹرنیٹ سے کوئی بھی لائیو معلومات، خبریں، مارکیٹ ریٹس یا اپڈیٹس تلاش کروا سکتے ہیں۔\n2. 🏢 **پراپرٹی و پلاٹس تلاش:** لاہور، ملتان، اسلام آباد یا کسی بھی علاقے میں Zameen.com اور OLX سے پلاٹس، مکانات یا دکانوں کی لسٹنگ لنکس سمیت نکلوا سکتے ہیں۔\n3. 📍 **لوکیشن پن سرچ:** واٹس ایپ پر لائیو لوکیشن بھیج کر اس کے اردگرد ریئل اسٹیٹ یا پراپرٹیز تلاش کروا سکتے ہیں۔\n4. 💼 **آزادانہ کام:** آپ جو بھی ہدایت دیں گے، میں خودکار طور پر انٹرنیٹ سے تلاش کر کے آپ کو رپورٹ دوں گا کہ 'یہ کام ہو گیا ہے'۔\n\n(نوٹ: باقی تمام کاشتکاروں کے لیے میں بدستور زرعی رہنمائی کا ماہر 'بشیر' کے طور پر کام کر رہا ہوں۔ واپس زرعی موڈ کے لیے کسی بھی وقت @AgriBot لکھیں)۔";
                        await sendTextMessage(session, chatId, modeReply);
                        db.saveMessage({ jid: chatId, role: 'bot', text: modeReply, pushName, msgId: 'bot_' + Date.now() });
                        return;
                    }
                } else {
                    console.log(`🚫 [UNAUTHORIZED] Non-admin ${chatId} attempted autonomous mode switch. Blocked.`);
                    const blockedReply = "محترم کاشتکار بھائی! میں زرعی رہنمائی کا ماہر (بشیر) ہوں۔ میں صرف آپ کی فصلوں، کھادوں، کیڑے مار ادویات اور منڈی ریٹس کے متعلق رہنمائی کے لیے حاضر ہوں۔ اپنی فصل سے متعلق اپنا مسئلہ بتائیں۔ 🌾";
                    await sendTextMessage(session, chatId, blockedReply);
                    db.saveMessage({ jid: chatId, role: 'bot', text: blockedReply, pushName, msgId: 'bot_' + Date.now() });
                    return;
                }
            }

            if (rawText.startsWith('@general')) {
                db.setChatMode(chatId, 'general');
                console.log(`🌐 User ${chatId} switched to General AI Mode.`);
                const stripped = userQuery.replace(/@general/i, '').trim();
                if (!stripped) {
                    const modeReply = "🌐 جنرل AI موڈ فعال ہو گیا ہے!\n\nاب آپ مجھ سے دنیا کے کسی بھی موضوع (تعلیم، سائنس، ٹیکنالوجی، تاریخ، روزمرہ معلومات وغیرہ) پر سوال پوچھ سکتے ہیں۔\n\n(یومیہ حد: 20 سوالات روزانہ۔ واپس زرعی رہنمائی پر جانے کے لیے کسی بھی وقت @AgriBot لکھیں)۔";
                    await sendTextMessage(session, chatId, modeReply);
                    db.saveMessage({ jid: chatId, role: 'bot', text: modeReply, pushName, msgId: 'bot_' + Date.now() });
                    return;
                }
            } else if (rawText.startsWith('@agribot') || rawText.startsWith('@agri')) {
                db.setChatMode(chatId, 'agri');
                console.log(`🌾 User ${chatId} switched to AgriBot Mode.`);
                const stripped = userQuery.replace(/@agribot/i, '').replace(/@agri/i, '').trim();
                if (!stripped) {
                    const modeReply = "🌿 زرعی رہنمائی موڈ (AgriBot) فعال ہے!\n\nمیں زرعی رہنمائی سے بشیر ہوں، آپ کا زرعی ماہر۔ اب آپ اپنی فصلوں، کھادوں، کیڑے مار ادویات، مویشی پالن اور موسم کے متعلق سوالات پوچھ سکتے ہیں۔\n\n(یومیہ حد: 20 سوالات روزانہ)۔";
                    await sendTextMessage(session, chatId, modeReply);
                    db.saveMessage({ jid: chatId, role: 'bot', text: modeReply, pushName, msgId: 'bot_' + Date.now() });
                    return;
                }
            }

            // 2.8. User Voice Delivery Preference Override (Pure Toggle Fast Path)
            if (!isAudio && userQuery) {
                const voicePref = agent.checkVoicePreferenceMessage(userQuery);
                if (voicePref && voicePref.isPure) {
                    let prefReply = '';
                    if (voicePref.preference === 'disable') {
                        db.setVoiceDisabled(chatId, true);
                        console.log(`🔇 [Voice Preference] User ${chatId} requested TEXT-ONLY mode.`);
                        prefReply = "جی بالکل کاشتکار بھائی! آپ کی پسند کے مطابق اب آپ کو صرف تحریری (ٹیکسٹ) میسج موصول ہو گا، وائس نوٹ نہیں بھیجا جائے گا۔ اگر دوبارہ وائس نوٹ چاہیے ہوں تو کسی بھی وقت 'وائس نوٹ بھیجو' لکھ کر بتا سکتے ہیں۔ فرمائیں میں آپ کی کیا زرعی خدمت کر سکتا ہوں؟ 🌿";
                    } else {
                        db.setVoiceDisabled(chatId, false);
                        console.log(`🔊 [Voice Preference] User ${chatId} RESUMED voice notes (audio enabled).`);
                        prefReply = "جی بہتر کاشتکار بھائی! آپ کے لیے وائس نوٹس دوبارہ شروع کر دیے گئے ہیں۔ اب آپ کو ہر رہنمائی کے ساتھ تفصیلی آڈیو بھی موصول ہوا کرے گی۔ فرمائیں میں آپ کی کیا زرعی مدد کر سکتا ہوں؟ 🌿";
                    }

                    await sendTextMessage(session, chatId, prefReply);
                    await reactToMessage(session, msgId, '✅');
                    db.saveMessage({ jid: chatId, role: 'user', text: userQuery, pushName, msgId });
                    db.saveMessage({ jid: chatId, role: 'bot', text: prefReply, pushName, msgId: 'bot_' + Date.now() });

                    // If resumed, deliver audio note for this confirmation as well
                    if (voicePref.preference === 'enable') {
                        try {
                            const oggPath = await agent.generateUrduVoice(prefReply);
                            if (oggPath && fs.existsSync(oggPath)) {
                                await sendVoiceNote(session, chatId, oggPath);
                            }
                        } catch (e) {}
                    }
                    return;
                }
            }

            // 3. Daily Rate Limiter Check (Strictly 20 msgs per user per day in BOTH Agri and General modes)
            const limitCheck = db.checkDailyLimit(chatId, 20);
            if (!limitCheck.allowed) {
                console.log(`⏳ Daily message limit reached for ${chatId} (${limitCheck.count}/20 msgs/day in ${db.getChatMode(chatId)} mode).`);
                const limitReply = limitCheck.message;

                await reactToMessage(session, msgId, '⏳');

                db.saveMessage({
                    jid: chatId,
                    role: 'user',
                    text: isAudio ? '[🎙️ وائس نوٹ - لمٹ ختم]' : (userQuery || '[Media/Photo]'),
                    pushName,
                    msgId
                });

                await sendTextMessage(session, chatId, limitReply);

                db.saveMessage({
                    jid: chatId,
                    role: 'bot',
                    text: limitReply,
                    pushName,
                    msgId: 'bot_limit_' + Date.now()
                });

                const config = agent.loadConfig();
                const isVoiceOff = chatId ? db.isVoiceDisabled(chatId) : false;
                if (config.features?.voiceNotes !== false && !isVoiceOff) {
                    try {
                        const oggPath = await agent.generateUrduVoice(limitReply);
                        if (oggPath && fs.existsSync(oggPath)) {
                            await sendVoiceNote(session, chatId, oggPath);
                        }
                    } catch (e) {}
                }
                return;
            }

            // 4. Process Multi-Agent Pipeline
            let userMessageText = userQuery || '[Media/Photo]';
            let cleanUserQuery = userQuery.replace(/@adminzeb/gi, '').trim();
            let replyText = '';
            try {
                if (isAudio) {
                    console.log(`🎙️ Downloading voice note from WAHA (${payload.media.url})...`);
                    const audioBuffer = await downloadMedia(payload.media.url);
                    console.log(`🎙️ Transcribing farmer voice note with Groq Whisper Large-v3 (${audioBuffer.length} bytes)...`);
                    const transcript = await agent.transcribeWithGroqWhisper(audioBuffer);

                    if (transcript && transcript.length > 0) {
                        console.log(`🎙️ Groq Whisper Transcription: "${transcript}"`);
                        if (transcript.toLowerCase().includes('adminzeb') || transcript.includes('ایڈمن زیب')) {
                            db.setAdmin(chatId, true);
                            console.log(`👑 Admin godmode activated via voice note for ${chatId}!`);
                        }
                        userMessageText = `[🎙️ وائس نوٹ]: ${transcript}`;
                        const cleanTranscript = transcript.replace(/@?adminzeb/gi, '').replace(/ایڈمن زیب/g, '').trim();
                        replyText = await agent.getQuickTextAnswer(cleanTranscript || transcript, chatId);
                    } else {
                        userMessageText = '[🎙️ وائس نوٹ]: (آواز واضح نہیں تھی)';
                        replyText = 'کاشتکار بھائی! آپ کی آواز صاف نہیں مل سکی۔ براہِ کرم اپنا سوال دوبارہ ریکارڈ کر کے بھیجیں یا لکھ کر بتائیں۔ 🌾';
                    }
                } else if (isLocation) {
                    const lat = payload.location?.latitude || payload.lat || payload.latitude || payload._data?.lat;
                    const lng = payload.location?.longitude || payload.lng || payload.longitude || payload._data?.lng;
                    const locName = payload.location?.name || payload.location?.description || payload.location?.address || payload.body || '';

                    userMessageText = `[📍 لوکیشن پن]: ${locName || `${lat}, ${lng}`}`;
                    const currentMode = db.getChatMode(chatId);

                    if (isMasterAdmin && (currentMode === 'autonomous' || /پراپرٹی|پلاٹ|زمین|مکان/i.test(cleanUserQuery))) {
                        const locQuery = `اس لوکیشن (${locName || `${lat}, ${lng}`}) کے قریب برائے فروخت پراپرٹی، پلاٹس اور مکانات تلاش کرو Zameen OLX`;
                        console.log(`📍 [AUTONOMOUS LOCATION PIN] Searching properties: "${locQuery}"...`);
                        replyText = await agent.getQuickTextAnswer(locQuery, chatId);
                    } else {
                        const weather = require('./weather');
                        const locWeather = await weather.getLiveWeather(null, 'آپ کا علاقہ', [lat, lng]);
                        replyText = locWeather ? `محترم کاشتکار بھائی! آپ کی بھیجی گئی لوکیشن کے مطابق:\n\n${locWeather}` : "محترم کاشتکار بھائی! آپ کی لوکیشن موصول ہوئی ہے۔ براہِ کرم اپنا زرعی سوال بھی ساتھ لکھیں یا وائس نوٹ بھیجیں۔ 🌿";
                    }
                } else if (isImage) {
                    const hasMeaningfulText = cleanUserQuery && cleanUserQuery.length > 4 && !/^(یہ|دیکھیں|تصویر|فوٹو|image|photo|pic|check|this)$/i.test(cleanUserQuery.trim());
                    userMessageText = cleanUserQuery ? `[📷 تصویر]: ${cleanUserQuery}` : '[📷 تصویر / فوٹو]';
                    if (hasMeaningfulText) {
                        console.log(`🧠 Calling AI LLM for image caption query: "${cleanUserQuery}" [ChatId: ${chatId}]...`);
                        const textAdvice = await agent.getQuickTextAnswer(cleanUserQuery, chatId);
                        replyText = `محترم کاشتکار بھائی! آپ نے جو تصویر بھیجی ہے، میں ابھی تصویر کو دیکھ نہیں سکتا، میں صرف وائس اور ٹیکسٹ پہ جواب دے سکتا ہوں۔ 🌾\n\nالبتہ آپ کے بتائے گئے مسئلے کے مطابق:\n${textAdvice}`;
                    } else {
                        replyText = "محترم کاشتکار بھائی! آپ نے جو تصویر بھیجی ہے، میں ابھی تصویر کو دیکھ نہیں سکتا، میں صرف وائس اور ٹیکسٹ پہ جواب دے سکتا ہوں۔ 🌾\n\nبراہِ کرم اپنی فصل کا نام اور جو بھی مسئلہ ہے، وہ بول کر وائس نوٹ بھیج دیں یا لکھ کر بتا دیں تاکہ میں فوری رہنمائی کر سکوں۔ 🌿";
                    }
                } else if (hasMedia && !cleanUserQuery) {
                    userMessageText = '[📁 میڈیا فائل]';
                    replyText = "محترم کاشتکار بھائی! آپ نے جو فائل بھیجی ہے، میں ابھی اسے دیکھ نہیں سکتا، میں صرف وائس اور ٹیکسٹ پہ جواب دے سکتا ہوں۔ براہِ کرم اپنا سوال بول کر یا لکھ کر بتا دیں۔ 🌿";
                } else {
                    console.log(`🧠 Calling AI LLM for query: "${cleanUserQuery}" [ChatId: ${chatId}]...`);
                    replyText = await agent.getQuickTextAnswer(cleanUserQuery, chatId);
                }
            } catch (agentErr) {
                console.error('Agent generation error:', agentErr.message);
                replyText = 'محترم کسان بھائی، زراعت سے متعلق اپنا سوال دوبارہ لکھیں تاکہ میں فوری رہنمائی کر سکوں۔ 🌿';
            }

            db.saveMessage({
                jid: chatId,
                role: 'user',
                text: userMessageText,
                pushName,
                msgId
            });

            console.log(`⚡ Instant Reply Prepared (${replyText.length} chars)`);

            // 5. Send text response via WAHA
            await sendTextMessage(session, chatId, replyText);
            console.log(`✅ Text reply delivered to ${chatId}`);

            // 6. Update reaction to ✅ (Done)
            await reactToMessage(session, msgId, '✅');

            db.saveMessage({
                jid: chatId,
                role: 'bot',
                text: replyText,
                pushName,
                msgId: 'bot_' + Date.now()
            });

            // 7. Synthesize & Send Voice Note (Respecting User Preference Override)
            const config = agent.loadConfig();
            const isVoiceOff = chatId ? db.isVoiceDisabled(chatId) : false;
            if (config.features?.voiceNotes !== false && !isVoiceOff) {
                try {
                    console.log(`🎙️ Synthesizing Urdu voice note for ${chatId}...`);
                    const oggPath = await Promise.race([
                        agent.generateUrduVoice(replyText),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Voice synthesis timeout (20s)')), 20000))
                    ]);
                    if (oggPath && fs.existsSync(oggPath)) {
                        console.log(`🎙️ Delivering native voice note to ${chatId}...`);
                        await sendVoiceNote(session, chatId, oggPath);
                        console.log(`✅ Voice note delivered to ${chatId}`);

                        db.saveMessage({
                            jid: chatId,
                            role: 'bot',
                            text: '[🎙️ وائس نوٹ بھیجا گیا]',
                            audioUrl: '/audio/' + path.basename(oggPath),
                            pushName,
                            msgId: 'bot_voice_' + Date.now()
                        });
                    }
                } catch (voiceErr) {
                    console.error('Voice note error:', voiceErr.message);
                }
            } else if (isVoiceOff) {
                console.log(`🔇 Voice note skipped for ${chatId} (User requested Text-Only mode).`);
            }
        }
    } catch (err) {
        console.error('Error handling WAHA event:', err.message);
    }
}

function getActiveSession() {
    return activeSessionName;
}

module.exports = {
    connectWebSocket,
    processWahaEvent,
    sendTextMessage,
    sendVoiceNote,
    reactToMessage,
    getActiveSession,
    wahaRequest,
    downloadMedia
};
