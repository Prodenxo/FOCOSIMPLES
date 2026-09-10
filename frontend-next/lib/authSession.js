/** Mesma chave do app Expo — sessão JWT local compartilhável entre frontends web. */
export const LOCAL_AUTH_STORAGE_KEY = 'focosimples-local-auth';
export const LOCAL_ADMIN_BACKUP_KEY = 'focosimples-local-admin-backup';

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

export function backupLocalAdminSnapshot(snapshot) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_ADMIN_BACKUP_KEY, JSON.stringify(snapshot));
}

export function readLocalAdminBackup() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalAdminBackup() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_ADMIN_BACKUP_KEY);
}

export function hasLocalAdminBackup() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(LOCAL_ADMIN_BACKUP_KEY));
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
