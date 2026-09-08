# Vardha AI Voice Agent

A full-stack, demo-ready AI voice-calling application for Indian mobile numbers.

Vardha AI Voice Agent starts an outbound Exotel call, establishes a real-time bidirectional Voicebot WebSocket session, processes caller speech through STT → Knowledge Base retrieval → LLM → TTS, and stores call metadata, recording information, transcript, summary, duration, and status in MongoDB.

The system is designed around **Knowledge Base-grounded answers**, meaning the AI should answer company-related questions only from verified information configured by the administrator.

---

# Features

## Voice Calling

* Indian mobile number validation.
* Automatic `+91` normalization.
* Outbound calls through Exotel.
* Existing Exotel Flow + Voicebot architecture.
* Bidirectional WebSocket media streaming.
* Raw PCM/slin 16-bit mono audio.
* 8 kHz / 16 kHz / 24 kHz stream-rate awareness.
* Caller speech detection using VAD.
* Real-time conversational processing.
* AI-generated voice responses.
* Call recording support.

## AI Pipeline

```text
Caller
   │
   ▼
Exotel Voicebot
   │
   │ PCM16 audio
   ▼
WebSocket Server
   │
   ▼
VAD
   │
   ▼
Speech-to-Text
   │
   ▼
Knowledge Base Retrieval
   │
   ▼
Grounded LLM
   │
   ▼
Text-to-Speech
   │
   ▼
PCM16 Audio
   │
   ▼
Exotel Voicebot
   │
   ▼
Caller
```

The application uses:

* **Groq Whisper Large V3 Turbo** for speech-to-text.
* **Knowledge Base retrieval** for company information.
* **Google Gemini 3.6 Flash** for grounded response generation.
* **Groq Orpheus V1 English** for text-to-speech.
* **MongoDB** for calls and Knowledge Base data.
* **Exotel AgentStream / Voicebot** for telephone connectivity.

---

# Knowledge Base Safety

The AI is intentionally restricted to verified Knowledge Base information.

For supported questions:

```text
Caller:
"What services does your company provide?"
```

The system retrieves the relevant company information and generates a response.

For unsupported questions:

```text
Caller:
"What is today's weather in Delhi?"
```

The AI should respond:

> I'm sorry, I don't have that information in my knowledge base.

The system does not intentionally invent company facts.

If the LLM is unavailable or produces an ungrounded response, a deterministic Knowledge Base response can be used as a fallback.

---

# Conversation Memory

Conversation state is maintained **per call**.

Each call has its own:

* Conversation history
* Transcript entries
* Retrieved Knowledge Base context
* AI responses
* Processing state

There is no shared global conversation state between callers.

Example:

```text
Call A
 ├── Customer question 1
 ├── AI answer 1
 ├── Customer follow-up
 └── AI answer using Call A context

Call B
 ├── Customer question 1
 └── AI answer using Call B context
```

Call A's conversation is never intentionally mixed with Call B.

---

# Architecture

```text
                    ┌───────────────────────┐
                    │     React Frontend    │
                    │    Tailwind CSS       │
                    └───────────┬───────────┘
                                │ REST
                                ▼
                    ┌───────────────────────┐
                    │   Express / Node.js   │
                    │       Backend         │
                    └───────┬───────┬───────┘
                            │       │
                 REST/API   │       │ WebSocket
                            │       │
                            ▼       ▼
                     ┌──────────┐  ┌────────────────┐
                     │ MongoDB  │  │ Exotel Voicebot│
                     └──────────┘  └───────┬────────┘
                                           │
                                           │ Caller audio
                                           ▼
                                  ┌──────────────────┐
                                  │       VAD        │
                                  └────────┬─────────┘
                                           ▼
                                  ┌──────────────────┐
                                  │      Groq STT    │
                                  │ Whisper V3 Turbo │
                                  └────────┬─────────┘
                                           ▼
                                  ┌──────────────────┐
                                  │ Knowledge Base   │
                                  │    Retrieval     │
                                  └────────┬─────────┘
                                           ▼
                                  ┌──────────────────┐
                                  │   Gemini 3.6     │
                                  │      Flash       │
                                  └────────┬─────────┘
                                           ▼
                                  ┌──────────────────┐
                                  │   Groq Orpheus   │
                                  │       TTS        │
                                  └────────┬─────────┘
                                           ▼
                                  PCM16 8kHz Audio
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │ Exotel Voicebot  │
                                  └──────────────────┘
```

---

# Exotel Voicebot Architecture

The project intentionally uses:

> **Existing Exotel Flow + Bidirectional Voicebot**

rather than implementing a second direct-streaming calling architecture.

The flow is:

```text
Call Start
    │
    ▼
Voicebot Applet
    │
    │ WSS
    ▼
/api/voicebot/media
    │
    ▼
AI Voice Processing
    │
    ▼
Voicebot stream ends
    │
    ▼
Passthru
    │
    ▼
Call status / recording metadata
    │
    ▼
MongoDB
    │
    ▼
Hangup
```

The Voicebot WebSocket processes:

```text
connected
start
media
dtmf
mark
stop
clear
```

The media format is:

```text
Encoding: PCM / slin
Bit depth: 16-bit
Channels: Mono
Byte order: Little-endian
Default sample rate: 8000 Hz
Transport: Base64
```

Exotel's streaming documentation describes Voicebot as a bidirectional WebSocket media connection, with raw signed 16-bit audio at the configured sampling rate.

---

# Important Current Voicebot Status

The backend and Exotel integration are deployed and the WebSocket connection is successfully established.

Current successful events include:

```text
Voicebot WebSocket connected
start event received
CallSid received
StreamSid received
sample rate detected
TTS audio generated
PCM audio converted to 8 kHz mono
outbound media generated
Passthru received
recording URL received
MongoDB call updated
```

However, the current production Voicebot test still has an unresolved media/playback problem:

```text
Call connects
      ↓
Voicebot WebSocket connects
      ↓
Greeting generated
      ↓
Outbound media begins
      ↓
Exotel sends stop
      ↓
Call ends after approximately 2–3 seconds
```

The caller currently may hear no audio before the call ends.

Therefore this repository should be considered:

```text
REST API                 ✅
MongoDB                  ✅
Exotel outbound call     ✅
Voicebot WebSocket       ✅
Passthru                 ✅
Recording metadata       ✅
STT                      ✅
LLM                      ✅
TTS generation           ✅
Voicebot playback        ⚠️ Under active debugging
Full live conversation   ⚠️ Not yet production verified
```

This distinction is important: generating valid TTS audio is not the same as successfully delivering and playing that audio through Exotel.

---

# Voicebot Debugging Strategy

The Voicebot media path should be tested independently from the AI pipeline.

The recommended debugging sequence is:

```text
1. WebSocket connection
        ↓
2. Receive start event
        ↓
3. Receive inbound media
        ↓
4. Send known PCM test audio
        ↓
5. Verify caller hears test audio
        ↓
6. Verify mark behavior
        ↓
7. Enable TTS
        ↓
8. Enable STT
        ↓
9. Enable LLM
        ↓
10. Enable complete conversation
```

This isolates:

* Exotel protocol problems
* WebSocket lifecycle problems
* PCM format problems
* TTS problems
* STT problems
* LLM problems

instead of debugging the entire AI stack simultaneously.

---

# Frontend Architecture

```text
frontend/src/
│
├── components/
│   ├── common/
│   │   ├── Button
│   │   ├── Input
│   │   ├── Card
│   │   ├── Modal
│   │   ├── Loading
│   │   ├── EmptyState
│   │   └── ErrorState
│   │
│   ├── layout/
│   │   ├── AppLayout
│   │   ├── Sidebar
│   │   ├── Header
│   │   └── MobileSidebar
│   │
│   ├── calls/
│   │   ├── CallForm
│   │   ├── CallStatus
│   │   ├── CallTable
│   │   ├── RecordingPlayer
│   │   ├── Transcript
│   │   └── Summary
│   │
│   └── knowledge/
│       ├── KnowledgeForm
│       ├── FAQEditor
│       └── KnowledgeSection
│
├── hooks/
│   ├── useCalls
│   └── useKnowledgeBase
│
├── pages/
│   ├── Dashboard
│   ├── NewCall
│   ├── CallHistory
│   ├── CallDetails
│   ├── KnowledgeBase
│   └── NotFound
│
├── services/
│   └── api
│
├── utils/
│   ├── date
│   ├── duration
│   ├── status
│   └── phone
│
├── App.jsx
└── index.css
```

---

# Frontend Routes

| Route             | Purpose                       |
| ----------------- | ----------------------------- |
| `/dashboard`      | Dashboard and call statistics |
| `/calls/new`      | Start a new outbound call     |
| `/calls`          | Call history                  |
| `/calls/:id`      | Call details                  |
| `/knowledge-base` | Manage company information    |
| `*`               | Not found                     |

---

# Dashboard

The dashboard displays:

* Total calls
* Completed calls
* Failed calls
* Active/recent calls
* Recent call activity
* Call status
* Duration
* Recording availability

---

# New Call

The New Call page:

1. Validates Indian mobile numbers.
2. Normalizes the number to `+91`.
3. Sends the call request to the backend.
4. Displays call progress.
5. Polls call status.
6. Provides access to call details after completion.

Example:

```text
9876543210
      ↓
+919876543210
      ↓
POST /api/calls
      ↓
Exotel
      ↓
Voicebot
```

---

# Call History

The Call History page supports:

* Search
* Status filtering
* Refresh
* Responsive desktop table
* Mobile cards
* Recording availability
* Call duration
* Call date/time
* Call details navigation

---

# Call Details

Each call can contain:

```text
Phone Number
Call SID
Stream SID
Status
Direction
Duration
Started At
Ended At
Recording
Transcript
Summary
Processing Status
```

Transcript example:

```text
Customer:
What services do you provide?

AI:
We provide web development and AI automation services.

Customer:
Do you provide support?

AI:
Yes. Our support information is available in the company knowledge base.
```

---

# Knowledge Base

The Knowledge Base contains verified company information.

Example structure:

```text
Company
├── Company Profile
├── Services
├── Commercial Information
├── Support
├── Contact
└── FAQs
```

The administrator can update this information without modifying application source code.

---

# Backend Architecture

```text
backend/src/
│
├── config/
│   ├── database
│   └── public URL
│
├── controllers/
│   ├── calls
│   ├── knowledge
│   └── Exotel status
│
├── models/
│   ├── Call
│   └── KnowledgeBase
│
├── routes/
│   ├── calls
│   ├── knowledge
│   └── webhooks
│
├── services/
│   ├── Exotel
│   ├── STT
│   ├── retrieval
│   ├── LLM
│   ├── TTS
│   ├── transcript
│   ├── summary
│   └── post-call
│
├── websocket/
│   └── voicebot.server.js
│
└── server.js
```

---

# MongoDB

The application uses two primary collections.

## KnowledgeBase

Stores:

* Company profile
* Services
* Pricing/commercial information
* Support information
* Contact information
* FAQs

## Call

Stores:

```text
phoneNumber
callSid
status
direction
recordingUrl
transcript
transcriptEntries
summary
summaryData
processingStatus
processingError
postProcessingCompleted
recordingAvailable
streamSid
streamEndedAt
duration
startedAt
endedAt
exotelResponse
webhookData
```

---

# API

| Method   | Endpoint                      | Description               |
| -------- | ----------------------------- | ------------------------- |
| GET      | `/`                           | API availability          |
| GET      | `/health`                     | Backend + database health |
| POST     | `/api/calls`                  | Create outbound call      |
| GET      | `/api/calls`                  | Get call history          |
| GET      | `/api/calls/:id`              | Get call details          |
| GET      | `/api/knowledge`              | Get Knowledge Base        |
| PUT      | `/api/knowledge`              | Update Knowledge Base     |
| GET      | `/api/voicebot/endpoint`      | Dynamic WSS resolver      |
| WSS      | `/api/voicebot/media`         | Voicebot media            |
| GET/POST | `/api/webhooks/exotel/status` | Exotel callback           |

---

# Environment Variables

## Backend

```env
PORT=5000

MONGODB_URI=mongodb+srv://...

PUBLIC_BASE_URL=https://your-domain.com

FRONTEND_ORIGIN=http://localhost:5173

EXOTEL_ACCOUNT_SID=
EXOTEL_API_KEY=
EXOTEL_API_TOKEN=

EXOTEL_BASE_URL=
EXOTEL_PHONE_NUMBER=
EXOTEL_FLOW_ID=

EXOTEL_STATUS_CALLBACK_URL=

GROQ_API_KEY=

STT_PROVIDER=groq
STT_MODEL=whisper-large-v3-turbo

LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.6-flash
GEMINI_API_KEY=

TTS_PROVIDER=groq
TTS_MODEL=canopylabs/orpheus-v1-english

VAD_ENERGY_THRESHOLD=
POST_CALL_PROCESSING_DELAY_MS=
```

Never commit real API keys.

---

# Frontend Environment

```env
VITE_API_BASE_URL=https://your-api-domain.com/api
```

For local development:

```env
VITE_API_BASE_URL=/api
```

---

# Exotel Configuration

The existing Exotel flow should contain:

```text
Call Start
     ↓
Voicebot
     ↓
Passthru
     ↓
Hangup
```

Voicebot:

```text
WSS URL:

wss://YOUR_PUBLIC_DOMAIN/api/voicebot/media
```

or dynamic:

```text
https://YOUR_PUBLIC_DOMAIN/api/voicebot/endpoint
```

Recording:

```text
ON
```

Recommended recording format:

```text
MP3
```

The application receives stream metadata and recording information through the configured Passthru/status callback.

---

# Public Deployment

A public HTTPS/WSS endpoint is required.

Example:

```text
https://vardha-ai-voice-agent-api.onrender.com
```

Voicebot:

```text
wss://vardha-ai-voice-agent-api.onrender.com/api/voicebot/media
```

API:

```text
https://vardha-ai-voice-agent-api.onrender.com/api
```

Do not use:

```text
localhost
127.0.0.1
```

for Exotel callbacks or WebSocket connections.

---

# Local Development

## Backend

```powershell
cd backend

npm install

npm test

npm run dev
```

## Frontend

```powershell
cd frontend

npm install

npm run dev
```

## ngrok

```powershell
ngrok http 5000
```

Then configure:

```env
PUBLIC_BASE_URL=https://YOUR-NGROK-DOMAIN.ngrok-free.app
```

Restart the backend after changing the environment variable.

---

# Testing

Backend syntax:

```powershell
Get-ChildItem src,test -Recurse -Filter *.js |
ForEach-Object {
    node --check $_.FullName
}
```

Backend:

```powershell
npm test
```

Frontend:

```powershell
npm run lint
npm run build
```

API:

```powershell
Invoke-RestMethod http://localhost:5000/

Invoke-RestMethod http://localhost:5000/health

Invoke-RestMethod http://localhost:5000/api/calls

Invoke-RestMethod http://localhost:5000/api/knowledge
```

Test webhook:

```powershell
Invoke-RestMethod `
  http://localhost:5000/api/webhooks/exotel/status `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"CallSid":"TEST_CALL","Status":"completed"}'
```

---

# Production Cost / Pricing

## Important

There is **no single fixed "Vardha AI" price** because the system uses multiple paid infrastructure/API providers.

The total cost of one AI call is approximately:

```text
Total Call Cost
=
Exotel telephony
+
Exotel AgentStream
+
STT
+
LLM
+
TTS
+
Hosting
+
MongoDB
+
Optional monitoring/storage
```

The actual Exotel AgentStream price must be obtained from Exotel because Exotel currently lists Voice Streaming / Agent Stream as a separate offering rather than including it in the standard business-phone plans.

---

# 1. Exotel Telephony Cost

Exotel's published material gives an indicative Indian outbound calling range of approximately:

```text
₹0.80 – ₹1.00 / minute
```

This is an indicative reference and **not a guaranteed quote for your account**. Your actual contract, circle, plan, taxes, number rental, and calling configuration can change the final amount.

Example:

| Call Duration | Indicative Telephony Cost |
| ------------: | ------------------------: |
|         1 min |               ₹0.80–₹1.00 |
|         5 min |                     ₹4–₹5 |
|        10 min |                    ₹8–₹10 |
|       100 min |                  ₹80–₹100 |
|     1,000 min |               ₹800–₹1,000 |

GST and account-specific charges may apply.

---

# 2. Exotel AgentStream / Voicebot

This is a separate cost component.

Exotel states that Voice Streaming / Agent Stream is excluded from its standard plans and requires separate pricing.

Therefore:

```text
AgentStream Cost = Contact Exotel
```

Do not hard-code an assumed ₹/minute value into the application.

For production budgeting, request from Exotel:

```text
AgentStream per-minute price
Concurrent stream limits
Minimum monthly commitment
Recording charges
Number rental
Outbound calling charges
GST
SLA/support charges
```

---

# 3. Groq Speech-to-Text

The current project uses:

```text
whisper-large-v3-turbo
```

Groq currently lists:

```text
$0.04 / hour
```

for Whisper Large V3 Turbo.

Approximate cost:

|     STT Usage |      Cost |
| ------------: | --------: |
|      1 minute | ~$0.00067 |
|    10 minutes |  ~$0.0067 |
|   100 minutes |  ~$0.0667 |
| 1,000 minutes |    ~$0.67 |

This is extremely small compared with telephony.

---

# 4. Groq Text-to-Speech

The project currently uses:

```text
canopylabs/orpheus-v1-english
```

Groq currently lists:

```text
$22 / 1 million characters
```

for this model.

Approximate examples:

| TTS Characters | Approx. Cost |
| -------------: | -----------: |
|          1,000 |       $0.022 |
|         10,000 |        $0.22 |
|        100,000 |        $2.20 |
|      1,000,000 |          $22 |

Because TTS billing is character-based, reducing unnecessary AI speech directly reduces cost.

---

# 5. Gemini LLM

The current application uses:

```text
gemini-3.6-flash
```

Current Gemini API pricing through December 31, 2026 is:

```text
Input:
$0.75 / 1M tokens

Output:
$3.75 / 1M tokens
```

Google lists higher pricing beginning January 1, 2027:

```text
Input:
$1.50 / 1M tokens

Output:
$7.50 / 1M tokens
```

This means the LLM is also relatively inexpensive for short conversational responses.

---

# 6. Example AI Cost

Assume a hypothetical:

```text
10-minute phone call
```

and approximately:

```text
10 minutes Exotel
10 minutes STT
3,000 TTS characters
8,000 Gemini input tokens
2,000 Gemini output tokens
```

The provider costs are approximately:

### Telephony

```text
10 × ₹0.80–₹1.00

= ₹8–₹10
```

### STT

```text
10 × $0.04 / 60

≈ $0.0067
```

### TTS

```text
3,000 × $22 / 1,000,000

≈ $0.066
```

### Gemini

```text
8,000 input tokens
≈ $0.006

2,000 output tokens
≈ $0.0075

Total ≈ $0.0135
```

So, excluding the separately priced Exotel AgentStream component:

```text
Approximate AI cost
≈ $0.086
```

plus approximately:

```text
₹8–₹10
```

for the indicative Exotel telephony component.

The actual production cost depends heavily on the percentage of the call spent speaking, TTS characters, LLM tokens, Exotel pricing, taxes, hosting and other infrastructure.

---

# 7. Monthly Cost Example

For:

```text
1,000 calls/month
10 minutes/call
```

Total conversation time:

```text
1,000 × 10
=
10,000 minutes/month
```

Indicative Exotel telephony:

```text
10,000 × ₹0.80–₹1.00

= ₹8,000–₹10,000/month
```

STT:

```text
10,000 minutes
≈ $6.67
```

TTS depends on generated characters.

For example, with:

```text
300,000 TTS characters/month
```

the TTS cost is approximately:

```text
300,000 × $22 / 1,000,000

= $6.60
```

Gemini would generally remain relatively small for short grounded responses, although actual usage depends on prompt/context and response length.

**AgentStream pricing must be added separately after receiving an Exotel quotation.**

---

# 8. Hosting Cost

The application can be deployed using:

```text
Frontend
   ↓
Static hosting / Vercel / Netlify / similar

Backend
   ↓
Render / VPS / Cloud Run / similar

Database
   ↓
MongoDB Atlas
```

Hosting cost depends on:

* CPU
* RAM
* concurrent calls
* bandwidth
* uptime requirements
* WebSocket support
* database storage
* recording storage

For development/demo usage, free or low-cost tiers may be sufficient.

For production voice workloads, use a paid backend instance with sufficient resources and reliable WebSocket support.

---

# 9. Cost Optimization

The application already has several opportunities to control cost.

## VAD

Do not send every silence segment to STT.

```text
Caller speaks
      ↓
VAD detects speech
      ↓
STT
```

instead of:

```text
Entire call audio
      ↓
STT continuously
```

---

## Knowledge Base Retrieval

Only relevant company information is sent to the LLM.

Instead of:

```text
Entire company database
      ↓
Gemini
```

use:

```text
Question
   ↓
Relevant KB entries
   ↓
Gemini
```

This reduces token consumption.

---

## Response Length

Keep phone responses concise.

For example:

```text
Instead of:

"We are very pleased to inform you that our company
provides a wide range of..."

Use:

"We provide web development, mobile development,
and AI automation services."
```

Shorter responses:

* reduce TTS characters
* reduce call duration
* reduce LLM output
* improve conversational latency

---

# 10. Recommended Commercial Pricing

If Vardha AI Voice Agent is offered as a service to customers, do **not** price it only according to raw API costs.

Use:

```text
Customer Price
=
Infrastructure Cost
+
AI Cost
+
Telephony
+
AgentStream
+
Hosting
+
Maintenance
+
Support
+
Profit Margin
```

A practical SaaS structure can be:

| Plan       | Example Monthly Price | Included Minutes |
| ---------- | --------------------: | ---------------: |
| Demo       |                  Free |            10–20 |
| Starter    |                  ₹999 |              100 |
| Business   |                ₹2,999 |              500 |
| Pro        |                ₹7,999 |            1,500 |
| Enterprise |                Custom |           Custom |

These are **example product prices**, not Exotel/provider prices.

For a real commercial launch, calculate the exact price after receiving your Exotel AgentStream quotation.

---

# 11. Usage-Based Billing

A more scalable model is:

```text
Monthly Platform Fee
+
Per-Minute Usage
```

For example:

```text
₹999/month
+
₹X/minute
```

The per-minute amount should include:

```text
Exotel
+
AgentStream
+
STT
+
LLM
+
TTS
+
Infrastructure
+
Margin
```

This is preferable for high-volume customers because customers pay according to actual usage.

---

# 12. Example Commercial Architecture

```text
Customer
   │
   ▼
Vardha AI Dashboard
   │
   ▼
Monthly Subscription
   │
   ├── Platform Fee
   │
   └── Usage Charges
          │
          ▼
      AI Voice Call
          │
          ├── Exotel
          ├── AgentStream
          ├── Groq STT
          ├── Gemini
          └── Groq TTS
```

---

# 13. Provider Pricing Reference

Pricing should always be rechecked before commercial billing.

### Exotel

Standard Exotel plans include telephony-related features, but Exotel currently states that Agent Stream / Voice Streaming is a separate offering.

### Groq STT

Whisper Large V3 Turbo:

```text
$0.04/hour
```

### Groq TTS

Orpheus V1 English:

```text
$22 / 1M characters
```

### Gemini

Gemini 3.6 Flash:

```text
$0.75 / 1M input tokens
$3.75 / 1M output tokens
```

through December 31, 2026.

---

# 14. Security

Never expose:

```text
EXOTEL_API_KEY
EXOTEL_API_TOKEN
GROQ_API_KEY
GEMINI_API_KEY
MONGODB_URI
```

to the frontend.

Frontend receives only:

```text
Call ID
Status
Duration
Transcript
Summary
Recording URL
```

Secrets remain server-side.

---

# 15. Production Checklist

Before commercial deployment:

```text
[ ] MongoDB Atlas production cluster
[ ] Production Exotel account
[ ] Exotel KYC completed
[ ] AgentStream enabled
[ ] AgentStream pricing confirmed
[ ] Production Exotel number
[ ] Production Caller ID
[ ] Voicebot flow configured
[ ] WSS endpoint verified
[ ] Passthru configured
[ ] Recording verified
[ ] STT API billing enabled
[ ] TTS API billing enabled
[ ] Gemini API billing enabled
[ ] Backend paid hosting
[ ] Frontend production hosting
[ ] HTTPS enabled
[ ] WebSocket connectivity verified
[ ] Rate limiting
[ ] Authentication
[ ] API logging
[ ] Error monitoring
[ ] Call-cost monitoring
[ ] Usage limits
[ ] Customer billing
[ ] Data retention policy
[ ] Privacy policy
[ ] Consent/recording disclosure
```

---

# 16. End-to-End Demo

### Step 1

Open:

```text
Knowledge Base
```

Enter verified company information.

### Step 2

Verify:

```text
MongoDB
Exotel
Voicebot
WSS
STT
LLM
TTS
```

### Step 3

Open:

```text
New Call
```

Enter:

```text
9876543210
```

The backend normalizes it to:

```text
+919876543210
```

### Step 4

The system starts:

```text
Exotel Call
      ↓
Voicebot
      ↓
WebSocket
      ↓
AI pipeline
```

### Step 5

Ask:

```text
What services do you provide?
```

Then ask a follow-up:

```text
Do you provide support?
```

Then ask an unsupported question.

### Step 6

Open:

```text
Call History
      ↓
Call Details
```

Verify:

```text
Status
Duration
Recording
Transcript
Summary
```

---

# 17. Troubleshooting

## Backend doesn't start

Check:

```text
MONGODB_URI
```

Then:

```powershell
Invoke-RestMethod http://localhost:5000/health
```

---

## Exotel cannot connect

Check:

```text
PUBLIC_BASE_URL
HTTPS
WSS
Voicebot configuration
Exotel AgentStream access
Firewall
Ingress
```

Never use localhost for Exotel.

---

## Call connects but no voice

Check:

```text
WebSocket start event
sample rate
PCM format
outbound media
Exotel stop event
mark events
inbound media
```

Then isolate TTS by sending a known generated PCM test tone.

---

## Call disconnects after 2–3 seconds

Check server logs for:

```text
stop
close
error
finishSession
Passthru
DisconnectedBy
Stream[Error]
Stream[DetailedStatus]
```

A Passthru executed after the Voicebot stream ends should not be confused with the original reason the stream ended.

---

## Recording missing

Verify:

```text
Voicebot recording = ON
```

and confirm the Passthru/status callback contains:

```text
Stream[RecordingUrl]
```

---

## Summary missing

Check:

```text
transcriptEntries
processingStatus
postProcessingCompleted
processingError
```

The transcript should remain available even if optional summary generation fails.

---

# 18. Project Status

```text
Frontend                  ✅
REST API                  ✅
MongoDB                   ✅
Knowledge Base            ✅
Outbound Exotel API       ✅
Exotel Flow               ✅
Voicebot WebSocket        ✅ Connected
Passthru                  ✅
Recording metadata        ✅
STT service               ✅
LLM service               ✅
TTS generation            ✅
TTS → Exotel playback     ⚠️ Debugging
Full conversation         ⚠️ Pending final media verification
Production billing        ⚠️ Requires Exotel AgentStream quote
```

---

# 19. Technology Stack

## Frontend

* React
* JavaScript / ES6+
* Vite
* Tailwind CSS v4
* Axios
* React Router

## Backend

* Node.js
* Express.js
* WebSocket (`ws`)
* Mongoose
* REST APIs

## AI

* Groq Whisper Large V3 Turbo
* Google Gemini 3.6 Flash
* Groq Canopy Labs Orpheus V1 English
* Voice Activity Detection
* Knowledge Base grounding

## Telephony

* Exotel
* Exotel Voicebot
* Exotel AgentStream
* Bidirectional WebSocket audio

## Database

* MongoDB
* MongoDB Atlas
* Mongoose

## Deployment

* Render
* Git
* GitHub
* npm
* ngrok for local Exotel testing

---

# 20. Final Architecture Summary

```text
                    VARDHA AI VOICE AGENT
                             │
             ┌───────────────┴───────────────┐
             │                               │
          FRONTEND                        BACKEND
             │                               │
       React + Tailwind              Node + Express
             │                               │
             │                        ┌──────┴──────┐
             │                        │             │
             │                    MongoDB       Exotel
             │                                      │
             │                                  Voicebot
             │                                      │
             │                                     WSS
             │                                      │
             │                                      ▼
             │                                   VAD
             │                                      │
             │                                      ▼
             │                                  Groq STT
             │                                      │
             │                                      ▼
             │                                  KB Search
             │                                      │
             │                                      ▼
             │                                Gemini 3.6
             │                                      │
             │                                      ▼
             │                                Groq Orpheus
             │                                      │
             │                                      ▼
             │                                  PCM Audio
             │                                      │
             └──────────────────────────────────────┘
```

The core goal is:

> **A controlled AI voice agent that communicates with Indian customers over real phone calls, answers only from verified company knowledge, and preserves the complete call record for review and follow-up.**
