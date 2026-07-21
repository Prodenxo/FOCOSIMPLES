import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { AppScreenName } from './navigationContext';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type AppNavItem = {
  screen: AppScreenName;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
  requiresMeiAccess?: boolean;
  /** Exibido na barra superior (web) */
  showInTopNav?: boolean;
  /** Exibido na tab bar inferior (native) */
  showInBottomNav?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    screen: 'Dashboard',
    label: 'Visão Geral',
    icon: 'home-outline',
    activeIcon: 'home',
    showInTopNav: true,
    showInBottomNav: true,
  },
  {
    screen: 'Transacoes',
    label: 'Transações',
    icon: 'swap-horizontal-outline',
    activeIcon: 'swap-horizontal',
    showInTopNav: true,
    showInBottomNav: true,
  },
  {
    screen: 'Contas',
    label: 'Contas',
    icon: 'card-outline',
    activeIcon: 'card',
    showInTopNav: true,
  },
  {
    screen: 'ContaGlobal',
    label: 'Conta global',
    icon: 'globe-outline',
    activeIcon: 'globe',
    showInTopNav: true,
  },
  {
    screen: 'Categorias',
    label: 'Categorias',
    icon: 'apps-outline',
    activeIcon: 'apps',
    showInTopNav: true,
  },
  {
    screen: 'Orcamentos',
    label: 'Orçamentos',
    icon: 'wallet-outline',
    activeIcon: 'wallet',
    showInTopNav: true,
  },
  {
    screen: 'Agenda',
    label: 'Agenda',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
    showInTopNav: true,
    showInBottomNav: true,
  },
  {
    screen: 'MeuMei',
    label: 'Notas',
    icon: 'briefcase-outline',
    activeIcon: 'briefcase',
    requiresMeiAccess: true,
    showInTopNav: true,
    showInBottomNav: true,
  },
  {
    screen: 'Configuracoes',
    label: 'Configurações',
    icon: 'settings-outline',
    activeIcon: 'settings',
  },
];

export const SCREEN_TO_HREF: Record<AppScreenName, string> = {
  Dashboard: '/(app)/',
  Transacoes: '/(app)/transacoes',
  Contas: '/(app)/contas',
  ContaGlobal: '/(app)/conta-global',
  Categorias: '/(app)/categorias',
  Orcamentos: '/(app)/orcamentos',
  Agenda: '/(app)/agenda',
  MeuMei: '/(app)/mei',
  Configuracoes: '/(app)/configuracoes',
};

const PATH_SUFFIX_TO_SCREEN: Record<string, AppScreenName> = {
  '': 'Dashboard',
  '/': 'Dashboard',
  '/index': 'Dashboard',
  '/transacoes': 'Transacoes',
  '/contas': 'Contas',
  '/conta-global': 'ContaGlobal',
  '/categorias': 'Categorias',
  '/orcamentos': 'Orcamentos',
  '/agenda': 'Agenda',
  '/mei': 'MeuMei',
  '/configuracoes': 'Configuracoes',
};

/** Normaliza pathname do Expo Router para `AppScreenName`. */
export function resolveAppScreenFromPath(pathname?: string | null): AppScreenName {
  const stripped = String(pathname ?? '/')
    .replace(/^\/?\(app\)/, '')
    .replace(/\/$/, '')
    .split('?')[0];
  const suffix = stripped === '' ? '/' : stripped.startsWith('/') ? stripped : `/${stripped}`;

  if (suffix === '/configuracoes' || suffix.startsWith('/configuracoes/')) {
    return 'Configuracoes';
  }
  if (suffix === '/solicitacoes' || suffix === '/planos') {
    return 'Configuracoes';
  }

  return PATH_SUFFIX_TO_SCREEN[suffix] ?? 'Dashboard';
}

export function filterNavItems(items: AppNavItem[], showMei: boolean): AppNavItem[] {
  return items.filter((item) => !item.requiresMeiAccess || showMei);
}
