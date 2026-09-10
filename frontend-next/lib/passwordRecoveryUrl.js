function parseParamsFromRawUrl(url) {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const queryRaw = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '';
  const hashRaw = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const params = new URLSearchParams(queryRaw);
  const hashParams = new URLSearchParams(hashRaw);
  hashParams.forEach((value, key) => params.set(key, value));
  return params;
}

export function parsePasswordRecoveryFromLocation(href) {
  if (!href || !href.includes('/reset-password')) {
    return { kind: 'invalid_recovery_link' };
  }
  try {
    const params = parseParamsFromRawUrl(href);
    const type = params.get('type');
    if (type !== 'recovery') {
      return { kind: 'invalid_recovery_link' };
    }
    const tokenHash = params.get('token_hash') || '';
    if (tokenHash) {
      return { kind: 'password_recovery', mode: 'token_hash', tokenHash };
    }
    const accessToken = params.get('access_token') || '';
    const refreshToken = params.get('refresh_token') || '';
    if (accessToken && refreshToken) {
      return {
        kind: 'password_recovery',
        mode: 'session',
        accessToken,
        refreshToken,
      };
    }
    return { kind: 'invalid_recovery_link' };
  } catch {
    return { kind: 'invalid_recovery_link' };
  }
}
