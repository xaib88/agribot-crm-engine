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
let activeSessionPhone = '923317824038@c.us';
let activeSessionLid = '';

async function updateActiveSession() {
    try {
        const res = await wahaRequest('GET', '/api/sessions');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            const working = res.data.find(s => s.status === 'WORKING');
            if (working) {
                activeSessionName = working.name;
                activeSessionPhone = working.me?.id || '923317824038@c.us';
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

            // Self-Chat Testing
            const isSelfChat = (chatId && (chatId.includes('923317824038') || (activeSessionPhone && chatId === activeSessionPhone)));
            if (payload.fromMe && !isSelfChat) return;

            // WhatsApp Group Handling: Silenced unless mentioned
            if (chatId.endsWith('@g.us')) {
                const lower = userQuery.toLowerCase();
                const isMentioned = lower.includes('بشیر') || lower.includes('basheer');
                if (!isMentioned) return;
            }

            const pushName = payload._data?.pushName || payload._data?.notifyName || 'Farmer';
            const isAudio = payload.hasMedia && (payload.media?.mimetype?.includes('audio') || payload.type === 'ptt');
            const hasMedia = payload.hasMedia;

            console.log(`\n📩 Incoming WhatsApp from ${chatId} (${pushName}): ${isAudio ? '[🎙️ Voice Note]' : `"${userQuery}"`}`);

            // 1. Thinking Reaction
            await reactToMessage(session, msgId, '💭');

            // 2. Passkey check
            const rawText = userQuery.toLowerCase();
            if (rawText.includes('@adminzeb') || rawText.includes('ایڈمن زیب')) {
                db.setAdmin(chatId, true);
                console.log(`👑 Admin godmode activated for ${chatId}!`);
                const adminReply = "وعلیکم السلام ایڈمن صاحب! آپ کا گوڈ موڈ ایکٹیو کر دیا گیا ہے۔ آپ کے تمام پیغامات اور وائس نوٹس پر کوئی ڈیلی لمٹ لاگو نہیں ہو گی۔ 👑";
                await sendTextMessage(session, chatId, adminReply);
                db.saveMessage({ jid: chatId, role: 'bot', text: adminReply, pushName, msgId: 'bot_' + Date.now() });
                return;
            }

            if (rawText.includes('@general')) {
                db.setAdmin(chatId, false);
                console.log(`👥 Reset user ${chatId} to general farmer tier.`);
                const unlockReply = "آپ کا اسٹیٹس جنرل کسان پر ری سیٹ کر دیا گیا ہے۔ اب روزانہ 20 سوالات کی حد لاگو ہے۔ 🌾";
                await sendTextMessage(session, chatId, unlockReply);
                db.saveMessage({ jid: chatId, role: 'bot', text: unlockReply, pushName, msgId: 'bot_' + Date.now() });
                return;
            }

            // 3. Daily Rate Limiter Check (20 msgs per user)
            const limitCheck = db.checkDailyLimit(chatId, 20);
            if (!limitCheck.allowed) {
                console.log(`⏳ Daily message limit reached for ${chatId} (${limitCheck.count}/20 msgs).`);
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
                if (config.features?.voiceNotes !== false) {
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
                } else if (hasMedia && !cleanUserQuery) {
                    userMessageText = '[📷 تصویر / فوٹو]';
                    replyText = 'محترم کاشتکار بھائی! میں نے آپ کی فصل کی تصویر موصول کر لی ہے۔ براہِ کرم اس کے ساتھ اپنی فصل کا نام اور مسئلہ (مثلاً پتے پیلے ہو رہے ہیں، سوراخ ہیں یا کیڑے کا حملہ ہے) بھی لکھ کر یا بول کر بتائیں تاکہ میں فوری اور درست حل تجویز کر سکوں۔ 🌿';
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

            // 7. Synthesize & Send Voice Note (Charon Voice)
            const config = agent.loadConfig();
            if (config.features?.voiceNotes !== false) {
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
