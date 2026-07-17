/**
 * Interpretação única de `PLUGNOTAS_DEBUG` no backend (case-insensitive).
 * US-NFCE-EMP-04 — mitigação QA: mesma regra para `[plugnotas]`, cadastro empresa e outros diagnósticos.
 */
export const isPlugnotasDebugExplicitlyEnabled = () => (
  String(process.env.PLUGNOTAS_DEBUG || '').toLowerCase() === 'true'
);
