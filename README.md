# VoiceChurch

Real-time speech translation service for churches. Translates Spanish sermons to English in real-time.

## Features

- Real-time speech-to-text (Deepgram)
- Real-time translation (DeepL)
- WebSocket-based live streaming
- Browser text-to-speech for listeners
- Unique room links for each broadcast

## Project Structure

```
voicechurch/
├── apps/
│   ├── server/     # Node.js WebSocket server
│   └── web/        # React frontend
```

## Local Development

1. Copy `.env.example` to `.env` and add your API keys
2. Install dependencies: `npm install`
3. Run: `npm run dev`

## Deployment

- **Frontend**: Vercel
- **Backend**: Railway

### Environment Variables

**Server (Railway):**
- `DEEPGRAM_API_KEY` - Deepgram API key
- `DEEPL_API_KEY` - DeepL API key
- `FRONTEND_URL` - Frontend URL for CORS

**Frontend (Vercel):**
- `VITE_WS_URL` - WebSocket server URL (e.g., `wss://your-app.railway.app`)
