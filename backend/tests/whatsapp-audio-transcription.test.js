import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractZapiAudioFromBody,
  getWhatsappAudioTranscriptionStatus,
} from '../src/services/whatsapp-audio-transcription.service.js';

test('extractZapiAudioFromBody lê audioUrl do payload Z-API', () => {
  const audio = extractZapiAudioFromBody({
    type: 'ReceivedCallback',
    audio: {
      audioUrl: 'https://cdn.z-api.io/voice.ogg',
      mimeType: 'audio/ogg',
      ptt: true,
    },
  });
  assert.ok(audio);
  assert.equal(audio.audioUrl, 'https://cdn.z-api.io/voice.ogg');
  assert.equal(audio.mimeType, 'audio/ogg');
});

test('extractZapiAudioFromBody retorna null sem áudio', () => {
  assert.equal(extractZapiAudioFromBody({ text: { message: 'oi' } }), null);
});

test('getWhatsappAudioTranscriptionStatus reflete env', () => {
  const prevOpenai = process.env.OPENAI_API_KEY;
  const prevGroq = process.env.GROQ_API_KEY;
  const prevFlag = process.env.WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED;
  try {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    process.env.WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED = 'true';
    let status = getWhatsappAudioTranscriptionStatus();
    assert.equal(status.configured, false);
    assert.equal(status.enabled, false);

    process.env.GROQ_API_KEY = 'gsk_test';
    status = getWhatsappAudioTranscriptionStatus();
    assert.equal(status.configured, true);
    assert.equal(status.provider, 'groq');
    assert.equal(status.enabled, true);
  } finally {
    if (prevOpenai === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevOpenai;
    if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = prevGroq;
    if (prevFlag === undefined) delete process.env.WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED;
    else process.env.WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED = prevFlag;
  }
});
