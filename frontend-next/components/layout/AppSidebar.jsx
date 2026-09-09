'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LogOut, Moon, Sun } from 'lucide-react';
import { BrandWordmark } from '@/components/brand/BrandLogo';
import { NAV_ITEMS, isNavActive } from '@/lib/navConfig';
import { useAuth } from '@/context/AuthProvider';
import { useTheme } from '@/context/ThemeProvider';

function UserInitials({ name }) {
  const parts = String(name || 'U').trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : String(name || 'U').slice(0, 2).toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
      {initials}
    </span>
  );
}

export function AppSidebar({ className = '' }) {
  const pathname = usePathname();
  const { displayName, signOut, mei } = useAuth();
  const { isDark, toggleTheme, preference } = useTheme();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requiresFiscalAccess || mei,
  );

  const themeLabel = preference === 'dark' ? 'Tema escuro' : 'Tema claro';

  return (
    <aside
      className={`sticky top-0 flex h-screen max-h-screen w-[240px] shrink-0 self-start flex-col overflow-hidden bg-[var(--sidebar)] text-white ${className}`}
      aria-label="Menu principal"
    >
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <BrandWordmark compact />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`flex h-12 items-center gap-3 rounded-[14px] px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    active
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-white/75 hover:bg-white/5 hover:text-white'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-12 w-full items-center justify-between rounded-[14px] px-3 text-sm text-white/80 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={themeLabel}
        >
          <span className="flex items-center gap-3">
            {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            Tema
          </span>
          <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
        </button>

        <Link
          href="/minha-conta"
          className="flex h-12 items-center justify-between rounded-[14px] px-3 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="flex min-w-0 items-center gap-3">
            <UserInitials name={displayName} />
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold text-white">{displayName || 'Usuário'}</span>
              <span className="block text-xs text-white/60">Minha conta</span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
        </Link>

        <button
          type="button"
          onClick={() => signOut()}
          className="flex h-12 w-full items-center gap-3 rounded-[14px] px-3 text-sm text-white/80 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <LogOut className="h-5 w-5" aria-hidden />
          Sair
        </button>
      </div>
    </aside>
  );
}
