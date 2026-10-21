# AgriBot CRM Engine (بشیر - Basheer)

24/7 Autonomous WhatsApp AI AgriBot and CRM Factory for Pakistani Agriculture.
Supervised by **Agriculture Specialist Shahzaib Arshad**.

## Architecture
- **WhatsApp API Gateway**: Cloud WAHA Docker Engine on Render
- **Core Intelligence**: Gemini 3.8 Flash (Agricultural advisory, reasoning, anti-hallucination)
- **Voice Intelligence (STT)**: Groq Cloud Whisper Large-v3 (<700ms ultra-low latency)
- **Voice Intelligence (TTS)**: Edge TTS / Gemini TTS studio audio
- **Grounded Knowledge**:
  - Daily Mandi Rates (AMIS Punjab / Market Committees - amis.pk)
  - Syngeta / Naya Savera Crop Protection Knowledge Base
  - Live Weather & Climate Advisories

## Environment Variables
- `PORT`: HTTP port (default: 3000)
- `GEMINI_API_KEY`: Google Gemini Interactions API Key
- `GROQ_API_KEY`: Groq Cloud API Key
- `WAHA_BASE_URL`: WhatsApp API URL (e.g. `https://waha-whatsapp-server.onrender.com`)
- `WAHA_API_KEY`: WhatsApp API Security Key
