'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { PendingApprovalScreen } from '@/components/auth/PendingApprovalScreen';
import { useAccessGate } from '@/hooks/useAccessGate';

function AppShellGate({ children }) {
  const router = useRouter();
  const { booting, isAuthenticated } = useAuth();
  const accessGate = useAccessGate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!booting && !isAuthenticated) {
      router.replace('/login');
    }
  }, [booting, isAuthenticated, router]);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA]">
        <LoadingPanel label="Carregando…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA]">
        <LoadingPanel label="Redirecionando para login…" />
      </div>
    );
  }

  if (accessGate === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)]">
        <LoadingPanel label="Verificando acesso…" />
      </div>
    );
  }

  if (accessGate === 'pending') {
    return (
      <div className="flex min-h-screen bg-[var(--canvas)]">
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
          <PendingApprovalScreen />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--canvas)]">
      <AppSidebar className="hidden lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--card-border)] bg-[var(--canvas)] px-4 py-3 lg:hidden">
          <MobileNavDrawer
            open={drawerOpen}
            onOpen={() => setDrawerOpen(true)}
            onClose={() => setDrawerOpen(false)}
          />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Foco Simples</span>
        </div>
        <ImpersonationBanner />
        <main className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 lg:px-7 lg:py-7">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }) {
  return <AppShellGate>{children}</AppShellGate>;
}
