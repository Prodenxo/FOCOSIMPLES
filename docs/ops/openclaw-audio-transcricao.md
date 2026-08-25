# Transcrição de áudio (WhatsApp)

## OpenClaw directo (QR no OpenClaw)

1. **Easypanel → OpenClaw → Environment** — adiciona **uma** chave:
   - `OPENAI_API_KEY=sk-...` **ou**
   - `GROQ_API_KEY=gsk_...` (Groq Whisper, mais barato)

2. **Console OpenClaw** — activa STT no `openclaw.json`:

```sh
node -e '
const fs=require("fs");
const p="/home/node/.openclaw/openclaw.json";
const c=JSON.parse(fs.readFileSync(p,"utf8"));
const groq=(process.env.GROQ_API_KEY||"").trim();
const openai=(process.env.OPENAI_API_KEY||"").trim();
c.tools=c.tools||{};
c.tools.media=c.tools.media||{};
c.tools.media.audio={enabled:true,maxBytes:20971520,models:groq?[{
  provider:"groq",model:"whisper-large-v3",baseUrl:"https://api.groq.com/openai/v1",
  capabilities:["audio"],language:"pt",timeoutSeconds:60
}]:[{
  provider:"openai",model:"gpt-4o-mini-transcribe",capabilities:["audio"],language:"pt"
}]};
fs.writeFileSync(p,JSON.stringify(c,null,2));
console.log("STT ok", c.tools.media.audio.models[0]);
'
```

3. **Restart** OpenClaw → envia nota de voz de teste.

Sucesso: no chat OpenClaw aparece bloco `[Audio]` com **Transcript:** em português.

---

## Z-API → Backend → OpenClaw (relay)

No **backend** Easypanel:

```env
WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED=true
OPENAI_API_KEY=sk-...
# ou GROQ_API_KEY=gsk_...
```

Monitor: `GET /api/webhooks/zapi/monitor` → `audioTranscription.configured: true`

O backend transcreve antes do relay; o OpenClaw recebe texto.
