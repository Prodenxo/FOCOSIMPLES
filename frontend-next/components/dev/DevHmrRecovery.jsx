'use client';

import { useEffect } from 'react';

const RELOAD_MARKER = 'focosimples-dev-chunk-reload';

/**
 * Em dev, falha de chunk/HMR vira `[object Event]` no overlay do Next.
 * Recarrega uma vez quando detecta isso.
 */
export function DevHmrRecovery() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return undefined;

    const clearMarkerLater = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_MARKER);
      } catch {
        /* ignore */
      }
    }, 15000);

    const tryReloadOnce = () => {
      try {
        if (sessionStorage.getItem(RELOAD_MARKER)) return;
        sessionStorage.setItem(RELOAD_MARKER, '1');
      } catch {
        window.location.reload();
        return;
      }
      window.location.reload();
    };

    const onRejection = (ev) => {
      const reason = ev.reason;
      if (reason instanceof Event) {
        ev.preventDefault();
        tryReloadOnce();
        return;
      }
      const msg = reason instanceof Error ? reason.message : String(reason ?? '');
      if (/chunk|loading css chunk|module not found|331\.js/i.test(msg)) {
        ev.preventDefault();
        tryReloadOnce();
      }
    };

    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.clearTimeout(clearMarkerLater);
    };
  }, []);

  return null;
}
