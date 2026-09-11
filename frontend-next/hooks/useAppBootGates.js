'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { isEmpresaCnpjOnboardingRequired } from '@/lib/empresaCnpjGate';
import { shouldRequireMeiBillingRoute } from '@/lib/meiBillingGate';
import { fetchActivationProgress, isActivationCoreComplete } from '@/lib/activationApi';
import { isSessionActivationSkipped } from '@/lib/activationSession';

const SHELL_LOCKED_PREFIXES = ['/empresa-cnpj', '/ativacao', '/planos'];

export function isShellLockedPath(pathname) {
  return SHELL_LOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function useAppBootGates(accessGate) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { role, mei, booting, isAuthenticated } = useAuth();
  const [bootPhase, setBootPhase] = useState('checking');
  const cnpjDone = useRef(false);
  const billingDone = useRef(false);
  const activationDone = useRef(false);

  const shellLocked = useMemo(() => isShellLockedPath(pathname), [pathname]);

  useEffect(() => {
    if (booting || !isAuthenticated || accessGate !== 'ok') {
      setBootPhase('checking');
      return;
    }

    let cancelled = false;

    (async () => {
      setBootPhase('checking');

      const onEmpresaCnpj = pathname.startsWith('/empresa-cnpj');
      const onPlanos = pathname.startsWith('/planos');
      const onAtivacao = pathname.startsWith('/ativacao');

      if (!cnpjDone.current && !onEmpresaCnpj) {
        const needCnpj = await isEmpresaCnpjOnboardingRequired(role);
        if (cancelled) return;
        cnpjDone.current = true;
        if (needCnpj) {
          router.replace('/empresa-cnpj');
          return;
        }
      } else if (onEmpresaCnpj) {
        cnpjDone.current = true;
      }

      if (!billingDone.current && !onPlanos && role === 'admin') {
        const needBilling = await shouldRequireMeiBillingRoute(role, mei);
        if (cancelled) return;
        billingDone.current = true;
        if (needBilling) {
          router.replace('/planos');
          return;
        }
      } else if (onPlanos || role !== 'admin') {
        billingDone.current = true;
      }

      if (!activationDone.current && !onAtivacao && !isSessionActivationSkipped()) {
        const data = await fetchActivationProgress();
        if (cancelled) return;
        activationDone.current = true;
        if (data && !isActivationCoreComplete(data)) {
          router.replace('/ativacao');
          return;
        }
      } else if (onAtivacao) {
        activationDone.current = true;
      }

      if (!cancelled) setBootPhase('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [booting, isAuthenticated, accessGate, pathname, role, mei, router]);

  return { bootPhase, shellLocked };
}
