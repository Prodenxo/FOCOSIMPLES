import {
  Briefcase,
  Calendar,
  Globe,
  Home,
  LayoutGrid,
  Receipt,
  Wallet,
} from 'lucide-react';

/** Mapeamento Expo → Next.js (rotas explícitas de migração). */
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão geral', href: '/', icon: Home },
  { id: 'transacoes', label: 'Transações', href: '/transacoes', icon: Receipt },
  { id: 'contas', label: 'Contas', href: '/contas', icon: Wallet },
  { id: 'conta-global', label: 'Conta global', href: '/conta-global', icon: Globe },
  { id: 'categorias', label: 'Categorias', href: '/categorias', icon: LayoutGrid },
  { id: 'orcamentos', label: 'Orçamentos', href: '/orcamentos', icon: Wallet },
  { id: 'agenda', label: 'Agenda', href: '/agenda', icon: Calendar },
  {
    id: 'notas',
    label: 'Notas',
    href: '/notas',
    icon: Briefcase,
    requiresFiscalAccess: true,
  },
];

export const MIGRATION_STUB_ROUTES = [
  '/orcamentos',
  '/agenda',
  '/notas',
  '/configuracoes',
  '/minha-conta',
];

export function isNavActive(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
