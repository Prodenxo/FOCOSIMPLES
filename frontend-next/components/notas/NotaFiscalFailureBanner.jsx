'use client';

import { AlertCircle } from 'lucide-react';
import {
  extractNfseFailureMessage,
  notaFiscalExibeMotivoFalha,
} from '@/lib/notaFiscalDisplay';

export function NotaFiscalFailureBanner({ nota }) {
  if (!notaFiscalExibeMotivoFalha(nota?.situacao || nota?.status)) return null;

  const preview = extractNfseFailureMessage(nota.response_json, nota.metadata_json);

  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-red-800 dark:text-red-200">Motivo da rejeição</p>
        <p className="mt-1 text-xs leading-relaxed text-red-700 dark:text-red-300">
          {preview || 'O motivo não foi salvo nesta nota. Use «Sincronizar status» para consultar o emissor.'}
        </p>
      </div>
    </div>
  );
}
