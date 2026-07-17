import { normalizeInboundCommandText } from "./zapi-inbound-text.service.js";

/**  Comandos admin: `mf pendentes`, `mf aprovar …` (sem `/`). */
export const MF_PREFIX_RE = /^MF\s+/i;

const parseMfTail = (tail) => {
  let t = String(tail || "").trim();
  if (/^CADASTRO\s+/i.test(t)) {
    t = t.replace(/^CADASTRO\s+/i, "").trim();
  }
  if (!t) return "";

  if (/^pendentes$/i.test(t) || /^listar$/i.test(t)) return "PENDENTES";
  if (/^ajuda$/i.test(t) || /^ajuda-acesso$/i.test(t)) return "AJUDA";

  const approve = /^aprovar\s+(.+)$/i.exec(t);
  if (approve) return `APROVAR ${approve[1].trim()}`;

  const reject = /^rejeitar\s+(.+)$/i.exec(t);
  if (reject) return `REJEITAR ${reject[1].trim()}`;

  return "";
};

/**
 * Converte várias formas → PENDENTES, APROVAR x, …
 * @param {string} text
 */
export const toInternalAccessCommandText = (text) => {
  let t = normalizeInboundCommandText(text);
  if (!t) return "";

  const mf = MF_PREFIX_RE.exec(t);
  if (mf) {
    const parsed = parseMfTail(t.slice(mf[0].length));
    if (parsed) return parsed;
  }

  if (t.startsWith("/")) {
    const inner = t.slice(1).trim();
    if (/^pendentes$/i.test(inner) || /^listar$/i.test(inner))
      return "PENDENTES";
    if (
      /^ajuda(?:-acesso)?$/i.test(inner) ||
      /^help(?:-access)?$/i.test(inner)
    ) {
      return "AJUDA";
    }
    const approve = /^aprovar[-\s]+(.+)$/i.exec(inner);
    if (approve) return `APROVAR ${approve[1].trim()}`;
    const reject = /^rejeitar[-\s]+(.+)$/i.exec(inner);
    if (reject) return `REJEITAR ${reject[1].trim()}`;
  }

  if (/^pendentes$/i.test(t) || /^listar$/i.test(t)) return "PENDENTES";
  if (/^ajuda(?:-acesso)?$/i.test(t)) return "AJUDA";
  const approvePlain = /^aprovar\s+(.+)$/i.exec(t);
  if (approvePlain) return `APROVAR ${approvePlain[1].trim()}`;
  const rejectPlain = /^rejeitar\s+(.+)$/i.exec(t);
  if (rejectPlain) return `REJEITAR ${rejectPlain[1].trim()}`;

  return t;
};

/**
 * `mf pendentes`, `mf aprovar …` (não confunde com conversa normal se não começar com mf).
 * @param {string} text
 */
export const isMfAccessCommandMessage = (text) => {
  const t = normalizeInboundCommandText(text);
  if (!MF_PREFIX_RE.test(t)) return false;
  const internal = toInternalAccessCommandText(text);
  return /^(APROVAR|REJEITAR|PENDENTES|LISTAR|AJUDA|HELP)\b/i.test(internal);
};

/** @deprecated use isMfAccessCommandMessage */
export const isMfCadastroCommandMessage = isMfAccessCommandMessage;

/**
 * @param {string} text
 */
export const isAccessManagementCommandMessage = (text) => {
  const internal = toInternalAccessCommandText(text);
  if (!internal) return false;
  return /^(APROVAR|REJEITAR|PENDENTES|LISTAR|AJUDA|HELP)\b/i.test(internal);
};
