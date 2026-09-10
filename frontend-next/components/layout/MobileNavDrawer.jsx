'use client';

import { Menu, X } from 'lucide-react';
import { AppSidebar } from './AppSidebar';

export function MobileNavDrawer({ open, onClose, onOpen }) {
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-2 lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        onClick={onOpen}
        aria-label="Abrir menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5 text-[var(--text-primary)]" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-label="Fechar menu"
          />
          <div className="absolute inset-y-0 left-0 flex shadow-2xl">
            <AppSidebar className="min-h-full" />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-4 rounded-lg bg-white/10 p-2 text-white lg:hidden"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
