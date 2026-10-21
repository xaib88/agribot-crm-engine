const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const agent = require('./agent');
const db = require('./db');

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || 'https://waha-whatsapp-server.onrender.com';
const WAHA_API_KEY = process.env.WAHA_API_KEY || 'agri_secret_123';
const WAHA_WS_URL = process.env.WAHA_WS_URL || `wss://${new URL(WAHA_BASE_URL).hostname}/ws?x-api-key=${WAHA_API_KEY}`;

// Deduplication
const processedMsgIds = new Set();
function isDuplicate(id) {
    if (!id) return false;
    if (processedMsgIds.has(id)) return true;
    processedMsgIds.add(id);
    if (processedMsgIds.size > 2000) {
        const first = processedMsgIds.values().next().value;
        processedMsgIds.delete(first);
    }
    return false;
}

// REST helper
async function wahaRequest(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, WAHA_BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            headers: {
                'X-Api-Key': WAHA_API_KEY,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
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

// Send Text message
async function sendTextMessage(session, chatId, text) {
    return await wahaRequest('POST', '/api/sendText', {
        session,
        chatId,
        text
    });
}

// Send Voice Note
async function sendVoiceNote(session, chatId, oggPath) {
    try {
        if (!fs.existsSync(oggPath)) return;
        const audioBuffer = fs.readFileSync(oggPath);
        const base64Data = audioBuffer.toString('base64');

        return await wahaRequest('POST', '/api/sendVoice', {
            session,
            chatId,
            file: {
                mimetype: 'audio/ogg; codecs=opus',
                filename: 'voice-note.ogg',
                data: base64Data
            },
            convert: false
        });
    } catch (e) {
        console.error('Error sending voice note:', e.message);
    }
}

// Active session cache
let activeSessionName = 'default';

async function updateActiveSession() {
    try {
        const res = await wahaRequest('GET', '/api/sessions');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            const working = res.data.find(s => s.status === 'WORKING');
            if (working) {
                activeSessionName = working.name;
                console.log(`📡 WAHA Active Working Session: ${activeSessionName} (${working.me?.pushName || working.me?.id})`);
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
            const eventType = event.event;
            const session = event.session || activeSessionName;

            // ========================================================
            // 📞 INCOMING CALL REJECTION & AUTO-DISPATCH (NO CALLS ALLOWED)
            // ========================================================
            if (eventType && (eventType.startsWith('call') || eventType === 'call.received')) {
                const callerId = event.payload?.from || event.payload?.caller;
                console.log(`\n📞 [NO CALLS ALLOWED] Incoming WhatsApp Call detected from ${callerId}!`);
                if (callerId) {
                    // Try WAHA reject call API
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
                if (!payload || payload.fromMe) return;

                const msgId = payload.id;
                if (isDuplicate(msgId)) return;

                const chatId = payload.from;
                if (!chatId || chatId.endsWith('@broadcast')) return;

                // Handle missed call or call log notification from WhatsApp
                if (payload.type === 'call_log' || payload.type === 'missed_call') {
                    console.log(`\n📞 [MISSED CALL LOG] Call log detected from ${chatId}`);
                    const noCallMsg = "محترم کاشتکار بھائی! اس نمبر پر براہِ راست فون یا واٹس ایپ کال کی سہولت موجود نہیں ہے۔ 📵\n\nبراہِ کرم اپنا زرعی سوال یہاں لکھ کر بھیجیں یا وائس نوٹ (Voice Note) ریکارڈ کر کے بھیجیں، میں فوری رہنمائی کروں گا۔ شکریہ! 🌾";
                    await sendTextMessage(session, chatId, noCallMsg);
                    return;
                }

                const isGroup = chatId.endsWith('@g.us');
                const pushName = payload._data?.pushName || payload._data?.notifyName || '';
                const userQuery = payload.body ? payload.body.trim() : '';
                const hasMedia = payload.hasMedia && payload.media?.url;
                const isAudio = hasMedia && (payload.media?.mimetype?.includes('audio') || payload.media?.mimetype?.includes('ogg') || payload.media?.mimetype?.includes('opus'));

                // 1. Ignore empty status updates, reactions, or non-actionable events
                if (!userQuery && !isAudio && !hasMedia) {
                    return;
                }

                // 2. Group Chat Protection: Only reply in WhatsApp groups if explicitly mentioned
                if (isGroup) {
                    const mentionsBasheer = userQuery && (userQuery.toLowerCase().includes('بشیر') || userQuery.toLowerCase().includes('basheer'));
                    if (!mentionsBasheer) {
                        return; // Silent in groups unless tagged
                    }
                }

                console.log(`\n📩 Incoming WhatsApp from ${chatId} (${pushName}): ${isAudio ? '[🎙️ Voice Note]' : (userQuery ? `"${userQuery}"` : '[📷 Media]')}`);

                // Check Admin Godmode Passkey (@adminzeb)
                let isAdminPasskey = userQuery && userQuery.toLowerCase().includes('@adminzeb');
                if (isAdminPasskey) {
                    db.setAdmin(chatId, true);
                    console.log(`👑 Admin Godmode activated for ${chatId}! Unlimited access granted.`);
                }

                // 1. Instantly react with 💭 (thinking cloud) & mark seen
                await reactToMessage(session, msgId, '💭');
                sendSeen(session, chatId).catch(() => {});

                // If user just sent @adminzeb to unlock themselves
                if (userQuery && userQuery.trim().toLowerCase() === '@adminzeb') {
                    const unlockReply = "👑 ایڈمن موڈ فعال ہو گیا ہے! آپ کے لیے تمام روزانہ حدود ختم کر دی گئی ہیں، اب آپ لامحدود میسجز اور سوالات کر سکتے ہیں۔ 🚀";
                    await sendTextMessage(session, chatId, unlockReply);
                    await reactToMessage(session, msgId, '👑');
                    db.saveMessage({ jid: chatId, role: 'user', text: userQuery, pushName, msgId });
                    db.saveMessage({ jid: chatId, role: 'bot', text: unlockReply, pushName, msgId: 'bot_' + Date.now() });
                    return;
                }

                // 2. Daily Rate Limiter Check (20 msgs per user, 12h cool-off, bypassed by @adminzeb)
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

                    // Deliver polite voice note notification
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

                // 3. Process with Multi-Agent Pipeline (Audio or Text)
                let userMessageText = userQuery || '[Media/Photo]';
                // Strip @adminzeb passkey from text query if present
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
                            // Check if voice note mentioned adminzeb
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

                // Save incoming message to CRM (with transcript!)
                db.saveMessage({
                    jid: chatId,
                    role: 'user',
                    text: userMessageText,
                    pushName,
                    msgId
                });

                console.log(`⚡ Instant Reply Prepared (${replyText.length} chars)`);

                // 3. Send text response via WAHA
                await sendTextMessage(session, chatId, replyText);
                console.log(`✅ Text reply delivered to ${chatId}`);

                // 4. Update reaction to ✅ (Done)
                await reactToMessage(session, msgId, '✅');

                // 5. Save bot reply to CRM
                db.saveMessage({
                    jid: chatId,
                    role: 'bot',
                    text: replyText,
                    pushName,
                    msgId: 'bot_' + Date.now()
                });

                // 6. Synthesize & Send Voice Note asynchronously
                const config = agent.loadConfig();
                if (config.features?.voiceNotes !== false) {
                    (async () => {
                        try {
                            console.log(`🎙️ Synthesizing Urdu voice note for ${chatId}...`);
                            const oggPath = await agent.generateUrduVoice(replyText);
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
                    })();
                }
            }
        } catch (err) {
            console.error('Error handling WebSocket message:', err.message);
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

function getActiveSession() {
    return activeSessionName;
}

module.exports = {
    connectWebSocket,
    sendTextMessage,
    sendVoiceNote,
    reactToMessage,
    getActiveSession,
    wahaRequest,
    downloadMedia
};
