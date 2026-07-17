import {
  isAccessManagementCommandMessage,
  isMfAccessCommandMessage,
} from './access-request-command-text.service.js';
import { normalizeInboundCommandText } from './zapi-inbound-text.service.js';

/** Versão do bridge inbound (monitor / diagnóstico de deploy). */
export const ZAPI_INBOUND_BRIDGE_VERSION = 6;

export { isAccessManagementCommandMessage, isMfAccessCommandMessage };

/**
 * Mensagens que começam com `/` são reservadas ao backend (Z-API inbound).
 * Não devem ser reencaminhadas ao OpenClaw — evita o bot confundir com transações.
 */

/**
 * @param {string} text
 */
export const isSlashReservedMessage = (text) => {
  const t = normalizeInboundCommandText(text);
  return t.startsWith('/');
};

/**
 * @param {string} text
 * @param {boolean} accessRequestHandled
 * @returns {{ skip: boolean, reason: string | null }}
 */
export const getOpenclawRelaySkipDecision = (text, accessRequestHandled = false) => {
  if (accessRequestHandled) {
    return { skip: true, reason: 'access_request_handled' };
  }
  if (isMfAccessCommandMessage(text)) {
    return { skip: true, reason: 'mf_access_command' };
  }
  if (isSlashReservedMessage(text)) {
    return { skip: true, reason: 'slash_reserved' };
  }
  if (isAccessManagementCommandMessage(text)) {
    return { skip: true, reason: 'access_management_command' };
  }
  return { skip: false, reason: null };
};

/**
 * @param {string} text
 * @param {boolean} accessRequestHandled
 */
export const shouldSkipOpenclawRelay = (text, accessRequestHandled = false) => {
  return getOpenclawRelaySkipDecision(text, accessRequestHandled).skip;
};
