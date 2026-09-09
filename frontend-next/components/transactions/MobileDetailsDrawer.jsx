'use client';

import { useEffect } from 'react';
import { TransactionDetailsPanel } from './TransactionDetailsPanel';

export function MobileDetailsDrawer({ open, onClose, ...panelProps }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Fechar detalhes" />
      <div className="app-scrollbar absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[14px] bg-[var(--card-bg)] shadow-2xl">
        <TransactionDetailsPanel
          {...panelProps}
          onClose={onClose}
          className="border-0 shadow-none"
        />
      </div>
    </div>
  );
}
