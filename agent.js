const fs = require('fs');
const path = require('path');
const weatherModule = require('./weather');
const knowledgeModule = require('./knowledge');
const voiceModule = require('./voice');
const mandiModule = require('./mandi');
const db = require('./db');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
    let cfg = {};
    try {
        cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (e) {
        cfg = {
            botName: "بشیر (Basheer)",
            creator: "شاہزیب ارشاد (زرعی ماہر)",
            llmProvider: "gemini",
            geminiModel: "gemini-3.8-flash",
            groqModel: "llama-3.3-70b-versatile",
            groqWhisperModel: "whisper-large-v3",
            features: { voiceNotes: true, weather: true, nayasaveraKnowledge: true, livestock: true }
        };
    }
    cfg.geminiApiKey = process.env.GEMINI_API_KEY || cfg.geminiApiKey || '';
    cfg.groqApiKey = process.env.GROQ_API_KEY || cfg.groqApiKey || '';
    return cfg;
}

// Master System Prompt for Agricultural Mode (Basheer) with Uplift AI Anti-Hallucination Rules
const AGRI_MASTER_PROMPT = `آپ 'بشیر' (Basheer) ہیں۔ آپ پاکستان کے تمام کسانوں اور کاشتکاروں کے لیے ایک انتہائی مستند، مخلص، باادب، تیز رفتار اور تجربہ کار مرد زرعی ماہر ہیں۔

آپ کی مستقل شخصیت، پہچان اور تربیت کے بنیادی اصول:
1. شناخت اور خالق کے نام کی رازداری کا اصول (Strict Creator Privacy Rule):
- آپ کا نام 'بشیر' ہے۔
- اپنے ابتدائی تعارف (Intro)، سلام کے جواب، یا عام سوالات کے دوران خود سے شاہزیب ارشاد کا نام ہرگز نہ لیں!
- عام تعارف اور سلام کے جواب میں ہمیشہ یہ الفاظ استعمال کریں: 'خوش آمدید کاشتکار بھائی! میں بشیر ہوں۔ 🚜\nگندم، کپاس، چاول، مکئی یا کماد کی دیکھ بھال میں کوئی بھی پریشانی ہو، آپ بول کر وائس نوٹ بھیجیں یا لکھ کر بتائیں۔ میں فوری رہنمائی کے لیے حاضر ہوں۔' (اگر صارف نے سلام کیا ہو تو 'وعلیکم السلام!' لگائیں)
- صرف اور صرف اس وقت شاہزیب ارشاد کا نام لیں جب کوئی کسان یا صارف صریحاً پوچھے کہ: 'تمہیں کس نے بنایا ہے؟'، 'تمہارا بانی یا خالق کون ہے؟'، 'Who created you?' یا خود نام لے کر پوچھے کہ 'شاہزیب ارشاد کون ہے؟'۔ اس وقت باادب بتائیں: 'مجھے معروف زرعی ماہر شاہزیب ارشاد (بانی زراعت گائیڈنس) نے کاشتکاروں کی بروقت رہنمائی کے لیے تیار کیا ہے۔ 🌿'
2. تربیت اور قابلیت (Training & Core Capabilities):
- اگر کوئی پوچھے کہ 'تمہیں کیا کیا ٹریننگ دی گئی ہے؟' یا 'تم کیا جانتے ہو؟'، تو فخر اور دیانت داری سے بتائیں:
'مجھے پاکستان کی تمام اہم فصلوں (گندم، کپاس، چاول، مکئی، کماد، باغات و سبزیاں)، کیڑوں اور بیماریوں کے مستند سائنسی علاج (سنجینٹا، ایف ایم سی، بائر کی جدید ادویات)، کھادوں کے متوازن استعمال، آئی بی ایم و سیٹلائٹ موسمیاتی پیش گوئی، اور مویشی پالن کی مکمل تربیت دی گئی ہے۔ 🌾'
3. مصدقہ معلومات (Zero Hallucination): آپ نے صرف اور صرف مستند زرعی ڈیٹا اور سائنسی حقائق کے مطابق جواب دینا ہے۔ خود سے کبھی فرضی دوائی کا نام، غلط فارمولیشن، یا من گھڑت فی ایکڑ مقدار مت بتائیں۔
4. جنس اور صیغہ (Strictly Male): آپ مرد زرعی ماہر 'بشیر' ہیں۔ اپنی گفتگو میں ہمیشہ مذکر صیغے استعمال کریں (مثلاً: 'میں آپ کی مدد کر سکتا ہوں'، 'میں رہنمائی فراہم کرتا ہوں'، 'میں حاضر ہوں')۔ مؤنث صیغے (مثلاً: 'کر سکتی ہوں') ہرگز استعمال نہ کریں۔
5. جواب کا حجم اور تفصیل کا اصول (Response Length & Detail Control):
- عام سوالات (Default): ہمیشہ صرف 2 سے 3 جامع، پر اثر اور ٹو دی پوائنٹ لائنوں میں جواب دیں! فضول تمہید مت باندھیں۔ سیدھا بیماری/کیڑے کا نام، درست سپرے یا کھاد کا نام، اور فی ایکڑ مقدار بتائیں۔
- تفصیلی تقاضا (When User Requests Detail): صرف اس صورت میں مفصل، جامع اور لمبا (Detailed) جواب دیں جب کسان خود کہے کہ 'تفصیل سے بتاؤ'، 'ڈیٹیل میں سمجھاؤ'، 'لمبا جواب چاہیے'، 'وضاحت کرو' یا اسی طرح تفصیلی رہنمائی مانگے۔ اس وقت ہر پہلو (وجوہات، طریقہ استعمال، وقت، احتیاطیں) تفصیل سے بیان کریں۔ مناسب زرعی ایموجیز (🌾، 🌿، 🚜، 🧴، 🌧️) استعمال کریں۔
6. گفتگو کا تسلسل (Multi-Turn Context): پچھلی گفتگو کا مکمل دھیان رکھیں۔ اگر کسان 'کیوں؟'، 'کب کریں؟'، یا 'کتنی مقدار؟' پوچھے تو پچھلے سوال کے تناظر میں سائنسی وجہ سمجھائیں۔
7. موسم اور لوکیشن کا اصول (Weather Location Rule): اگر کسان موسم، بارش یا درجہ حرارت کے متعلق پوچھے اور اس کے سوال یا گفتگو میں شہر/ضلع کا نام موجود نہ ہو، تو خود سے فرضی موسم کبھی نہ بتائیں! کسان سے احترام کے ساتھ کہیں کہ وہ اپنے شہر یا ضلع کا نام بتائے تاکہ درست سیٹلائٹ رپورٹ دی جا سکے۔
8. لنکس اور تشہیر کی ممانعت (STRICT NO LINKS): آپ نے اپنے جواب کے اندر کوئی یوٹیوب لنک، چینل لنک، ویب سائٹ لنک، فون نمبر یا تشہیری جملہ بالکل نہیں لکھنا۔ لنک صرف سسٹم خود بخود ضرورت پڑنے پر شامل کرے گا۔
9. کالز کی ممانعت (STRICTLY NO CALLS): اس واٹس ایپ نمبر پر براہِ راست فون یا واٹس ایپ کال کی سہولت بالکل موجود نہیں ہے۔ اگر کوئی کسان کال کرنے کا پوچھے یا فون نمبر مانگے، تو احترام کے ساتھ واضح بتائیں کہ اس نمبر پر کال ممکن نہیں ہے، آپ صرف واٹس ایپ میسج یا وائس نوٹ بھیج کر رہنمائی حاصل کر سکتے ہیں۔
10. سلام اور آداب کا سخت اصول (STRICT GREETING RULE): جب تک صارف خود واضح الفاظ میں سلام (مثلاً 'سلام'، 'اسلام علیکم'، 'السلام علیکم'، 'ہیلو') نہ کہے، آپ نے کبھی بھی خود سے 'وعلیکم السلام' یا 'سلام' نہیں کہنا! اگر صارف نے سیدھا سوال پوچھا ہے، تو بغیر کسی سلام کے، سیدھا اور براہِ راست جواب دیں۔
11. رومن اردو اور زرعی اصطلاحات کی گہری سمجھ (Roman Urdu Agricultural Comprehension):
- پاکستانی کسان جب رومن اردو (انگریزی حروف) میں لکھیں تو ان کے تمام زرعی الفاظ اور مسائل کو 100% سمجھ کر اردو رسم الخط میں باادب اور رہنمائی سے بھرپور جواب دیں:
  * Chawal / Dhan / Munji = چاول یا دھان (Rice / Paddy)
  * Gandum / Kanak = گندم (Wheat)
  * Kapas / Phutti = کپاس (Cotton)
  * Makai / Makki / Chhalli = مکئی (Maize / Corn)
  * Kamad / Ganna = کماد یا گنا (Sugarcane)
  * Khad / Ureya / DAP / Potash = کھادیں اور غذائیت
  * Safaid Makhi / Teela / Sundi = کیڑے (Whitefly, Aphids, Bollworms)
  * Spray / Dawai / Nuskha / Ilaj = سپرے اور علاج
- رومن اردو کے کسی لفظ (جیسے Chawal) کو کبھی بھی موسم (Hawa) نہ سمجھیں!
12. منڈی ریٹس اور مصدقہ ذریعہ (Mandi Rates & Source Rule):
- جب بھی کسی فصل کے منڈی ریٹس (Mandi Rates) یا اجناس کی قیمتیں بتائیں، تو آخر میں تاریخ اور مصدقہ ذریعہ لازمی درج کریں:
  📡 ذریعہ (Source): ایگریکلچر مارکیٹنگ انفارمیشن سروس (AMIS) پنجاب / مارکیٹ کمیٹی غلہ منڈی (amis.pk)`;

// Master System Prompt for General Mode (@General)
const GENERAL_MASTER_PROMPT = `آپ 'بشیر' (Basheer) ہیں۔ 
اگرچہ آپ بنیادی طور پر پاکستان کے ایک تجربہ کار زرعی ماہر ہیں، لیکن اس جنرل موڈ میں آپ صارف کے دنیا بھر کے تمام عمومی سوالات (سائنس، ادب، تعلیم، ٹیکنالوجی، تاریخ، شعر و شاعری، کاروبار اور روزمرہ مسائل) کا بھی شائستہ، سنجیدہ اور فصیح انداز میں درست جواب دیتے ہیں۔

اہم اصول:
1. خالق کے نام کی سختی (Creator Privacy): اپنے عام تعارف میں شاہزیب ارشاد کا نام خود سے ہرگز مت لیں۔ صرف اس وقت بتائیں جب صارف واضح طور پر پوچھے کہ 'تمہیں کس نے بنایا ہے؟' یا 'شاہزیب ارشاد کون ہے؟'۔
2. ٹریننگ و تربیت: اگر کوئی پوچھے کہ 'تمہیں کیا کیا ٹریننگ دی گئی ہے؟' تو بتائیں کہ آپ کو پاکستان کی زراعت، جدید کاشتکاری، فصلوں، بیماریوں کے علاج اور کھادوں کے ساتھ ساتھ عمومی علوم و فنون کی مکمل تربیت دی گئی ہے۔
3. صیغہ: آپ مرد (Male) ہیں، ہمیشہ مذکر صیغہ استعمال کریں (مثلاً: 'کر سکتا ہوں'، 'بتاتا ہوں')۔
4. جواب کا حجم: عام طور پر 2 سے 3 لائنوں میں ٹو دی پوائنٹ جواب دیں! اگر صارف 'تفصیل سے بتاؤ' کہے تو تفصیلی جواب دیں۔
5. سلام کا اصول: جب تک صارف خود سلام نہ کرے، خود سے 'وعلیکم السلام' ہرگز نہ کہیں۔
6. لنکس کی ممانعت: کوئی یوٹیوب یا بیرونی لنک مت لکھیں۔`;

// Multi-turn context builder for Gemini API
function buildGeminiContents(chatId, currentQueryText, inlineAudio = null) {
    const contents = [];
    if (chatId) {
        const chat = db.getChat(chatId);
        if (chat && Array.isArray(chat.messages)) {
            // Get up to last 6 messages
            const raw = chat.messages.slice(-6);
            for (const m of raw) {
                const role = m.role === 'bot' ? 'model' : 'user';
                let text = m.text ? m.text.replace(/https?:\/\/[^\s]+/gi, '').replace(/زراعت گائیڈنس:?/g, '').trim() : '';
                if (text && !text.startsWith('[🎙️') && !text.startsWith('[Media')) {
                    if (contents.length === 0) {
                        if (role === 'user') contents.push({ role, parts: [{ text }] });
                    } else {
                        const lastRole = contents[contents.length - 1].role;
                        if (lastRole !== role) {
                            contents.push({ role, parts: [{ text }] });
                        }
                    }
                }
            }
        }
    }

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents.pop();
    }

    const currentParts = [];
    if (inlineAudio) {
        currentParts.push(inlineAudio);
    }
    if (currentQueryText) {
        currentParts.push({ text: currentQueryText });
    }

    contents.push({
        role: 'user',
        parts: currentParts.length > 0 ? currentParts : [{ text: 'معلومات و رہنمائی' }]
    });

    return contents;
}

// Unified Gemini Flash Caller with strict 6s timeout & anti-hang protection
async function callGemini(systemPrompt, contents, apiKey, modelName = 'gemini-3.8-flash', maxTokens = 350) {
    const modelsToTry = [modelName, 'gemini-3.5-flash-lite'];
    
    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(6000), // 6-second strict timeout
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: contents,
                    generationConfig: {
                        temperature: 0.2, // Low temperature for high precision & anti-hallucination
                        maxOutputTokens: maxTokens
                    }
                })
            });

            if (!response.ok) {
                console.warn(`Gemini (${model}) returned HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
                let text = data.candidates[0].content.parts[0].text.trim();
                text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
                // Sanitize any occasional feminine leakage to male
                text = text.replace(/کر سکتی ہوں/g, 'کر سکتا ہوں')
                           .replace(/سکتی ہوں/g, 'سکتا ہوں')
                           .replace(/بتاتی ہوں/g, 'بتاتا ہوں');
                return text;
            }
        } catch (e) {
            console.warn(`Fetch error with Gemini (${model}):`, e.message);
        }
    }

    return null;
}

// Groq API Caller with strict 5s timeout
async function callGroq(systemPrompt, contents, apiKey, model = 'qwen/qwen3.8-27b', maxTokens = 350) {
    try {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        
        // Convert Gemini contents to OpenAI messages format
        const messages = [{ role: "system", content: systemPrompt }];
        for (const c of contents) {
            const role = c.role === 'model' ? 'assistant' : 'user';
            const text = c.parts.map(p => p.text || '').join(' ').trim();
            if (text) messages.push({ role, content: text });
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            signal: AbortSignal.timeout(5000), // 5-second strict timeout
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: maxTokens,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            console.warn(`Groq returned HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
            let text = data.choices[0].message.content.trim();
            text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
            text = text.replace(/کر سکتی ہوں/g, 'کر سکتا ہوں')
                       .replace(/سکتی ہوں/g, 'سکتا ہوں')
                       .replace(/بتاتی ہوں/g, 'بتاتا ہوں');
            return text;
        }
    } catch (e) {
        console.error("Groq API error:", e.message);
    }
    return null;
}

// =========================================================================
// 👑 BOSS Z: MASTER SUPERVISOR & AUTONOMOUS QUALITY GATE (نگرانِ اعلیٰ)
// =========================================================================
function bossQualityGate(userQuery, botReply, chatId, currentMode) {
    let text = botReply ? botReply.trim() : '';

    // 1. GREETING POLICE: Zero uninvited "وعلیکم السلام"
    const userSaidSalam = /سلام|اسلام|السلام|ہیلو|hello|hi|aoa|salam/i.test(userQuery);
    if (!userSaidSalam) {
        // Strip any uninvited greetings from the start of the message
        text = text.replace(/^(وعلیکم\s*السلام\s*[!،.,:؛-]*|و\s*علیکم\s*السلام\s*[!،.,:؛-]*|السلام\s*علیکم\s*[!،.,:؛-]*|سلام\s*[!،.,:؛-]*)/gi, '').trim();
        text = text.replace(/^(وعلیکم السلام ورحمۃ اللہ وبرکاتہ[!،.]*)/gi, '').trim();
    }

    // 2. MALE PERSONA ENFORCEMENT (Strictly مذکر)
    text = text.replace(/کر سکتی ہوں/g, 'کر سکتا ہوں')
               .replace(/سکتی ہوں/g, 'سکتا ہوں')
               .replace(/بتاتی ہوں/g, 'بتاتا ہوں')
               .replace(/دیکھتی ہوں/g, 'دیکھتا ہوں')
               .replace(/سمجھتی ہوں/g, 'سمجھتا ہوں');

    // 3. LINK & PROMOTIONAL QUARANTINE
    text = text.replace(/https?:\/\/[^\s]+/gi, '').replace(/^زراعت\s*گائیڈنس\s*[:\-]\s*/gi, '').trim();

    // 4. LENGTH & CONCISENESS POLICE
    const isDetailRequested = /تفصیل|ڈیٹیل|تفصیلی|وضاحت|لمبا|detail|detailed|in depth|explain fully/i.test(userQuery);
    if (!isDetailRequested && currentMode === 'agri') {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length > 5) {
            text = lines.slice(0, 4).join('\n');
        }
    }

    // 5. YOUTUBE LINK 24-HOUR GATE (Strictly once per 24 hours per farmer in Agri Mode only)
    if (currentMode === 'agri' && chatId && db.shouldSendYtLink(chatId)) {
        text += `\n\nhttps://www.youtube.com/@AgricultureGuidance/`;
        db.markYtLinkSent(chatId);
    }

    return text;
}

// Master LLM Dispatcher with Zero-Hang Failover
async function dispatchLLM(systemPrompt, contents, config, maxTokens = 350) {
    if (config.llmProvider === 'groq' && config.groqApiKey) {
        const groqReply = await callGroq(systemPrompt, contents, config.groqApiKey, config.groqModel || 'qwen/qwen3.8-27b', maxTokens);
        if (groqReply) return groqReply;
        console.warn("Groq failed, falling back to Gemini...");
    }

    const geminiReply = await callGemini(
        systemPrompt, 
        contents, 
        config.geminiApiKey, 
        config.geminiModel || 'gemini-3.8-flash', 
        maxTokens
    );
    if (geminiReply) return geminiReply;

    // Instant fallback to Groq (<1s) if Gemini hits 20/day limit or spikes
    if (config.groqApiKey) {
        console.log("⚡ Gemini rate limit / spike. Switching instantly to Groq Qwen 3.8-27B (<1s)...");
        const groqFallback = await callGroq(systemPrompt, contents, config.groqApiKey, 'qwen/qwen3.8-27b', maxTokens);
        if (groqFallback) return groqFallback;
    }

    return "محترم کاشتکار بھائی! میں آپ کے زرعی سوال کا جائزہ لے رہا ہوں۔ براہِ کرم اپنا سوال دوبارہ لکھیں یا وائس نوٹ بھیجیں تاکہ میں فوری اور درست رہنمائی کر سکوں۔ 🌿";
}

// Main Text Responder: 100% Routed through LLM with RAG and Anti-Hallucination
async function getQuickTextAnswer(userText, chatId = null) {
    const config = loadConfig();
    let query = userText ? userText.trim() : '';

    let currentMode = chatId ? db.getChatMode(chatId) : 'agri';
    const lower = query.toLowerCase();

    // 1. Explicit Mode Switch Triggers
    if (lower.startsWith('@general')) {
        currentMode = 'general';
        if (chatId) db.setChatMode(chatId, 'general');
        query = query.replace(/@general/i, '').trim();

        if (!query) {
            return "🌐 جنرل AI موڈ فعال ہو گیا ہے!\n\nاب آپ مجھ سے دنیا کے کسی بھی موضوع (تعلیم، سائنس، ٹیکنالوجی، تاریخ، روزمرہ معلومات، کاروبار وغیرہ) پر سوال پوچھ سکتے ہیں۔\n\nواپس زرعی رہنمائی پر جانے کے لیے کسی بھی وقت @AgriBot لکھیں۔";
        }
    } else if (lower.startsWith('@agribot') || lower.startsWith('@agri')) {
        currentMode = 'agri';
        if (chatId) db.setChatMode(chatId, 'agri');
        query = query.replace(/@agribot/i, '').replace(/@agri/i, '').trim();

        if (!query) {
            return "🌿 ایگری بوٹ موڈ فعال ہو گیا ہے!\n\nمیں بشیر ہوں، آپ کا زرعی ماہر۔ اب آپ اپنی فصلوں، کھادوں، کیڑے مار ادویات، مویشی پالن اور موسم کے متعلق سوالات پوچھ سکتے ہیں۔";
        }
    }

    // Check if user is asking for a detailed/longer answer
    const isDetailRequested = /تفصیل|ڈیٹیل|تفصیلی|وضاحت|لمبا|detail|detailed|in depth|explain fully/i.test(query);
    const maxTokens = isDetailRequested ? 1000 : 350;

    // Smart Intent Router: If in General Mode but user asks about Agriculture, Crops, Weather, Creator, or Training
    const isAgriOrIdentityQuery = /گندم|کپاس|چاول|دھان|مکئی|کماد|گنا|سپرے|کھاد|یوریا|ڈی اے پی|پوٹاش|کیڑا|تیلا|سنڈی|مکھی|بیماری|زنگ|فصل|کسان|ایکڑ|ڈوز|شاہزیب|شہزے برشاد|بشیر|ٹریننگ|تربیت|کون ہو|کس نے بنایا|زراعت|موسم|بارش/i.test(query);
    if (currentMode === 'general' && isAgriOrIdentityQuery) {
        console.log(`🌾 Agri/Identity query detected in General Mode. Auto-switching to Basheer Agri Persona!`);
        currentMode = 'agri';
        if (chatId) db.setChatMode(chatId, 'agri');
    }

    // Pure Greeting / Intro Fast Path (Exact user intro, instant delivery, zero hallucination)
    const normalizedGreeting = query.replace(/[!؟?،.\s]/g, '');
    const isPureGreeting = /^(سلام|السلامعلیکم|اسلامعلیکم|وعلیکمالسلام|ہیلو|hello|hi|aoa|salam|کونہو|تمکونہو|تعارف|اپناتعارف)$/i.test(normalizedGreeting);
    if (isPureGreeting) {
        const userSaidSalam = /سلام|اسلام|السلام|aoa|salam/i.test(query);
        const prefix = userSaidSalam ? "وعلیکم السلام! " : "";
        const introReply = `${prefix}خوش آمدید کاشتکار بھائی! میں بشیر ہوں۔ 🚜\n\nگندم، کپاس، چاول، مکئی یا کماد کی دیکھ بھال میں کوئی بھی پریشانی ہو، آپ بول کر وائس نوٹ بھیجیں یا لکھ کر بتائیں۔ میں فوری رہنمائی کے لیے حاضر ہوں۔`;
        return bossQualityGate(query, introReply, chatId, currentMode);
    }

    // ========================================================
    // BRANCH A: GENERAL MODE (@General)
    // ========================================================
    if (currentMode === 'general') {
        console.log(`🌐 Processing in GENERAL MODE via Gemini: "${query}" (Detailed: ${isDetailRequested})`);
        const contents = buildGeminiContents(chatId, query || 'معلومات');
        let reply = await dispatchLLM(GENERAL_MASTER_PROMPT, contents, config, maxTokens);
        if (!reply) return "معذرت، میں آپ کے سوال کو سمجھ نہیں سکا۔ براہِ کرم دوبارہ واضح الفاظ میں پوچھیں۔";
        return bossQualityGate(query, reply, chatId, 'general');
    }

    // ========================================================
    // BRANCH B: AGRIBOT MODE (@AgriBot - Default)
    // ========================================================
    console.log(`🌿 Processing in AGRIBOT MODE via Gemini: "${query}" (Detailed: ${isDetailRequested})`);

    let dynamicSystemPrompt = AGRI_MASTER_PROMPT;
    if (isDetailRequested) {
        dynamicSystemPrompt += `\n\n[خصوصی ہدایت]: کسان نے تفصیلی اور مفصل جواب کا تقاضا کیا ہے۔ اس لیے اب آپ نے تفصیلی انداز میں وجوہات، طریقہ استعمال، وقت، کھاد/زہر کی ڈوز، اور تمام احتیاطیں مکمل کھول کر بیان کرنی ہیں۔`;
    }

    // 1. Check Mandi Rates Intent (AMIS Punjab Grounding)
    if (mandiModule.isMandiQuery(query)) {
        console.log(`📊 Live Mandi Rates lookup for: "${query}"...`);
        const mandiCity = weatherModule.detectCity(query);
        return mandiModule.getMandiRatesReport(query, mandiCity?.name);
    }

    // 2. Check Weather Intent (Strictly when weather is asked or city alone is entered)
    const isWeather = weatherModule.isWeatherQuery(query);
    const isCityOnly = weatherModule.isCityOnlyQuery(query);
    const detectedCity = weatherModule.detectCity(query);

    if (isWeather || isCityOnly) {
        if (detectedCity) {
            console.log(`🌤️ Live weather lookup for: ${detectedCity.name} (${detectedCity.en})...`);
            const rawWeather = await weatherModule.getLiveWeather(detectedCity.en, detectedCity.name, detectedCity.coords);
            if (rawWeather) {
                // Return verified weather directly with Source: IBM Weather
                return rawWeather;
            }
        } else {
            // Weather asked without a city -> Prompt user for city to avoid hallucination!
            return "کاشتکار بھائی! درست اور تازہ ترین موسم بتانے کے لیے براہِ کرم اپنے شہر یا ضلع کا نام بتائیں (مثلاً ملتان، ساہیوال، وہاڑی، بہاولپور وغیرہ) تاکہ میں وہاں کا درجہ حرارت، نمی، ہوا کی رفتار اور بارش کی پیش گوئی بتا سکوں۔ 🌧️";
        }
    }

    // RAG Knowledge Base Grounding (Syngenta, NARC, approved dosages)
    const contextData = knowledgeModule.searchKnowledge(query);
    if (contextData) {
        dynamicSystemPrompt += `\n\n[مصدقہ زرعی ڈیٹا بیس (Verified Agricultural Knowledge Base)]:\n${contextData}\n\n[سخت ہدایت]: آپ نے جواب میں اوپر دیے گئے مصدقہ زرعی ڈیٹا کی بنیاد پر درست دوا، کیمیکل اور فی ایکڑ مقدار بتانی ہے تاکہ کسان کو بالکل درست رہنمائی ملے۔`;
    }

    // Build multi-turn context
    const contents = buildGeminiContents(chatId, query);

    // Call Gemini 3.5 Flash Lite with adaptive token budget
    let reply = await dispatchLLM(dynamicSystemPrompt, contents, config, maxTokens);

    if (!reply) {
        reply = "کاشتکار بھائی! آپ کی فصل یا مویشیوں میں کیا مسئلہ درپیش ہے؟ ایک جملے میں بتائیں تاکہ میں فوری اور درست حل بتا سکوں۔ 🌿";
    }

    // Pass through Boss Z Quality Gate (Anti-Salam, Anti-Spam, Male Persona, 2-3 Lines)
    return bossQualityGate(query, reply, chatId, currentMode);
}

// Whisper Large-v3 STT via Groq Cloud (<700ms ultra-accurate transcription)
async function transcribeWithGroqWhisper(audioBuffer, filename = 'voice.ogg') {
    const config = loadConfig();
    const apiKey = config.groqApiKey;
    
    try {
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const promptText = 'بشیر، شاہزیب ارشاد، زراعت گائیڈنس، ایگری بوٹ، گندم، کپاس، چاول، مکئی، کماد، سفید مکھی، سست تیلا، گلابی سنڈی، لشکری سنڈی، جڑی بوٹیاں، کھاد، یوریا، ڈی اے پی، پوٹاش، سپرے، بیماری، زنگ، مویشی، کسان، ایکڑ، ڈوز، ٹریننگ، تربیت، فصل، بیج';

        const parts = [];
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n`);
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nur\r\n`);
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${promptText}\r\n`);
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/ogg\r\n\r\n`);

        const preBuffer = Buffer.from(parts.join(''), 'utf8');
        const postBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
        const fullBody = Buffer.concat([preBuffer, audioBuffer, postBuffer]);

        const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': fullBody.length
            },
            signal: AbortSignal.timeout(8000), // 8s timeout for STT
            body: fullBody
        });

        const data = await resp.json();
        if (data && data.text) {
            let clean = data.text.trim();
            // Automatically correct phonetic mishearings for the creator's name
            clean = clean.replace(/شہزے برشاد/gi, 'شاہزیب ارشاد')
                         .replace(/شہزیب برشاد/gi, 'شاہزیب ارشاد')
                         .replace(/شہزیب ارشاد/gi, 'شاہزیب ارشاد')
                         .replace(/شاہ زیب ارشاد/gi, 'شاہزیب ارشاد')
                         .replace(/شاہ زیب/gi, 'شاہزیب');
            return clean;
        }
    } catch (e) {
        console.error('Groq Whisper STT error:', e.message);
    }
    return null;
}

// Process incoming Audio from farmer (<3 sec) with Whisper Large-v3 + Gemini 3.5 Flash Lite
async function getQuickAudioAnswer(audioBuffer, mimeType = 'audio/ogg', chatId = null) {
    console.log('🎙️ Transcribing farmer voice note with Groq Whisper Large-v3...');
    const transcript = await transcribeWithGroqWhisper(audioBuffer);

    if (transcript && transcript.length > 0) {
        console.log(`🎙️ Whisper Large-v3 Transcribed: "${transcript}"`);
        
        // Pass transcribed text into full Agri reasoning engine with RAG & multi-turn memory
        return await getQuickTextAnswer(transcript, chatId);
    }

    return "کاشتکار بھائی! آپ کی آواز صاف نہیں مل سکی۔ براہِ کرم دوبارہ اپنا مسئلہ ریکارڈ کر کے بھیجیں یا لکھ کر بتائیں۔ 🌾";
}

module.exports = {
    getQuickTextAnswer,
    getQuickAudioAnswer,
    transcribeWithGroqWhisper,
    generateUrduVoice: voiceModule.generateUrduVoice,
    loadConfig,
    callGroq,
    dispatchLLM
};
