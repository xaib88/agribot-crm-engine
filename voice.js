const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

let ffmpegPath = 'ffmpeg';
try {
    const staticFfmpeg = require('ffmpeg-static');
    if (staticFfmpeg && fs.existsSync(staticFfmpeg)) {
        ffmpegPath = `"${staticFfmpeg}"`;
    }
} catch (e) {}

const AUDIO_DIR = process.env.VERCEL ? path.join('/tmp', 'audio_out') : path.join(__dirname, 'audio_out');
try {
    if (!fs.existsSync(AUDIO_DIR)) {
        fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }
} catch (e) {}

// 1. Mandatory Gemini Flash TTS via Google Gemini Interactions API (Dual Model Quota)
async function generateGeminiTTS(cleanText) {
    const apiKey = process.env.GEMINI_API_KEY;
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const wavPath = path.join(AUDIO_DIR, `temp_${timestamp}_${rand}.wav`);
    const finalOggPath = path.join(AUDIO_DIR, `voice_${timestamp}_${rand}.ogg`);

    const models = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];
    let b64 = null;

    for (const model of models) {
        try {
            console.log(`🎙️ Generating Google Gemini Studio Voice (${model} - Charon)...`);
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                signal: AbortSignal.timeout(10000), // 10s timeout
                body: JSON.stringify({
                    model: model,
                    input: cleanText,
                    response_format: { type: 'audio' },
                    generation_config: {
                        speech_config: [
                            { voice: 'Charon' }
                        ]
                    }
                })
            });

            if (res.ok) {
                const data = await res.json();
                b64 = data.steps?.[0]?.content?.[0]?.data;
                if (b64) {
                    console.log(`✅ Google Gemini Studio Voice (Charon) generated successfully via ${model}`);
                    break;
                }
            } else {
                console.warn(`TTS Model ${model} [Charon] returned HTTP ${res.status}`);
            }
        } catch (e) {
            console.warn(`TTS Model ${model} [Charon] error:`, e.message);
        }
    }

    if (!b64) throw new Error('No audio data in Gemini Flash TTS responses');

    fs.writeFileSync(wavPath, Buffer.from(b64, 'base64'));

    // Convert WAV to WhatsApp-compliant Ogg Opus using ffmpeg
    try {
        execSync(`${ffmpegPath} -y -i "${wavPath}" -c:a libopus -b:a 32k -vbr on "${finalOggPath}"`, {
            stdio: 'ignore',
            timeout: 20000
        });
    } catch (ffmpegErr) {
        console.warn('FFmpeg transcode error, falling back to direct WAV delivery:', ffmpegErr.message);
    }

    if (fs.existsSync(finalOggPath) && fs.statSync(finalOggPath).size > 0) {
        if (fs.existsSync(wavPath)) {
            try { fs.unlinkSync(wavPath); } catch (e) {}
        }
        return finalOggPath;
    }

    if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 0) {
        return wavPath;
    }
    throw new Error('Both FFmpeg Opus transcode and WAV creation failed');
}

// 2. Edge TTS Fallback
async function generateEdgeTTS(cleanText, voiceName = 'ur-PK-AsadNeural') {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const tempMp3Path = path.join(AUDIO_DIR, `temp_${timestamp}_${rand}.mp3`);
    const finalOggPath = path.join(AUDIO_DIR, `voice_${timestamp}_${rand}.ogg`);

    await tts.toFile(AUDIO_DIR, cleanText);
    const defaultMp3 = path.join(AUDIO_DIR, 'audio.mp3');
    if (fs.existsSync(defaultMp3)) {
        fs.renameSync(defaultMp3, tempMp3Path);
    } else {
        return null;
    }

    // Try FFmpeg transcode if available locally
    try {
        execSync(`${ffmpegPath} -y -i "${tempMp3Path}" -c:a libopus -b:a 32k -vbr on "${finalOggPath}"`, {
            stdio: 'ignore',
            timeout: 10000
        });
        if (fs.existsSync(finalOggPath) && fs.statSync(finalOggPath).size > 0) {
            try { fs.unlinkSync(tempMp3Path); } catch (e) {}
            return finalOggPath;
        }
    } catch (ffmpegErr) {
        console.log('Local FFmpeg transcode skipped, returning direct MP3 for WAHA server-side conversion');
    }

    // If FFmpeg is not installed (e.g. on Vercel), return MP3 directly! WAHA will convert it to Opus PTT on the server
    if (fs.existsSync(tempMp3Path) && fs.statSync(tempMp3Path).size > 0) {
        return tempMp3Path;
    }
    return null;
}

// Main Dispatcher: Always try Gemini 3.8 Flash TTS first, fallback to Edge TTS
async function generateUrduVoice(text, voiceName = 'ur-PK-AsadNeural') {
    try {
        let cleanText = text
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/#/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .trim();

        if (!cleanText) return null;

        // Try Gemini 3.8 Flash TTS first
        try {
            console.log('🎙️ Generating studio voice via Gemini 3.8 Flash TTS...');
            const ogg = await generateGeminiTTS(cleanText);
            if (ogg) return ogg;
        } catch (geminiErr) {
            console.warn('Gemini 3.8 Flash TTS error, trying Edge TTS fallback:', geminiErr.message);
        }

        // Fallback to Edge TTS
        return await generateEdgeTTS(cleanText, voiceName);
    } catch (err) {
        console.error('All TTS engines failed:', err.message);
        return null;
    }
}

module.exports = {
    generateUrduVoice
};
