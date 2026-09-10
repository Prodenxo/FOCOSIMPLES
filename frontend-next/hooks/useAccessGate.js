'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthProvider';

function resolveAccessFromUnlock(unlock) {
  if (!unlock || typeof unlock !== 'object') return 'ok';
  if (unlock.unlocked === true) return 'ok';
  // Vínculo já ativo — resposta padrão do unlock quando não há pendência.
  if (unlock.reason === 'already_active') return 'ok';
  // Sem vínculo (ex.: superadmin) — Expo não bloqueia nesse caso.
  if (unlock.reason === 'no_link') return 'ok';
  if (unlock.reason === 'manual_approval') return 'pending';
  return 'pending';
}

/**
 * Bloqueia app quando cadastro manual ainda está em análise (paridade Expo _layout).
 * POST unlock-pending: libera self-serve Foco Simples ou confirma already_active.
 */
export function useAccessGate() {
  const { isAuthenticated, booting, userId, role } = useAuth();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    if (booting) {
      setStatus('checking');
      return;
    }
    if (!isAuthenticated || !userId) {
      setStatus('ok');
      return;
    }
    if (role === 'superadmin') {
      setStatus('ok');
      return;
    }

    let cancelled = false;
    setStatus('checking');

    (async () => {
      try {
        const unlock = await apiClient.post('/billing/mei/unlock-pending', {});
        if (cancelled) return;
        setStatus(resolveAccessFromUnlock(unlock));
      } catch {
        if (!cancelled) setStatus('ok');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [booting, isAuthenticated, userId, role]);

  return status;
}
