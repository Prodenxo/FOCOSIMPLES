import { env } from '../config/env.js';
import { sendSuccess } from '../utils/response.js';
import * as zapiInbound from '../services/zapi-inbound.service.js';
import {
  handleAccessRequestWhatsappInbound,
  sendMfCommandDiagnosticReply,
} from '../services/access-request-whatsapp-inbound.service.js';
import { isMfAccessCommandMessage } from '../services/access-request-command-text.service.js';
import { isWhatsappOutboundConfigured } from '../services/whatsapp-outbound.service.js';
import { isOpenclawZapiRelaySyncEnabled } from '../services/openclaw-hook-relay.service.js';
import {
  getOpenclawRelaySkipDecision,
  ZAPI_INBOUND_BRIDGE_VERSION,
} from '../services/zapi-slash-commands.service.js';
import { isAccessRequestWhatsappNotifyEnabled } from '../services/access-request-whatsapp.service.js';
import {
  getWhatsappAudioTranscriptionStatus,
  transcribeZapiInboundAudio,
} from '../services/whatsapp-audio-transcription.service.js';
import { evaluateChatGuard } from '../services/openclaw-chat-guard.service.js';
import { sendWhatsappMessage } from '../services/whatsapp-outbound.service.js';
import { maybeSendWhatsappWelcome } from '../services/whatsapp-welcome.service.js';
import { isWhatsappDualQrMode } from '../services/whatsapp-dual-qr.service.js';
import {
  buildInboundDedupKeys,
  claimInboundMessage,
} from '../services/openclaw-reply-dedup.service.js';
import { startZapiTypingSoon } from '../services/zapi-outbound.service.js';
import { shouldUseBackendWhatsappAgent } from '../services/whatsapp-agent-pref.service.js';
import { handleWhatsappBackendAgent } from '../services/whatsapp-backend-agent.service.js';

export const getZapiMonitor = (_req, res) => {
  return res.json({
    ok: true,
    service: 'zapi-inbound-bridge',
    inboundBridgeVersion: ZAPI_INBOUND_BRIDGE_VERSION,
    whatsappDualQrMode: isWhatsappDualQrMode(),
    features: [
      'mf_access_commands',
      'slash_skip_relay',
      'access_command_skip_relay',
      'access_whatsapp_inbound',
      'chat_guard_off_topic',
      'chat_guard_internal_probe',
      'chat_guard_investment_advice',
      'whatsapp_welcome_on_greeting',
      'openclaw_zapi_sync_relay',
      'whatsapp_backend_agent_canary',
    ],
    preferredAccessCommand: 'mf pendentes',
    accessRequestWhatsapp: isAccessRequestWhatsappNotifyEnabled(),
    whatsappOutboundConfigured: isWhatsappOutboundConfigured(),
    relayConfigured: Boolean((env.OPENCLAW_ZAPI_RELAY_URL || '').trim()),
    openclawRelaySync: isOpenclawZapiRelaySyncEnabled(),
    webhookTokenConfigured: Boolean((env.ZAPI_WEBHOOK_TOKEN || '').trim()),
    inboundWebhookPath: '/api/webhooks/zapi/inbound',
    zapiInboundReady:
      Boolean((env.ZAPI_WEBHOOK_TOKEN || '').trim())
      && isWhatsappOutboundConfigured()
      && isAccessRequestWhatsappNotifyEnabled(),
    audioTranscription: getWhatsappAudioTranscriptionStatus(),
  });
};

export const postInbound = async (req, res, next) => {
  try {
    let parsed = zapiInbound.parseZapiInbound(req.body);
    if (parsed.ignored) {
      return sendSuccess(
        res,
        { ignored: true, reason: parsed.reason },
        'ignorado',
      );
    }

    startZapiTypingSoon(parsed.phone);

    let transcriptionSource = null;
    if (!parsed.text && parsed.hasAudio) {
      const audioStatus = getWhatsappAudioTranscriptionStatus();
      // eslint-disable-next-line no-console
      console.info(
        '[ZAPI] inbound áudio:',
        parsed.phone,
        audioStatus.enabled ? `provider=${audioStatus.provider}` : 'transcricao_desligada',
      );
      const transcription = await transcribeZapiInboundAudio(req.body, {
        phone: parsed.phone,
      });
      if (transcription) {
        parsed = { ...parsed, text: transcription, hasAudio: true };
        transcriptionSource = 'zapi_audio_stt';
        // eslint-disable-next-line no-console
        console.info('[ZAPI] áudio transcrito:', parsed.phone, transcription.slice(0, 100));
      }
    }

    if (!parsed.text?.trim()) {
      if (parsed.hasAudio) {
        try {
          await sendWhatsappMessage({
            phone: parsed.phone,
            message:
              'Não consegui entender o áudio. Pode escrever o que você precisa?',
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console
          console.warn('[ZAPI] aviso de áudio falhou:', msg);
        }
      }
      return sendSuccess(
        res,
        {
          accepted: true,
          phone: parsed.phone,
          ignoredReason: parsed.hasAudio ? 'audio_transcription_failed' : 'empty_text',
          relayConfigured: Boolean((env.OPENCLAW_ZAPI_RELAY_URL || '').trim()),
        },
        'sem texto',
      );
    }

    // eslint-disable-next-line no-console
    console.info('[ZAPI] inbound texto:', parsed.phone, String(parsed.text || '').slice(0, 100));

    const dedupKeys = buildInboundDedupKeys(parsed);
    if (!claimInboundMessage(dedupKeys)) {
      // eslint-disable-next-line no-console
      console.info('[ZAPI] webhook repetido — ignorado:', dedupKeys.join(' | '));
      return sendSuccess(
        res,
        { ignored: true, reason: 'duplicate_webhook', phone: parsed.phone },
        'repetido',
      );
    }

    let accessRequestHandled = false;
    let accessRequestReason = null;
    try {
      const inbound = await handleAccessRequestWhatsappInbound({
        phone: parsed.phone,
        text: parsed.text,
      });
      accessRequestHandled = Boolean(inbound.handled);
      accessRequestReason = inbound.reason ?? null;

      if (isMfAccessCommandMessage(parsed.text) && !accessRequestHandled) {
        await sendMfCommandDiagnosticReply(parsed.phone, accessRequestReason);
        accessRequestHandled = true;
        accessRequestReason = `diagnostic_${accessRequestReason || 'unknown'}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn('[ZAPI] access-request inbound:', msg);
      if (isMfAccessCommandMessage(parsed.text)) {
        try {
          await sendMfCommandDiagnosticReply(parsed.phone, 'error');
        } catch {
          /* ignore */
        }
        accessRequestHandled = true;
        accessRequestReason = 'error';
      }
    }

    let welcomeResult = { sent: false, skipRelay: false, reason: null };
    const dualQr = isWhatsappDualQrMode();
    if (dualQr) {
      welcomeResult = { sent: false, skipRelay: true, reason: 'dual_qr_openclaw_chat' };
    }
    try {
      if (!dualQr) {
        welcomeResult = await maybeSendWhatsappWelcome({
          phone: parsed.phone,
          text: parsed.text,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn('[ZAPI] whatsapp welcome falhou:', msg);
    }

    const relayDecision = getOpenclawRelaySkipDecision(parsed.text, accessRequestHandled);
    const chatGuard = dualQr
      ? { block: false, reply: null, reason: 'dual_qr' }
      : evaluateChatGuard(parsed.text);
    let skipOpenclawRelay = dualQr || relayDecision.skip || welcomeResult.skipRelay;
    let chatGuardHandled = false;

    if (!skipOpenclawRelay && chatGuard.block && chatGuard.reply) {
      try {
        await sendWhatsappMessage({
          phone: parsed.phone,
          message: chatGuard.reply,
        });
        chatGuardHandled = true;
        skipOpenclawRelay = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.warn('[ZAPI] chat-guard reply falhou:', msg);
      }
    }

    if (skipOpenclawRelay && !chatGuardHandled) {
      // eslint-disable-next-line no-console
      console.info(
        '[ZAPI] openclaw relay ignorado:',
        relayDecision.reason,
        'text=',
        String(parsed.text || '').slice(0, 80),
      );
    } else if (chatGuardHandled) {
      // eslint-disable-next-line no-console
      console.info(
        '[ZAPI] chat-guard bloqueou relay:',
        chatGuard.reason,
        'text=',
        String(parsed.text || '').slice(0, 80),
      );
    }

    const relayUrl = (env.OPENCLAW_ZAPI_RELAY_URL || '').trim();
    let openclawRelay = {
      relayed: false,
      mode: 'skipped',
      replySent: false,
      openclaw: null,
      whatsappError: null,
    };

    const useBackendAgent = !skipOpenclawRelay
      && await shouldUseBackendWhatsappAgent(parsed.phone);

    if (!skipOpenclawRelay && (useBackendAgent || relayUrl)) {
      sendSuccess(
        res,
        {
          accepted: true,
          queued: true,
          phone: parsed.phone,
          textPreview: String(parsed.text || '').slice(0, 120),
          accessRequestHandled,
          accessRequestReason,
          inboundBridgeVersion: ZAPI_INBOUND_BRIDGE_VERSION,
          transcriptionSource,
          engine: useBackendAgent ? 'backend' : 'openclaw',
        },
        'aceite',
      );

      if (useBackendAgent) {
        setImmediate(() => {
          handleWhatsappBackendAgent({ phone: parsed.phone, text: parsed.text })
            .then((result) => {
              if (result.replySent) {
                console.info('[ZAPI] resposta backend enviada:', parsed.phone);
                return;
              }
              console.info('[ZAPI] backend sem texto WhatsApp:', result.reason || 'empty');
            })
            .catch((err) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn('[ZAPI] backend agent falhou:', msg);
            });
        });
        return;
      }

      setImmediate(() => {
        zapiInbound.relayZapiInboundToOpenclaw(parsed)
          .then((result) => {
            if (result.replySent) {
              // eslint-disable-next-line no-console
              console.info('[ZAPI] resposta OpenClaw enviada:', parsed.phone);
              return;
            }
            if (result.openclaw?.error) {
              // eslint-disable-next-line no-console
              console.warn('[ZAPI] relay sync falhou:', result.openclaw.error);
              return;
            }
            if (result.relayed && !result.replySent) {
              // eslint-disable-next-line no-console
              console.info('[ZAPI] relay OK sem texto WhatsApp (tools/PDF ou resposta vazia)');
            }
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            // eslint-disable-next-line no-console
            console.warn('[ZAPI] relay em background falhou:', msg);
          });
      });
      return;
    }

    if (!welcomeResult.sent && skipOpenclawRelay && !chatGuardHandled) {
      // eslint-disable-next-line no-console
      console.info(
        '[ZAPI] sem resposta outbound:',
        welcomeResult.reason || relayDecision.reason || 'relay_skipped',
      );
    }

    return sendSuccess(
      res,
      {
        accepted: true,
        phone: parsed.phone,
        textPreview: String(parsed.text || '').slice(0, 120),
        relayed: openclawRelay.relayed,
        openclawRelay,
        whatsappReplySent: openclawRelay.replySent,
        accessRequestHandled,
        accessRequestReason,
        openclawSkipped: skipOpenclawRelay,
        openclawSkipReason: chatGuardHandled
          ? `chat_guard_${chatGuard.reason}`
          : welcomeResult.skipRelay
            ? welcomeResult.reason
            : relayDecision.reason,
        whatsappWelcome: welcomeResult,
        chatGuard: chatGuard.block
          ? { blocked: true, reason: chatGuard.reason, replied: chatGuardHandled }
          : { blocked: false },
        inboundBridgeVersion: ZAPI_INBOUND_BRIDGE_VERSION,
        transcriptionSource,
      },
      'aceite',
    );
  } catch (error) {
    return next(error);
  }
};
