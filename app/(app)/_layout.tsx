import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, ActivityIndicator } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { getTheme } from '@/lib/theme';
import { canAccessMeiArea } from '@/lib/meiAccess';
import { isLocalApiAuthMode } from '@/lib/authMode';
import { supabase } from '@/lib/supabase';
import SideDrawer from '@/components/SideDrawer';
import PendingApprovalScreen from '@/screens/PendingApprovalScreen';
import type { AppScreenName } from '@/lib/navigationContext';
import { APP_BRAND_NAME } from '@/lib/appBrand';
import {
  APP_NAV_ITEMS,
  SCREEN_TO_HREF,
  filterNavItems,
  resolveAppScreenFromPath,
} from '@/lib/appNavConfig';
import { AppShell, useShellLayout } from '@/components/shell';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '@/components/shell/shellTokens';
import { getCurrentReturnPath, stashAuthReturnPath } from '@/lib/authRedirect';
import { captureGoogleCalendarReturnFromUrlSync } from '@/lib/google-calendar-oauth-return';
import { fetchActivationProgress } from '@/services/activationService';
import {
  isSessionActivationSkipped,
  resetSessionActivationSkip,
  setSessionActivationSkipped,
} from '@/lib/activationSession';
import { ACTIVATION_ROUTE, EMPRESA_CNPJ_ONBOARDING_ROUTE, MEI_BILLING_PLANS_ROUTE } from '@/lib/settingsRoutes';
import { isEmpresaCnpjOnboardingRequired } from '@/lib/empresaCnpjGate';
import { shouldRequireMeiBillingRoute } from '@/lib/meiBillingGate';
import {
  registerEmpresaCnpjLayoutGateReset,
  unregisterEmpresaCnpjLayoutGateReset,
} from '@/lib/empresaCnpjLayoutGate';
import { SignOutProvider } from '@/components/auth/SignOutProvider';

type AccessStatus = 'checking' | 'pending' | 'ok';

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('checking');
  const [activationMenuHint, setActivationMenuHint] = useState<string | null>(null);
  const { isDarkMode } = useThemeStore();
  const { user, role, mei, empresaId, sessionRestored } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const { isWebDesktop, usesDrawerNav } = useShellLayout();

  const showMeiTab = useMemo(() => canAccessMeiArea(role, mei), [role, mei]);
  const navItems = useMemo(
    () => filterNavItems(APP_NAV_ITEMS, showMeiTab),
    [showMeiTab]
  );
  const drawerItems = useMemo(
    () =>
      navItems.map((item) => ({
        name: item.screen,
        icon: item.icon,
        activeIcon: item.activeIcon,
        label: item.label,
      })),
    [navItems]
  );
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  const currentScreen: AppScreenName = resolveAppScreenFromPath(pathname);
  const isActivationRoute = pathname.includes('/ativacao');
  const isEmpresaCnpjRoute = pathname.includes('/empresa-cnpj');
  const isPlanosRoute = pathname.includes('/planos');
  /** Onboarding obrigatório: sem top nav, drawer, sair ou sair da impersonação. */
  const shellLocked = isEmpresaCnpjRoute || isActivationRoute || isPlanosRoute;
  /** Navbar web desktop; no resto, drawer (☰) nas telas. */
  const hasGlobalNav = isWebDesktop && !shellLocked;
  const loginCnpjGateDone = useRef(false);
  const loginBillingGateDone = useRef(false);
  const loginActivationGateDone = useRef(false);
  const gateIdentityRef = useRef<{
    userId?: string;
    empresaId?: string | null;
    role?: string | null;
  }>({});
  const [cnpjGate, setCnpjGate] = useState<'checking' | 'ready'>('checking');
  const [billingGate, setBillingGate] = useState<'checking' | 'ready'>('checking');
  const [activationGate, setActivationGate] = useState<'checking' | 'ready'>('checking');

  useEffect(() => {
    if (!sessionRestored) return;
    if (user) return;
    void (async () => {
      captureGoogleCalendarReturnFromUrlSync();
      await stashAuthReturnPath(getCurrentReturnPath(pathname));
      router.replace('/(auth)/login');
    })();
  }, [sessionRestored, user, router, pathname]);

  // Bloqueia usuários com cadastro ainda pendente — no FocoMEI tenta liberar p/ /planos.
  useEffect(() => {
    if (!user) {
      setAccessStatus('checking');
      return;
    }
    // Auth local: vínculo/role já vêm do login — sem consulta Supabase.
    if (isLocalApiAuthMode()) {
      setAccessStatus('ok');
      return;
    }
    let cancelled = false;
    setAccessStatus('checking');
    supabase
      .from('role_x_user_x_empresa')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(
        async ({ data }) => {
          if (cancelled) return;
          if (data?.status === false) {
            try {
              const { apiClient } = await import('@/lib/apiClient');
              const unlock = await apiClient.post<{
                unlocked?: boolean
                reason?: string
              }>('/billing/mei/unlock-pending', {});
              if (cancelled) return;
              // Pedido manual (Quero ser cliente / solicitar-acesso) permanece em análise.
              if (!unlock?.unlocked) {
                setAccessStatus('pending');
                return;
              }
              await useAuthStore.getState().initAuth();
              if (cancelled) return;
              setAccessStatus('ok');
              return;
            } catch {
              if (!cancelled) setAccessStatus('pending');
              return;
            }
          }
          setAccessStatus('ok');
        },
        () => {
          if (!cancelled) setAccessStatus('ok');
        }
      );
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || accessStatus !== 'ok') {
      setActivationMenuHint(null);
      return;
    }
    let cancelled = false;
    void fetchActivationProgress().then((data) => {
      if (cancelled) return;
      if (!data || data.progress.isFullyComplete) {
        setActivationMenuHint(null);
        return;
      }
      const coreDone = data.progress.isCoreComplete ?? data.progress.isComplete;
      const pending =
        data.progress.pendingCount
        ?? Math.max(0, data.progress.totalAll - data.progress.completedAll);
      setActivationMenuHint(
        coreDone
          ? `Essencial ok · faltam ${pending}`
          : `${data.progress.completed}/${data.progress.totalRequired} essenciais`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [user, accessStatus, pathname]);

  useEffect(() => {
    if (!user) {
      loginCnpjGateDone.current = false;
      loginBillingGateDone.current = false;
      loginActivationGateDone.current = false;
      gateIdentityRef.current = {};
      setCnpjGate('checking');
      setBillingGate('checking');
      setActivationGate('checking');
      resetSessionActivationSkip();
      return;
    }
    const prev = gateIdentityRef.current;
    const identityChanged =
      prev.userId !== user.id
      || prev.empresaId !== empresaId
      || prev.role !== role;
    if (identityChanged) {
      loginCnpjGateDone.current = false;
      loginBillingGateDone.current = false;
      loginActivationGateDone.current = false;
      setCnpjGate('checking');
      setBillingGate('checking');
      setActivationGate('checking');
    }
    gateIdentityRef.current = {
      userId: user.id,
      empresaId,
      role,
    };
  }, [user, empresaId, role]);

  useEffect(() => {
    registerEmpresaCnpjLayoutGateReset(() => {
      loginCnpjGateDone.current = false;
      loginBillingGateDone.current = false;
      loginActivationGateDone.current = false;
    });
    return () => unregisterEmpresaCnpjLayoutGateReset();
  }, []);

  // Admin sem CNPJ: bloqueia o app até concluir cadastro (uma vez).
  useEffect(() => {
    if (!user || accessStatus !== 'ok') {
      setCnpjGate('checking');
      return;
    }
    if (isEmpresaCnpjRoute) {
      loginCnpjGateDone.current = true;
      setCnpjGate('ready');
      return;
    }
    if (loginCnpjGateDone.current) {
      setCnpjGate('ready');
      return;
    }
    let cancelled = false;
    setCnpjGate('checking');
    void isEmpresaCnpjOnboardingRequired().then((required) => {
      if (cancelled) return;
      loginCnpjGateDone.current = true;
      if (required) {
        if (!isEmpresaCnpjRoute) {
          router.replace(EMPRESA_CNPJ_ONBOARDING_ROUTE as never);
        }
        return;
      }
      setCnpjGate('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [user, accessStatus, isEmpresaCnpjRoute, router]);

  // Admin sem plano MEI pago → /planos (Checkout Stripe).
  useEffect(() => {
    if (!user || accessStatus !== 'ok' || cnpjGate === 'checking') {
      setBillingGate('checking');
      return;
    }
    if (isPlanosRoute) {
      loginBillingGateDone.current = true;
      setBillingGate('ready');
      return;
    }
    if (role !== 'admin') {
      loginBillingGateDone.current = true;
      setBillingGate('ready');
      return;
    }
    if (loginBillingGateDone.current) {
      setBillingGate('ready');
      return;
    }
    let cancelled = false;
    setBillingGate('checking');
    void shouldRequireMeiBillingRoute().then((required) => {
      if (cancelled) return;
      loginBillingGateDone.current = true;
      if (required) {
        if (!isPlanosRoute) {
          router.replace(MEI_BILLING_PLANS_ROUTE as never);
        }
        return;
      }
      setBillingGate('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [user, accessStatus, cnpjGate, role, isPlanosRoute, router]);

  /** Em /ativacao sem CNPJ: revalida e manda para empresa-cnpj (não liberar ativação antes). */
  useEffect(() => {
    if (!user || accessStatus !== 'ok' || role !== 'admin' || !isActivationRoute) return;
    let cancelled = false;
    void isEmpresaCnpjOnboardingRequired().then((required) => {
      if (cancelled) return;
      if (required) {
        router.replace(EMPRESA_CNPJ_ONBOARDING_ROUTE as never);
        return;
      }
      loginCnpjGateDone.current = true;
      setCnpjGate('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [user, accessStatus, role, isActivationRoute, router]);

  // Evita flash do gate / redirect ao atualizar só metadados (ex.: telefone).
  useEffect(() => {
    if (!user || accessStatus !== 'ok' || cnpjGate === 'checking' || billingGate === 'checking') {
      if (loginActivationGateDone.current) return;
      setActivationGate((prev) => (prev === 'checking' ? prev : 'checking'));
      return;
    }
    if (isSessionActivationSkipped()) {
      loginActivationGateDone.current = true;
      setActivationGate((prev) => (prev === 'ready' ? prev : 'ready'));
      return;
    }
    if (isEmpresaCnpjRoute || isActivationRoute || isPlanosRoute) {
      loginActivationGateDone.current = true;
      setActivationGate((prev) => (prev === 'ready' ? prev : 'ready'));
      return;
    }
    if (loginActivationGateDone.current) {
      setActivationGate((prev) => (prev === 'ready' ? prev : 'ready'));
      return;
    }
    let cancelled = false;
    setActivationGate((prev) => (prev === 'checking' ? prev : 'checking'));
    void fetchActivationProgress().then((data) => {
      if (cancelled) return;
      loginActivationGateDone.current = true;
      const coreDone = data?.progress.isCoreComplete ?? data?.progress.isComplete;
      if (!data || coreDone) {
        setActivationGate((prev) => (prev === 'ready' ? prev : 'ready'));
        return;
      }
      router.replace('/(app)/ativacao' as any);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, accessStatus, cnpjGate, billingGate, isEmpresaCnpjRoute, isActivationRoute, isPlanosRoute, router]);

  /** Impede URL manual / histórico enquanto CNPJ pendente (admin). */
  useEffect(() => {
    if (!user || accessStatus !== 'ok' || role !== 'admin' || isEmpresaCnpjRoute) return;
    let cancelled = false;
    void isEmpresaCnpjOnboardingRequired().then((required) => {
      if (cancelled || !required) return;
      router.replace(EMPRESA_CNPJ_ONBOARDING_ROUTE as never);
    });
    return () => {
      cancelled = true;
    };
  }, [user, accessStatus, role, pathname, isEmpresaCnpjRoute, router]);

  /** Impede sair de /planos sem pagar (admin). */
  useEffect(() => {
    if (!user || accessStatus !== 'ok' || role !== 'admin' || isPlanosRoute) return;
    let cancelled = false;
    void shouldRequireMeiBillingRoute().then((required) => {
      if (cancelled || !required) return;
      router.replace(MEI_BILLING_PLANS_ROUTE as never);
    });
    return () => {
      cancelled = true;
    };
  }, [user, accessStatus, role, pathname, isPlanosRoute, router]);

  const openDrawer = useCallback(() => {
    if (shellLocked) return;
    setDrawerOpen(true);
  }, [shellLocked]);
  const navigateTo = useCallback(
    (screen: AppScreenName) => {
      if (shellLocked) return;
      router.replace(SCREEN_TO_HREF[screen] as any);
      setDrawerOpen(false);
    },
    [router, shellLocked]
  );
  const navBase = useMemo(
    () => ({ openDrawer, navigateTo, hasGlobalNav, shellLocked }),
    [openDrawer, navigateTo, hasGlobalNav, shellLocked],
  );

  const drawerOpenRef = useRef(drawerOpen);
  const shellLockedRef = useRef(shellLocked);
  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);
  useEffect(() => {
    shellLockedRef.current = shellLocked;
  }, [shellLocked]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy, x0 }) => {
        if (shellLockedRef.current || !usesDrawerNav || drawerOpenRef.current) return false;
        return x0 < 30 && dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderRelease: (_, { dx, x0 }) => {
        if (shellLockedRef.current) return;
        if (x0 < 30 && dx > 50) setDrawerOpen(true);
      },
    })
  ).current;

  if (!sessionRestored || !user) {
    return (
      <View style={[styles.outer, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.bootHint}>Carregando…</Text>
      </View>
    );
  }

  if (user && accessStatus === 'checking') {
    return (
      <View style={[styles.outer, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (user && accessStatus === 'pending') {
    return <PendingApprovalScreen />;
  }

  const awaitingCnpjGate =
    user
    && accessStatus === 'ok'
    && cnpjGate === 'checking'
    && !isEmpresaCnpjRoute;

  if (awaitingCnpjGate) {
    return (
      <View style={[styles.outer, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const awaitingBillingGate =
    user
    && accessStatus === 'ok'
    && billingGate === 'checking'
    && !isPlanosRoute
    && role === 'admin';

  if (awaitingBillingGate) {
    return (
      <View style={[styles.outer, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const awaitingActivationGate =
    user
    && accessStatus === 'ok'
    && activationGate === 'checking'
    && !isActivationRoute
    && !isEmpresaCnpjRoute
    && !isPlanosRoute
    && !isSessionActivationSkipped();

  if (awaitingActivationGate) {
    return (
      <View style={[styles.outer, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SignOutProvider nav={navBase}>
      <View style={styles.outer} {...(usesDrawerNav ? panResponder.panHandlers : {})}>
        <AppShell
          currentScreen={currentScreen}
          showMeiTab={showMeiTab}
          navigateTo={navigateTo}
          showTopNav={hasGlobalNav}
        />
        {!shellLocked ? (
          <SideDrawer
            visible={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            items={drawerItems}
            current={currentScreen}
            onSelect={(name) => {
              navigateTo(name);
            }}
            theme={theme}
            headerLabel={APP_BRAND_NAME}
            footerAction={
              activationMenuHint
                ? {
                    label: 'Configurar conta',
                    subtitle: activationMenuHint,
                    onPress: () => {
                      setSessionActivationSkipped(false);
                      router.push(ACTIVATION_ROUTE as any);
                    },
                  }
                : null
            }
          />
        ) : null}
      </View>
    </SignOutProvider>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    outer: {
      flex: 1,
      backgroundColor: isDarkMode ? SHELL_CANVAS_DARK : SHELL_CANVAS_LIGHT,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    bootHint: {
      fontSize: 14,
      color: isDarkMode ? '#94A3B8' : '#64748B',
    },
  });
