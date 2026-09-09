/** Mesma chave do app Expo — sessão JWT local compartilhável entre frontends web. */
export const LOCAL_AUTH_STORAGE_KEY = 'focosimples-local-auth';

export function readLocalAuthSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalAuthSnapshot(snapshot) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearLocalAuthSnapshot() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
}

export function getLocalAccessToken() {
  return readLocalAuthSnapshot()?.accessToken || null;
}

export function buildLocalUser({ id, email, phone, displayName }) {
  return {
    id,
    email: email || undefined,
    user_metadata: {
      phone: phone || null,
      display_name: displayName || null,
    },
  };
}
