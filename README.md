# Vardha AI Voice Agent

A clean, demo-ready AI voice-calling application for Indian mobile numbers. It starts an outbound Exotel call, hosts a real-time two-way conversation, answers company questions only from an editable Knowledge Base, and saves the recording URL, transcript, summary, status, and duration to MongoDB.

## Features

- Indian mobile validation and normalized `+91` outbound dialing.
- Exotel outbound calling through the existing flow and bidirectional Voicebot applet.
- Per-call STT → Knowledge Base retrieval → LLM → TTS pipeline.
- Strict Knowledge Base-only company answers; unsupported facts receive a polite fallback.
- Follow-up-aware per-call conversation history with no shared global call state.
- Call recording URL, two-sided transcript, idempotent transcript-only summary, duration, status, and call history.
- Responsive React + Tailwind dashboard, New Call, Call History, Call Details, and Knowledge Base pages.
- Accessible forms, keyboard navigation, loading, error, empty, and status states.

## Architecture

```text
React + Tailwind UI
        │ REST
        ▼
Express API + MongoDB ──► Exotel Calls API ──► Existing Exotel flow
        │                                      └─ Voicebot applet
        │                                           │ WSS /api/voicebot/media
        │                                           ▼
        │                                   STT → KB retrieval → LLM → TTS
        │                                           │
        └── Exotel status/Passthru webhook ◄────────┘
                  │
                  └── Call record, recording URL, transcript, summary
```

### Exotel architecture: Voicebot flow (Option B)

This repository intentionally uses the existing Exotel **flow + bidirectional Voicebot applet**, not a second direct-streaming implementation. `POST /api/calls` calls Exotel with the configured flow URL; the Voicebot applet opens the WebSocket connection to this server.

The server processes Exotel Voicebot JSON events `connected`, `start`, `media`, `dtmf`, `mark`, `stop`, and `clear`, and handles WebSocket errors and closes. Media is raw/slin 16-bit mono little-endian PCM encoded as Base64. The default is 8 kHz; the WebSocket reads the documented `start.media_format.sample_rate` when the applet is configured for 8/16/24 kHz and keeps STT/TTS output in that same rate.

## Frontend architecture

Tailwind CSS v4 is integrated through `@tailwindcss/vite`; no Tailwind config file is needed for this Vite setup. Shared visual styles use utility classes and a small theme in `src/index.css`.

```text
frontend/src/
  components/
    common/       Button, Input, Card, Modal, state components, status badge
    layout/       AppLayout, Sidebar, Header, MobileSidebar
    calls/        CallForm, status, tables/cards, recording, transcript, summary
    knowledge/    KnowledgeForm, FAQEditor, KnowledgeSection
  hooks/          useCalls, useKnowledgeBase
  pages/          Dashboard, NewCall, CallHistory, CallDetails, KnowledgeBase, NotFound
  services/       centralized REST API client
  utils/          date, duration, status, Indian number helpers
  App.jsx         routes only
```

Pages:

- `/dashboard` — actual total, completed, failed, and recent calls.
- `/calls/new` — validated number entry and live call-state polling.
- `/calls` — responsive call table/cards, search, status filter, and refresh.
- `/calls/:id` — call metadata, recording playback, full transcript, and summary.
- `/knowledge-base` — add/update verified company information and FAQs.

`VITE_API_BASE_URL` is the frontend API base (include `/api` for a deployed API). It falls back to `VITE_API_URL` for existing setups and `/api` for Vite's local proxy.

## Backend architecture

```text
backend/src/
  config/       MongoDB connection and public URL helpers
  controllers/  calls, Knowledge Base, Exotel status webhook
  models/       Call and KnowledgeBase MongoDB schemas
  routes/       REST route definitions
  services/     Exotel, STT, retrieval, LLM, TTS, transcript, summary, post-call
  websocket/    Voicebot media server attached to the HTTP server
  server.js     one HTTP server for REST and WebSocket traffic
```

The LLM prompt forbids invented company facts. Retrieval sends only relevant KB fields/FAQs to the LLM and validates generated informational terms against the retrieved context. With no match, the response is: “I'm sorry, I don't have that information in my knowledge base.” A deterministic KB answer is used if an LLM is unavailable or its response is not grounded.

The summary generator reads only `transcriptEntries`, produces discussed topics, caller questions, caller requirement, important points, and follow-up needed, and is guarded by `processingStatus`/`postProcessingCompleted` so terminal webhook retries cannot create duplicate completed summaries.

## Environment variables

Never overwrite an existing secret-bearing `.env`. Templates are available at [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example).

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port (default `5000`) |
| `MONGODB_URI` | MongoDB local/Atlas URI |
| `PUBLIC_BASE_URL` | Public HTTPS base URL used for Exotel webhook and dynamic WSS URLs |
| `FRONTEND_ORIGIN` | Allowed frontend origin (optional) |
| `EXOTEL_ACCOUNT_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN` | Exotel API credentials |
| `EXOTEL_BASE_URL`, `EXOTEL_PHONE_NUMBER`, `EXOTEL_FLOW_ID` | Existing Exotel outbound flow configuration |
| `EXOTEL_STATUS_CALLBACK_URL` | Legacy callback fallback; `PUBLIC_BASE_URL` takes precedence |
| `OPENAI_API_KEY` or individual `STT_*`, `LLM_*`, `TTS_*` | OpenAI adapter configuration |
| `VAD_ENERGY_THRESHOLD`, `POST_CALL_PROCESSING_DELAY_MS` | Optional media/post-call tuning |
| `VITE_API_BASE_URL` | Deployed frontend API base ending in `/api` |

## MongoDB

Provide a local MongoDB server or Atlas URI. The backend refuses to start without a reachable `MONGODB_URI`; `GET /health` reports `success`, service name, database state, and timestamp. The two MongoDB documents are:

- `KnowledgeBase`: one editable default company record with company profile, services, commercial/support/contact content, and FAQs.
- `Call`: status, timestamps, duration, Exotel IDs/raw callback data, recording URL, structured transcript, derived plain transcript, and summary.

## Exotel and ngrok setup

1. Enable Exotel AgentStream/Voicebot for the account and retain the existing outbound flow ID.
2. Run `ngrok http 5000`, copy its HTTPS public URL to `PUBLIC_BASE_URL`, and restart the backend. Do not put a changing ngrok URL in source code.
3. In the existing Exotel flow's **Voicebot** applet, enable recording and configure either:

   - Static: `wss://YOUR_PUBLIC_DOMAIN/api/voicebot/media`
   - Dynamic: `https://YOUR_PUBLIC_DOMAIN/api/voicebot/endpoint`

   The dynamic endpoint returns `{ "url": "wss://…/api/voicebot/media" }`.
4. Add/retain the post-Voicebot Passthru/status callback to `https://YOUR_PUBLIC_DOMAIN/api/webhooks/exotel/status` so Exotel provides terminal status, duration, and recording metadata.
5. Use a publicly trusted TLS endpoint; Exotel cannot reach localhost. Configure Exotel IP allowlisting or basic WSS authentication at your ingress if required by the account.

The Calls API sends `CustomField` with the MongoDB Call ID. The Voicebot `start` event associates the stream with the returned Exotel `CallSid`; the webhook can associate through either value.

## Run locally

```powershell
# Terminal 1
cd backend
npm install
npm test
npm run dev

# Terminal 2
cd frontend
npm install
npm run dev

# Terminal 3, needed for Exotel callbacks/media only
ngrok http 5000
```

Vite runs on `http://localhost:5173` by default and proxies `/api`/`/health` to the backend in development.

## API and WebSocket endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | API availability response |
| `GET` | `/health` | Database-aware health check |
| `POST` | `/api/calls` | Create an outbound call with `phoneNumber` |
| `GET` | `/api/calls` | Newest-first call history |
| `GET` | `/api/calls/:id` | One call plus recording/transcript/summary |
| `GET` / `PUT` | `/api/knowledge` | Load/update the Knowledge Base |
| `GET` / `POST` | `/api/webhooks/exotel/status` | Exotel status/Passthru handler |
| `GET` | `/api/voicebot/endpoint` | Optional dynamic WSS resolver |
| `WSS` | `/api/voicebot/media` | Exotel Voicebot bidirectional media endpoint |

## Testing and validation

```powershell
cd backend
npm install
npm test
Get-ChildItem src,test -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }

cd ..\frontend
npm install
npm run lint
npm run build
```

Safe local smoke tests (these do not start a call):

```powershell
Invoke-RestMethod http://localhost:5000/
Invoke-RestMethod http://localhost:5000/health
Invoke-RestMethod http://localhost:5000/api/calls
Invoke-RestMethod http://localhost:5000/api/knowledge
Invoke-RestMethod http://localhost:5000/api/webhooks/exotel/status -Method Post -ContentType application/json -Body '{"CallSid":"TEST_CALL","Status":"completed"}'
```

The test webhook is deliberately acknowledged with `success: true` when no matching call exists.

## End-to-end demo

1. Enter verified company information on **Knowledge Base** and save it.
2. Confirm the Exotel flow, WSS endpoint, public callback URL, MongoDB, and STT/LLM/TTS credentials.
3. Use **New Call** to enter an Indian mobile number and click **Call**.
4. Ask a KB-supported question, a follow-up, and an unsupported question.
5. Open **Call History** → **View details** to play the recording when available and inspect the two-sided transcript and transcript-grounded summary.

## Troubleshooting

- **Backend will not boot:** Confirm `MONGODB_URI`; health is intentionally not reported as successful without MongoDB.
- **Exotel cannot reach the bot:** Verify the public WSS URL, trusted TLS, Voicebot feature access, flow configuration, and ingress allowlist. Do not use `localhost`.
- **Bot is silent:** Confirm STT and TTS provider variables/keys and that the Voicebot applet sample rate matches the reported `start` media format.
- **Calls fail immediately:** Check Exotel account/flow/Caller ID configuration and the server-side Exotel logs; API secrets are never returned to the browser.
- **Recording is missing:** Recording must be enabled in the Exotel Voicebot flow and its callback must include a recording URL. The UI intentionally remains usable without one.
- **No summary:** A terminal webhook or stream end triggers processing. The raw transcript is preserved even when the optional LLM summary adapter fails.
