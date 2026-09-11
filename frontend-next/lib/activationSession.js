const SKIP_KEY = 'focosimples_activation_skip_v1';

export function isSessionActivationSkipped() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSessionActivationSkipped(value) {
  if (typeof window === 'undefined') return;
  try {
    if (value) sessionStorage.setItem(SKIP_KEY, '1');
    else sessionStorage.removeItem(SKIP_KEY);
  } catch {
    /* ignore */
  }
}
