const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AUDIO_DIR = path.join(__dirname, 'audio_out');
if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

async function generateUrduVoice(text, voiceName = 'ur-PK-AsadNeural') {
    try {
        let cleanText = text
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/#/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // strip emojis for TTS
            .trim();

        if (!cleanText) return null;

        const tts = new MsEdgeTTS();
        await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        
        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(7);
        const tempMp3Path = path.join(AUDIO_DIR, `temp_${timestamp}_${rand}.mp3`);
        const finalOggPath = path.join(AUDIO_DIR, `voice_${timestamp}_${rand}.ogg`);

        // 1. Generate MP3 via EdgeTTS (Full Length - No Character Limit)
        await tts.toFile(AUDIO_DIR, cleanText);
        const defaultMp3 = path.join(AUDIO_DIR, 'audio.mp3');
        if (fs.existsSync(defaultMp3)) {
            fs.renameSync(defaultMp3, tempMp3Path);
        } else {
            return null;
        }

        // 2. Convert MP3 to WhatsApp-compliant Ogg Opus using ffmpeg
        try {
            execSync(`ffmpeg -y -i "${tempMp3Path}" -c:a libopus -b:a 32k -vbr on "${finalOggPath}"`, {
                stdio: 'ignore',
                timeout: 30000
            });
            
            // Clean up temporary MP3
            if (fs.existsSync(tempMp3Path)) {
                fs.unlinkSync(tempMp3Path);
            }

            if (fs.existsSync(finalOggPath) && fs.statSync(finalOggPath).size > 0) {
                return finalOggPath;
            }
        } catch (err) {
            console.error('ffmpeg conversion error:', err.message);
            // Fallback to tempMp3Path if ffmpeg fails
            return tempMp3Path;
        }

        return null;
    } catch (e) {
        console.error('Voice generation error:', e.message);
        return null;
    }
}

module.exports = {
    generateUrduVoice
};
