const agent = require('../agent');
const waha = require('../waha_bridge');
const voice = require('../voice');
const fs = require('fs');

module.exports = async (req, res) => {
    const report = {
        timestamp: new Date().toISOString(),
        isVercel: Boolean(process.env.VERCEL),
        env: {
            hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
            geminiKeyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 7) : 'NONE',
            hasGroqKey: Boolean(process.env.GROQ_API_KEY),
            groqKeyPrefix: process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.slice(0, 7) : 'NONE',
            wahaBaseUrl: process.env.WAHA_BASE_URL || process.env.WAHA_SERVER_URL || 'DEFAULT',
            wahaApiKey: Boolean(process.env.WAHA_API_KEY)
        }
    };

    // Test 1: LLM text generation
    const t0 = Date.now();
    try {
        const reply = await agent.getQuickTextAnswer('گندم کی کھاد', 'test_debug_user');
        report.llmReply = reply?.slice(0, 100);
        report.llmDurationMs = Date.now() - t0;
    } catch (e) {
        report.llmError = e.message;
    }

    // Test 2: WAHA connection
    const t1 = Date.now();
    try {
        const sessionRes = await waha.wahaRequest('GET', '/api/sessions/default');
        report.wahaStatus = sessionRes.status;
        report.wahaSession = sessionRes.data?.status;
        report.wahaDurationMs = Date.now() - t1;
    } catch (e) {
        report.wahaError = e.message;
    }

    // Test 3: Voice / TTS check
    const t2 = Date.now();
    try {
        const oggPath = await voice.generateUrduVoice('خوش آمدید');
        report.voicePath = oggPath;
        report.voiceExists = Boolean(oggPath && fs.existsSync(oggPath));
        report.voiceDurationMs = Date.now() - t2;
    } catch (e) {
        report.voiceError = e.message;
    }

    return res.status(200).json(report);
};

