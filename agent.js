try { process.loadEnvFile(); } catch (e) {}
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

// Master System Prompt for Agricultural Mode (Basheer) with Uplift AI Operational Architecture
const AGRI_MASTER_PROMPT = `آپ 'بشیر' (Basheer) ہیں۔ آپ پاکستان کے تمام کسانوں اور کاشتکاروں کے لیے ایک انتہائی بااختیار، مخلص، باادب، تیز رفتار اور 20+ سالہ تجربہ کار مرد زرعی ماہر ہیں۔

آپ کو پاکستان کے نامور زرعی ماہر اور ایگریکلچر اسپیشلسٹ "شاہزیب ارشاد" (Shahzaib Irshad - بانی زراعت گائیڈنس) نے خاص طور پر کاشتکاروں کے مسائل فوری اور سائنسی انداز میں حل کرنے کے لیے تیار کیا ہے۔

# مستقل شناخت اور خالق کا اصول (Identity & Creator Rule):
1. آپ کا نام: صرف اور صرف 'بشیر' (Basheer) ہے۔
2. آپ کے خالق: "شاہزیب ارشاد" (زرعی ماہر و بانی زراعت گائیڈنس) ہیں۔
3. خالق کا نام بتانے کا اصول:
   - جب کوئی کسان یا صارف پوچھے کہ: 'تمہیں کس نے بنایا ہے؟'، 'تمہارا بانی یا ڈویلپر کون ہے؟'، 'Who created you?' یا 'شاہزیب ارشاد کون ہے؟'، تو فخر اور احترام سے واضح بتائیں:
     'مجھے معروف زرعی ماہر شاہزیب ارشاد (بانی زراعت گائیڈنس) نے کاشتکاروں کی بروقت، سائنسی اور مفت رہنمائی کے لیے تیار کیا ہے۔ 🌿'
   - خوش آمدید اور تعارف کا سخت اصول (Zero Repeated Welcome Rule):
     کسان کو بار بار "خوش آمدید" ہرگز مت کہیں! خوش آمدید پورے دن میں صرف اور صرف ایک بار ابتدائی رابطے پر کہا جاتا ہے۔ جب گفتگو شروع ہو چکی ہو یا کسان سوال پوچھے تو "خوش آمدید" کہنا سختی سے منع ہے! بغیر کسی تمہید کے سیدھا اور ٹو دی پوائنٹ تکنیکی جواب دیں۔
   - خوش آمدید کے ساتھ ادارے اور نام کا تعارف: جب بھی خوش آمدید بولیں تو لازمی یہ بولیں: 'خوش آمدید کاشتکار بھائی! میں زرعی رہنمائی سے بشیر ہوں۔ 🚜'

# Uplift AI کی طرز پر سوالات کی 6 کیٹیگریز (Query Classification & Operational Workflow):
آپ ہر آنے والے سوال کو درج ذیل 6 کیٹیگریز میں سے ایک میں پرکھ کر سائنسی انداز میں رسپانس دیتے ہیں:

1. [کیٹیگری 1: بیماری و علامات کی تفتیش - Problem Diagnosis & Zero-Chemical Triage]:
- جب کسان صرف علامات بتائے (پتے پیلے، سوکھنا، مرجھانا، داغ دھبے، سفید بالیاں، جڑ گلنا، پاؤڈر جمنا) لیکن حتمی بیماری کا نام نہ جانتا ہو۔
- اصول: **اس مرحلے پر براہِ راست کوئی کیمیکل ہرگز تجویز نہ کریں!**
- سینئر پیتھالوجسٹ کے طور پر علامات کا جائزہ لیں۔ اگر اعتماد درمیانہ (Medium) یا کم (Low) ہو تو دو ممکنہ مشتبہ وجوہات (Suspects) بتائیں اور کسان سے 1 سے 2 مخصوص تشخیصی سوالات پوچھیں (مثلاً ہاتھ لگانے سے پاؤڈر اترتا ہے؟ تنا چیرنے پر اندر سنڈی یا فضلہ ہے؟ نشان گول ہیں یا لمبی دھاریاں؟)۔
- جب کسان علامات کی تصدیق کر دے، تب کیٹیگری 2 کے تحت دوا تجویز کریں۔

2. [کیٹیگری 2: فصل کی نگہداشت اور علاج - Crop Care Plan]:
- جب کسان واضح کیڑے (سفید مکھی، سنڈی، تیلا، جڑی بوٹی) کا نام لے یا فصل کے خاص مرحلے کا کھاد و سپرے پلان مانگے۔
- اصول: منظور شدہ کیمیکل فارمولیشن (سنجینٹا، بائر، ایف ایم سی وغیرہ)، درست فی ایکڑ مقدار اور طریقہ استعمال واضح بتائیں۔

3. [کیٹیگری 3: دوا کا طریقہ استعمال، خوراک اور احتیاطیں - Product Usage, Dosage & PHI]:
- جب کسان کسی مخصوص پروڈکٹ (جیسے پروکلیم، ورٹیکو، ٹلٹ، سکور، ایمپلائیگو، ریوس وغیرہ) کی مقدار یا طریقہ پوچھے تو:
- منظور شدہ فی ایکڑ ڈوز، 100 تا 120 لیٹر پانی کا استعمال، سپرے کا محفوظ وقت (صبح یا شام کا پرسکون موسم)، حفاظتی کٹ (ماسک، دستانے)، اور PHI (کٹائی اور سپرے کا درمیانی محفوظ وقفہ) بالکل درست بتائیں۔

4. [کیٹیگری 4: موسمیاتی رہنمائی و سپرے شیڈول - Weather & Spray Advisory]:
- کسان کے شہر/ضلع کے مطابق لائیو موسم بتائیں (درجہ حرارت، ہوا کی رفتار، نمی اور بارش کا امکان)۔
- زرعی مشورہ کا سخت اصول (Zero Unsolicited Advice): جب کسان صرف موسم یا شہر پوچھے تو صرف موسم کی رپورٹ دیں۔ 'زرعی مشورہ' یا سپرے کا مشورہ صرف اور صرف تب دیں جب کسان خود صراحت سے پوچھے کہ 'زرعی مشورہ دو' یا 'سپرے کا مشورہ دو'۔
- گندم کی 35 ڈگری پر بوائی کا سوال آئے تو سائنسی نقصانات بتاتے ہوئے 10 سے 15 نومبر تک موسم کے ٹھنڈا ہونے کا لازمی انتظار کرنے کی مدلل تاکید کریں۔

5. [کیٹیگری 5: منڈی ریٹس اور قیمتیں - Mandi Rates]:
- اجناس (گندم، چاول، کپاس، مکئی، دھان) کے سرکاری ریٹس AMIS پنجاب / مارکیٹ کمیٹی غلہ منڈی کے مستند حوالے اور تاریخ کے ساتھ بتائیں۔

6. [کیٹیگری 6: تعارف و عمومی کسان رہنمائی - Identity & General Guidance]:
- باادب، مخلص اور باوقار گفتگو۔

# لازمی ضوابط (Strict Guidelines):
- جنس و صیغہ: آپ مرد (Male) ہیں، ہمیشہ مذکر صیغے استعمال کریں ('میں بتاتا ہوں'، 'میں رہنمائی کرتا ہوں')۔
- سلام کا اصول: جب تک کسان خود سلام نہ کرے، خود سے 'وعلیکم السلام' نہ کہیں۔
- یوٹیوب لنک: کسان کے کسی بھی سوال کے جواب میں کوئی یوٹیوب لنک مت لگائیں (لنک صرف ویلکم یا خاص پوچھنے پر جاتا ہے)۔
- نو کالز: واضح بتائیں کہ اس نمبر پر کال ممکن نہیں، صرف واٹس ایپ میسج یا وائس نوٹ پر رہنمائی حاصل کریں۔
- جواب کا حجم: عام سوالات پر 2 سے 3 ٹو دی پوائنٹ لائنیں۔ لمبا اور مفصل جواب صرف تب دیں جب کسان خود تفصیل مانگے۔
- خالص پاکستانی اردو زبان (Zero Hindi Words Policy): تمام جوابات سلیس، شائستہ اور خالص پاکستانی اردو میں دیں۔ ہندی الفاظ (مثلاً نمستے، دھنیواد، کرپیا، پرنام، سندیش، سہایتا، پرشن، اتر، سوچنا، سمے وغیرہ) کا استعمال سختی سے منع ہے! صرف معیاری پاکستانی اردو الفاظ (السلام علیکم، شکریہ، براہِ کرم، سلام، پیغام، مدد/رہنمائی، سوال، جواب، وقت) استعمال کریں۔`;

// Master System Prompt for General Mode (@General)
const GENERAL_MASTER_PROMPT = `آپ 'بشیر' (Basheer) ہیں۔ 
اگرچہ آپ بنیادی طور پر پاکستان کے ایک تجربہ کار زرعی ماہر ہیں، لیکن اس جنرل موڈ میں آپ صارف کے دنیا بھر کے تمام عمومی سوالات (سائنس، ادب، تعلیم، ٹیکنالوجی، تاریخ، شعر و شاعری، کاروبار اور روزمرہ مسائل) کا بھی شائستہ، سنجیدہ اور فصیح انداز میں درست جواب دیتے ہیں۔

اہم اصول:
1. خالق کے نام کی سختی (Creator Privacy): اپنے عام تعارف میں شاہزیب ارشاد کا نام خود سے ہرگز مت لیں۔ صرف اس وقت بتائیں جب صارف واضح طور پر پوچھے کہ 'تمہیں کس نے بنایا ہے؟' یا 'شاہزیب ارشاد کون ہے؟'۔
2. ٹریننگ و تربیت: اگر کوئی پوچھے کہ 'تمہیں کیا کیا ٹریننگ دی گئی ہے؟' تو بتائیں کہ آپ کو پاکستان کی زراعت، جدید کاشتکاری، فصلوں، بیماریوں کے علاج اور کھادوں کے ساتھ ساتھ عمومی علوم و فنون کی مکمل تربیت دی گئی ہے۔
3. صیغہ: آپ مرد (Male) ہیں، ہمیشہ مذکر صیغہ استعمال کریں (مثلاً: 'کر سکتا ہوں'، 'بتاتا ہوں')۔
4. جواب کا حجم: عام طور پر 2 سے 3 لائنوں میں ٹو دی پوائنٹ جواب دیں! اگر صارف 'تفصیل سے بتاؤ' کہے تو تفصیلی جواب دیں۔
5. سلام کا اصول: جب تک صارف خود سلام نہ کرے، خود سے 'وعلیکم السلام' ہرگز نہ کہیں۔
6. لنکس کی ممانعت: کوئی یوٹیوب یا بیرونی لنک مت لکھیں۔
7. خالص پاکستانی اردو (Zero Hindi Words): ہندی الفاظ ہرگز استعمال نہ کریں۔ ہمیشہ فصیح اور باوقار پاکستانی اردو میں جواب دیں۔`;

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

// Unified Gemini Flash Caller with strict 10s timeout & anti-hang protection
async function callGemini(systemPrompt, contents, apiKey, modelName = 'gemini-3.5-flash', maxTokens = 350) {
    const modelsToTry = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite'];
    
    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(10000), // 10-second resilient timeout
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: contents,
                    generationConfig: {
                        temperature: 0.2, // Low temperature for high precision & anti-hallucination
                        maxOutputTokens: Math.max(1000, maxTokens),
                        thinkingConfig: { thinkingBudget: 0 }
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

    // 1.5. WELCOME POLICE: "خوش آمدید" strictly allowed ONLY ONCE PER DAY per farmer
    const canWelcome = chatId ? db.shouldSendWelcome(chatId) : false;
    if (!canWelcome) {
        // Strip any repeated "خوش آمدید" from response
        text = text.replace(/^(خوش\s*آمدید\s*کاشتکار\s*بھائی[!،.,:؛-]*|خوش\s*آمدید\s*بھائی[!،.,:؛-]*|خوش\s*آمدید[!،.,:؛-]*)/gi, '').trim();
        text = text.replace(/خوش\s*آمدید\s*کاشتکار\s*بھائی[!،.]*/gi, '').trim();
        text = text.replace(/خوش\s*آمدید[!،.]*/gi, '').trim();
    }

    // 2. MALE PERSONA ENFORCEMENT (Strictly مذکر)
    text = text.replace(/کر سکتی ہوں/g, 'کر سکتا ہوں')
               .replace(/سکتی ہوں/g, 'سکتا ہوں')
               .replace(/بتاتی ہوں/g, 'بتاتا ہوں')
               .replace(/دیکھتی ہوں/g, 'دیکھتا ہوں')
               .replace(/سمجھتی ہوں/g, 'سمجھتا ہوں');

    // 2.5. ZERO HINDI VOCABULARY ENFORCEMENT: Cleanse any accidental Hindi words into pure Pakistani Urdu
    text = text.replace(/دھنیواد/gi, 'شکریہ')
               .replace(/نمستے/gi, 'السلام علیکم')
               .replace(/کرپیا/gi, 'براہِ کرم')
               .replace(/پرنام/gi, 'سلام')
               .replace(/سہایتا/gi, 'مدد')
               .replace(/پرشن/gi, 'سوال')
               .replace(/اتر/gi, 'جواب')
               .replace(/سندیش/gi, 'پیغام')
               .replace(/سمے/gi, 'وقت')
               .replace(/سوچنا/gi, 'معلومات');

    // 3. LINK & PROMOTIONAL QUARANTINE
    text = text.replace(/https?:\/\/[^\s]+/gi, '').replace(/^زراعت\s*گائیڈنس\s*[:\-]\s*/gi, '').trim();

    // 4. LENGTH & CONCISENESS POLICE (Thorough guidance allowed for detailed requests and wheat sowing)
    const isWheatSowing = /گندم.*(بوائی|کاشت|بجائی|وقت|درجہ حرارت|35|گرمی|موسم)|(بوائی|کاشت|بجائی).*(گندم)|wheat.*(sow|sowing|temperature|35|time)/i.test(userQuery);
    const isDetailRequested = isWheatSowing || /تفصیل|ڈیٹیل|تفصیلی|وضاحت|لمبا|detail|detailed|in depth|explain fully/i.test(userQuery);
    if (!isDetailRequested && currentMode === 'agri') {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length > 5) {
            text = lines.slice(0, 4).join('\n');
        }
    }

    // 5. YOUTUBE LINK POLICY: Strictly NEVER auto-appended to questions/answers.
    // The YouTube link is restricted to ONLY ONE PLACE: the initial welcome greeting or explicit user request.
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

    // Instant fallback to Groq (<1s) if Gemini hits limit or spikes
    if (config.groqApiKey) {
        console.log("⚡ Gemini rate limit / spike. Switching instantly to Groq Qwen (<1s)...");
        const groqFallback = await callGroq(systemPrompt, contents, config.groqApiKey, 'qwen/qwen3.8-27b', maxTokens);
        if (groqFallback) return groqFallback;
    }

    return "محترم کاشتکار بھائی! میں آپ کے زرعی سوال کا جائزہ لے رہا ہوں۔ براہِ کرم اپنا سوال دوبارہ لکھیں یا وائس نوٹ بھیجیں تاکہ میں فوری اور درست رہنمائی کر سکوں۔ 🌿";
}

// Uplift AI Style 6-Category Query Classifier
function classifyAgriQuery(query) {
    const q = (query || '').toLowerCase();

    // Category 1: Identity & Creator (بشیر اور شاہزیب ارشاد)
    if (/کس نے بنایا|کون ہو|تم کون ہو|تمہیں کس نے بنایا|اپنا تعارف|تعارف کرواؤ|creator|who made you|who created you|شاہزیب|ارشاد|شازیب/i.test(q)) {
        return {
            type: 'IDENTITY',
            label: 'شناخت اور خالق (Identity & Creator)',
            instruction: '[کیٹیگری: شناخت اور خالق]: کسان نے آپ کے نام یا خالق کا پوچھا ہے۔ واضح اور باادب بتائیں کہ آپ کا نام "بشیر" ہے اور آپ کو معروف زرعی ماہر "شاہزیب ارشاد" (بانی زراعت گائیڈنس) نے کاشتکاروں کی بروقت، سائنسی اور مفت رہنمائی کے لیے تیار کیا ہے۔ 🌿'
        };
    }

    // Category 2: Problem Diagnosis & Symptom Investigation (Zero-Chemical Protocol)
    const hasSymptom = /پیلا|پیلے|سوکھ|سکھ|مرجھا|داغ|دھبے|سفوف|پاؤڈر|سفید.*(بالی|پھلیاں|پتے)|گلن|جھلس|کیڑے|سوراخ|مڑ.*(پتے|گوپ)|گر.*(پھول|پھل)|پھپھوندی|زنگ|سڑ.*(جڑ|تنا)|بیماری/i.test(q);
    const hasSpecificChemicalOrDose = /کتنی مقدار|ڈوز|طریقہ.*(استعمال|سپرے)|قیمت|پروکلیم|ٹلٹ|سکور|امپلائیگو|ورٹیکو|ریوس|امیٹاکلوپرڈ|فی ایکڑ/i.test(q);

    if (hasSymptom && !hasSpecificChemicalOrDose) {
        return {
            type: 'DIAGNOSIS',
            label: 'تشخیص اور تفتیش (Problem Diagnosis - Zero Chemical Triage)',
            instruction: '[کیٹیگری: بیماری و علامات کی تفتیش]: کسان نے علامات کا ذکر کیا ہے۔ بطور سینئر زرعی پیتھالوجسٹ و اینٹومالوجسٹ، ابھی براہِ راست کوئی کیمیکل ہرگز تجویز نہ کریں! اگر اعتماد میڈیم یا لو ہے تو ممکنہ 2 مشتبہ وجوہات بتائیں اور کسان سے 1 تا 2 مخصوص تشخیصی سوالات پوچھیں تاکہ بیماری حتمی طور پر کنفرم ہو سکے۔'
        };
    }

    // Category 3: Product Usage & Dosage
    if (/ڈوز|مقدار|فی ایکڑ|طریقہ.*استعمال|کتنا.*ڈالیں|phi|کٹائی.*پہلے|کتنے دن|پانی.*مقدار|احتیاط|سپرے.*طریقہ/i.test(q)) {
        return {
            type: 'USAGE_DOSE',
            label: 'طریقہ استعمال اور مقدار (Product Usage & Dosage)',
            instruction: '[کیٹیگری: دوا کا طریقہ استعمال و ڈوز]: کسان نے دوا کے استعمال یا مقدار کے بارے میں پوچھا ہے۔ منظور شدہ فی ایکڑ ڈوز، 100 تا 120 لیٹر پانی کا استعمال، سپرے کا بہترین وقت، حفاظتی کٹ اور PHI (کٹائی اور سپرے کا محفوظ وقفہ) بالکل درست بتائیں۔'
        };
    }

    // Category 4: Weather & Spray Advisory
    if (/موسم|بارش|درجہ حرارت|گرمی|سردی|ہوا|weather|rain|temp/i.test(q)) {
        return {
            type: 'WEATHER',
            label: 'موسمیاتی رہنمائی و سپرے شیڈول (Weather & Spray Advisory)',
            instruction: '[کیٹیگری: موسمیاتی رہنمائی]: اگر کسان کے علاقے کا موسم دستیاب ہے تو لائیو موسمی احوال کے تناظر میں سپرے کا وقت بتائیں (ہوا اور بارش میں سپرے نہ کریں)۔ اگر گندم کی 35 ڈگری پر بوائی ہے تو سائنسی نقصانات بتاتے ہوئے 10 سے 15 نومبر کا انتظار کرنے کی سخت تاکید کریں۔'
        };
    }

    // Category 5: Mandi Rates
    if (/منڈی|ریٹ|قیمت.*(گندم|چاول|کپاس|مکئی|دھان)|mandi|rate/i.test(q)) {
        return {
            type: 'MANDI',
            label: 'منڈی ریٹس اور قیمتیں (Mandi Rates)',
            instruction: '[کیٹیگری: منڈی ریٹس]: غلہ منڈی کے مصدقہ ریٹس AMIS پنجاب کے حوالے سے بتائیں۔'
        };
    }

    // Category 6: Crop Care Plan / Pest Management
    return {
        type: 'CARE_PLAN',
        label: 'فصل کی نگہداشت اور علاج (Crop Care Plan)',
        instruction: '[کیٹیگری: فصل کی نگہداشت و کیڑے کا تدارک]: کسان نے مخصوص کیڑے، جڑی بوٹی یا کھاد کا پوچھا ہے۔ مستند سائنسی علاج اور منظور شدہ کیمیکل کی مقدار فوری اور ٹو دی پوائنٹ بتائیں۔'
    };
}

// =========================================================================
// 🎙️ VOICE NOTE DELIVERY PREFERENCE DETECTION (User Override vs Default)
// =========================================================================
const DISABLE_VOICE_REGEX = /(?:وائس\s*نوٹ|آڈیو|آواز|وائس|voice\s*notes?|audio|voice|वॉइस\s*नोट|ऑडियो|आवाज)\s*(?:مت|نہ|نہں|نہیں|بند|روکو|stop|disable|dont|don't|no|نکو|mat|na|band|rok|मत|बंद|रोको)|(?:صرف|only|just|sirf|सिर्फ|فقط)\s*(?:ٹیکسٹ|تحریر|میسج|لکھ\s*کر|text|msg|message|likh\s*kar|टेक्स्ट|मैसेज|लिख\s*کر|लिख\s*कर)|(?:no|stop|don't\s*send|dont\s*send|do\s*not\s*send|disable)\s*(?:voice|audio|voice\s*notes?)|i\s*(?:don'?t|do\s*not)\s*(?:need|want)\s*audio|text\s*only|mujhe\s*(?:voice|audio)\s*(?:nahi|mat)|मुझे\s*(?:वॉइस|ऑडियो)\s*(?:मत|नहीं)/i;

const ENABLE_VOICE_REGEX = /(?:وائس\s*نوٹ|آڈیو|آواز|وائس|voice\s*notes?|audio|voice|वॉइस\s*नोट|ऑडियो)\s*(?:بھیجو|بھیجیں|آن|شروع|chahiye|bhejo|bhejna|on|start|karo|batao|भेजो|ऑन|शुरू)|(?:بول\s*کر|آواز\s*میں|bol\s*kar|bolke|बोल\s*कर)\s*(?:بتاؤ|بتائیں|کہو|سمجھاؤ|batao|batayein|bataen|बताओ|बताएं)|(?:send|enable|resume|start|play)\s*(?:voice|audio|voice\s*notes?)|voice\s*notes?\s*please|i\s*want\s*audio/i;

function detectVoicePreference(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();
    if (DISABLE_VOICE_REGEX.test(clean)) return 'disable';
    if (ENABLE_VOICE_REGEX.test(clean)) return 'enable';
    return null;
}

function checkVoicePreferenceMessage(text) {
    if (!text || typeof text !== 'string') return null;
    const pref = detectVoicePreference(text);
    if (!pref) return null;

    const stripped = text
        .replace(/i\s*(?:don'?t|do\s*not)\s*(?:need|want)\s*(?:audio|voice)?/gi, '')
        .replace(/(?:وائس\s*نوٹ|آڈیو|آواز|وائس|voice\s*notes?|audio|voice|वॉइस\s*नोट|ऑडियो|آواز)/gi, '')
        .replace(/(?:مت\s*بھیجو|مت\s*بھیجیں|نہ\s*بھیجو|نہ\s*بھیجیں|نہں\s*بھیجو|نہیں\s*بھیجو|بند\s*کرو|بند\s*کر\s*دیں|روکو|मत\s*भेजो|बंद\s*کرو|मत)/gi, '')
        .replace(/(?:صرف\s*ٹیکسٹ|صرف\s*تحریر|صرف\s*میسج|صرف\s*لکھ\s*کر|صرف\s*لکھ\s*کر\s*بتائیں|صرف\s*لکھ\s*کر\s*بتاؤ|सिर्फ\s*टेक्स्ट\s*भेजें|सिर्फ\s*टेक्स्ट|टेक्स्ट\s*भेजें)/gi, '')
        .replace(/(?:بھیجو|بھیجیں|آن\s*کرو|آن\s*کر\s*دیں|شروع\s*کرو|شروع\s*کر\s*دیں|بول\s*کر\s*بتاؤ|بول\s*کر\s*بتائیں)/gi, '')
        .replace(/(?:no\s*voice|no\s*audio|don't\s*send|dont\s*send|do\s*not\s*send|text\s*only|send\s*voice|send\s*audio|enable\s*voice|disable\s*voice|please|chahiye)/gi, '')
        .replace(/(?:mujhe|nahi|sirf|bhejo|bhejna|bol\s*kar|batao|batayein|मुझे|सिर्फ)/gi, '')
        .replace(/(?:مجھے|نہیں|چاہیے|فرمائیں|مہربانی)/gi, '')
        .replace(/[^\w\u0600-\u06FF\u0900-\u097F]/g, ' ')
        .trim();

    const hasOtherContent = stripped.length > 3 && /[a-zA-Z\u0600-\u06FF\u0900-\u097F]{3,}/.test(stripped);

    return {
        preference: pref,
        isPure: !hasOtherContent,
        cleanQuery: hasOtherContent ? stripped : ''
    };
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
            return "🌿 ایگری بوٹ موڈ فعال ہو گیا ہے!\n\nمیں زرعی رہنمائی سے بشیر ہوں، آپ کا زرعی ماہر۔ اب آپ اپنی فصلوں، کھادوں، کیڑے مار ادویات، مویشی پالن اور موسم کے متعلق سوالات پوچھ سکتے ہیں۔";
        }
    }

    // 1.5. User Preference Override: Text-Only Mode vs Voice Note Delivery
    const voicePref = checkVoicePreferenceMessage(query);
    if (voicePref) {
        if (voicePref.preference === 'disable') {
            if (chatId) db.setVoiceDisabled(chatId, true);
            console.log(`🔇 [Voice Preference] User ${chatId} requested TEXT-ONLY mode (voice notes disabled).`);
            if (voicePref.isPure) {
                return "جی بالکل کاشتکار بھائی! آپ کی پسند کے مطابق اب آپ کو صرف تحریری (ٹیکسٹ) میسج موصول ہو گا، وائس نوٹ نہیں بھیجا جائے گا۔ اگر دوبارہ وائس نوٹ چاہیے ہوں تو کسی بھی وقت 'وائس نوٹ بھیجو' لکھ کر بتا سکتے ہیں۔ فرمائیں میں آپ کی کیا زرعی خدمت کر سکتا ہوں؟ 🌿";
            }
            if (voicePref.cleanQuery) {
                query = voicePref.cleanQuery;
            }
        } else if (voicePref.preference === 'enable') {
            if (chatId) db.setVoiceDisabled(chatId, false);
            console.log(`🔊 [Voice Preference] User ${chatId} RESUMED voice notes (audio enabled).`);
            if (voicePref.isPure) {
                return "جی بہتر کاشتکار بھائی! آپ کے لیے وائس نوٹس دوبارہ شروع کر دیے گئے ہیں۔ اب آپ کو ہر رہنمائی کے ساتھ تفصیلی آڈیو بھی موصول ہوا کرے گی۔ فرمائیں میں آپ کی کیا زرعی مدد کر سکتا ہوں؟ 🌿";
            }
            if (voicePref.cleanQuery) {
                query = voicePref.cleanQuery;
            }
        }
    }

    // Check if user is asking for a detailed/longer answer OR asking about wheat sowing timing/temperature
    const isWheatSowingQuery = /گندم.*(بوائی|کاشت|بجائی|وقت|درجہ حرارت|35|گرمی|موسم)|(بوائی|کاشت|بجائی).*(گندم)|wheat.*(sow|sowing|temperature|35|time)/i.test(query);
    const isDetailRequested = isWheatSowingQuery || /تفصیل|ڈیٹیل|تفصیلی|وضاحت|لمبا|detail|detailed|in depth|explain fully/i.test(query);
    const maxTokens = isDetailRequested ? 850 : 350;

    // Smart Intent Router: If in General Mode but user asks about Agriculture, Crops, Weather, Creator, or Training
    const isAgriOrIdentityQuery = /گندم|کپاس|چاول|دھان|مکئی|کماد|گنا|سپرے|کھاد|یوریا|ڈی اے پی|پوٹاش|کیڑا|تیلا|سنڈی|مکھی|بیماری|زنگ|فصل|کسان|ایکڑ|ڈوز|شاہزیب|شہزے برشاد|بشیر|ٹریننگ|تربیت|کون ہو|کس نے بنایا|زراعت|موسم|بارش/i.test(query);
    if (currentMode === 'general' && isAgriOrIdentityQuery) {
        console.log(`🌾 Agri/Identity query detected in General Mode. Auto-switching to Basheer Agri Persona!`);
        currentMode = 'agri';
        if (chatId) db.setChatMode(chatId, 'agri');
    }

    // Pure Greeting / Intro Fast Path (Welcome & Intro sent strictly ONCE per day)
    const normalizedGreeting = query.replace(/[!؟?،.\s]/g, '');
    const isPureGreeting = /^(سلام|السلامعلیکم|اسلامعلیکم|وعلیکمالسلام|ہیلو|hello|hi|aoa|salam|کونہو|تمکونہو|تعارف|اپناتعارف)$/i.test(normalizedGreeting);
    if (isPureGreeting) {
        const userSaidSalam = /سلام|اسلام|السلام|aoa|salam/i.test(query);
        const prefix = userSaidSalam ? "وعلیکم السلام! " : "";
        const canWelcome = chatId ? db.shouldSendWelcome(chatId) : true;

        if (canWelcome) {
            if (chatId) {
                db.markWelcomeSent(chatId);
                db.markYtLinkSent(chatId);
            }
            return `${prefix}خوش آمدید کاشتکار بھائی! میں زرعی رہنمائی سے بشیر ہوں۔ 🚜\n\nگندم، کپاس، چاول، مکئی یا کماد کی دیکھ بھال میں کوئی بھی پریشانی ہو، آپ بول کر وائس نوٹ بھیجیں یا لکھ کر بتائیں۔ میں فوری رہنمائی کے لیے حاضر ہوں۔\n\nرہنمائی ویڈیوز کے لیے یوٹیوب چینل:\nhttps://www.youtube.com/@AgricultureGuidance/`;
        } else {
            // Already welcomed today: ZERO "خوش آمدید", ZERO repetitive intro, ZERO YouTube spam!
            return `${prefix}جی کاشتکار بھائی، فرمائیں میں آپ کی کیا مدد کر سکتا ہوں؟ 🌿`;
        }
    }

    // Explicit YouTube inquiry (User directly asks for videos or channel)
    if (/یوٹیوب|چینل|ویڈیو|youtube|channel|video/i.test(query)) {
        return "کاشتکار بھائی، تمام فصلوں اور جدید کاشتکاری کی رہنمائی ویڈیوز کے لیے ہمارے آفیشل یوٹیوب چینل کو وزٹ کریں:\nhttps://www.youtube.com/@AgricultureGuidance/";
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

    // Uplift AI Style 6-Category Query Classification & Dynamic Injection
    const category = classifyAgriQuery(query);
    console.log(`🧭 [Uplift AI Classifier] Category: ${category.type} - "${category.label}"`);

    let dynamicSystemPrompt = AGRI_MASTER_PROMPT + `\n\n${category.instruction}`;
    if (isWheatSowingQuery) {
        dynamicSystemPrompt += `\n\n[خصوصی سائنسی ہدایت برائے گندم بوائی و درجہ حرارت]: کسان نے گندم کی بوائی، وقت، یا گرم درجہ حرارت (30 تا 35 ڈگری) کے متعلق پوچھا ہے۔ اسے سرسری نہیں بلکہ مکمل تفصیلی، جامع اور سائنسی رہنمائی فراہم کریں۔ زیادہ درجہ حرارت کے نقصانات (بیج کا اگاؤ خراب ہونا، شگوفے نہ بننا، وقت سے پہلے نالی پر آنا، پیداوار 30 تا 40 فیصد گرنا) واضح کریں اور 10 سے 15 نومبر تک موسم کے ٹھنڈا ہونے کا انتظار کرنے کی تاکید کریں۔`;
    } else if (isDetailRequested) {
        dynamicSystemPrompt += `\n\n[خصوصی ہدایت]: کسان نے تفصیلی اور مفصل جواب کا تقاضا کیا ہے۔ اس لیے اب آپ نے تفصیلی انداز میں وجوہات، طریقہ استعمال، وقت، کھاد/زہر کی ڈوز، اور تمام احتیاطیں مکمل کھول کر بیان کرنی ہیں۔`;
    }

    // 1. Check Mandi Rates Intent (AMIS Punjab Grounding)
    if (mandiModule.isMandiQuery(query)) {
        console.log(`📊 Live Mandi Rates lookup for: "${query}"...`);
        const mandiCity = weatherModule.detectCity(query);
        return mandiModule.getMandiRatesReport(query, mandiCity?.name);
    }

    // 2. Check Weather Intent (Strictly when weather is asked or city alone is entered, unless it is a wheat sowing/crop decision query or explicit agricultural advice is asked)
    const isWeather = weatherModule.isWeatherQuery(query);
    const isCityOnly = weatherModule.isCityOnlyQuery(query);
    const detectedCity = weatherModule.detectCity(query);
    const isExplicitAdviceAsked = /زرعی\s*مشورہ|سپرے\s*کا\s*مشورہ|مشورہ\s*دو|مشورہ\s*دیں|مشورہ\s*چاہیے|کیا\s*سپرے\s*کروں|سپرے\s*کر\s*سکتے|advise|advice/i.test(query);

    if ((isWeather || isCityOnly) && !isWheatSowingQuery && !isExplicitAdviceAsked) {
        if (detectedCity) {
            console.log(`🌤️ Live weather lookup for: ${detectedCity.name} (${detectedCity.en})...`);
            const rawWeather = await weatherModule.getLiveWeather(detectedCity.en, detectedCity.name, detectedCity.coords);
            if (rawWeather) {
                // Return verified weather directly with Source: IBM Weather (WITHOUT unsolicited zarai mashwara)
                return rawWeather;
            }
        } else {
            // Weather asked without a city -> Prompt user for city to avoid hallucination!
            return "کاشتکار بھائی! درست اور تازہ ترین موسم بتانے کے لیے براہِ کرم اپنے شہر یا ضلع کا نام بتائیں (مثلاً ملتان، ساہیوال، وہاڑی، بہاولپور وغیرہ) تاکہ میں وہاں کا درجہ حرارت، نمی، ہوا کی رفتار اور بارش کی پیش گوئی بتا سکوں۔ 🌧️";
        }
    }

    // If explicit weather advice or wheat sowing query has a city, inject hyper-local live weather for contextual guidance
    if ((isWheatSowingQuery || isExplicitAdviceAsked) && detectedCity) {
        try {
            const areaWeather = await weatherModule.getLiveWeather(detectedCity.en, detectedCity.name, detectedCity.coords);
            if (areaWeather) {
                dynamicSystemPrompt += `\n\n[صارف کے علاقے (${detectedCity.name}) کا لائیو موسمی ڈیٹا]:\n${areaWeather}\n[ہدایت]: کسان نے لائیو موسم کو مدنظر رکھتے ہوئے زرعی مشورہ مانگا ہے۔ اس لائیو موسم، درجہ حرارت اور ہوا کی رفتار کی روشنی میں سائنسی اور واضح زرعی مشورہ فراہم کریں۔`;
            }
        } catch (e) {}
    }

    // RAG Knowledge Base Grounding (Syngenta, NARC, approved dosages)
    const contextData = knowledgeModule.searchKnowledge(query);
    if (contextData) {
        dynamicSystemPrompt += `\n\n[مصدقہ زرعی ڈیٹا بیس (Verified Agricultural Knowledge Base)]:\n${contextData}\n\n[لازمی تشخیصی پروٹوکول برائے بیماریاں]: اوپر دیے گئے ڈیٹا بیس کے مطابق اگر کسان نے کسی بیماری (جیسے زنگ، جھلساؤ، مرجھاؤ، سوکھا) کا عمومی ذکر کیا ہے تو براہِ راست دوا مت بتائیں! پہلے کسان سے 1 یا 2 سوالات پوچھ کر علامات کی قطعی تصدیق کریں۔ جب کسان علامات بتا دے اور میچ ہو جائے، صرف تب اوپر والے ڈیٹا سے درست کیمیکل اور مقدار بتائیں۔ البتہ اگر مسئلہ کیڑے یا جڑی بوٹی کا 100% واضح سوال ہو تو اس کا مصدقہ کیمیکل اور مقدار براہِ راست بتائیں۔`;
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
    dispatchLLM,
    bossQualityGate,
    detectVoicePreference,
    checkVoicePreferenceMessage
};
