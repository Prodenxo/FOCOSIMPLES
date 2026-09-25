'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { parseDecimal } from '@/lib/fiscalEmit';
import { formatCurrencyBRL } from '@/lib/fiscalFormat';
import { AppSelect } from '@/components/ui/AppSelect';

const SERVICO_OPTIONS = [
  { value: '14', label: 'Serviço no próprio município (Anexo III) — padrão' },
  { value: '11', label: 'Serviço com fator R, ISS no próprio município' },
  { value: '15', label: 'Serviço com retenção de ISS (Anexo III)' },
  { value: '13', label: 'Serviço com ISS devido a outro município (Anexo III)' },
  { value: '17', label: 'Serviço Anexo IV, ISS no próprio município' },
];

const MERCADORIA_OPTIONS = [
  { value: '1', label: 'Revenda sem substituição tributária — padrão' },
  { value: '2', label: 'Revenda com substituição tributária' },
];

const ISS_OUTRO_MUNICIPIO = new Set(['10', '13', '16', '19', '22', '25', '40']);

const moneyToInput = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toFixed(2).replace('.', ',');
};

/**
 * Confirmação da declaração PGDAS-D.
 * Caso padrão: só o faturamento. Caso especial: fator R, ISS, retenção, ST, exportação, folha, filial.
 */
export function DeclararDasModal({
  open,
  periodoLabel,
  sugerido = 0,
  notasCount = 0,
  loading = false,
  saving = false,
  initialDraft = null,
  draftSavedAt = null,
  simulationResult = null,
  onCancel,
  onSave,
  onSimulate,
  onConfirm,
}) {
  const [faturamento, setFaturamento] = useState('');
  const [casoEspecial, setCasoEspecial] = useState(false);
  const [idServico, setIdServico] = useState('14');
  const [idMercadoria, setIdMercadoria] = useState('1');
  const [valorExterno, setValorExterno] = useState('');
  const [valorFolha, setValorFolha] = useState('');
  const [codigoMunicipio, setCodigoMunicipio] = useState('');
  const [outraUf, setOutraUf] = useState('');
  const [filiais, setFiliais] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFaturamento(moneyToInput(initialDraft?.valorReceitaInterna ?? sugerido) || '0,00');
    setCasoEspecial(initialDraft?.casoEspecial === true);
    setIdServico(String(initialDraft?.idAtividadeServico || 14));
    setIdMercadoria(String(initialDraft?.idAtividadeMercadoria || 1));
    setValorExterno(moneyToInput(initialDraft?.valorReceitaExterna));
    setValorFolha(moneyToInput(initialDraft?.valorFolha));
    setCodigoMunicipio(String(initialDraft?.codigoOutroMunicipio || ''));
    setOutraUf(String(initialDraft?.outraUf || ''));
    setFiliais(String(initialDraft?.cnpjsFiliais || ''));
    setError(null);
  }, [open, sugerido, initialDraft]);

  if (!open) return null;

  const precisaMunicipio = casoEspecial && ISS_OUTRO_MUNICIPIO.has(idServico);

  const buildPayload = () => {
    const valor = parseDecimal(faturamento);
    if (!Number.isFinite(valor) || valor < 0) {
      setError('Informe um faturamento válido (ex.: 1500,00).');
      return null;
    }
    const extra = casoEspecial
      ? {
          idAtividadeServico: Number(idServico),
          idAtividadeMercadoria: Number(idMercadoria),
          valorReceitaExterna: parseDecimal(valorExterno) || 0,
          valorFolha: parseDecimal(valorFolha) || 0,
          codigoOutroMunicipio: codigoMunicipio.replace(/\D/g, ''),
          outraUf: outraUf.trim().toUpperCase().slice(0, 2),
          cnpjsFiliais: filiais,
        }
      : {};
    if (precisaMunicipio && (extra.codigoOutroMunicipio.length < 4 || extra.outraUf.length !== 2)) {
      setError('Informe o código do município e a UF do ISS.');
      return null;
    }
    setError(null);
    return { valorReceitaInterna: valor, casoEspecial, ...extra };
  };

  const handleAction = (callback) => {
    const payload = buildPayload();
    if (payload) callback(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="declarar-das-title"
      onClick={loading || saving ? undefined : onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="declarar-das-title" className="text-base font-semibold text-[var(--text-primary)]">
            Declarar {periodoLabel}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || saving}
            className="rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--canvas)]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Sugestão pelas notas deste app: {formatCurrencyBRL(sugerido)}
          {` (${notasCount} nota${notasCount === 1 ? '' : 's'})`}.
          Confirme ou altere o faturamento.
        </p>

        <label className="mt-4 block text-xs font-medium text-[var(--text-muted)]">
          Faturamento do mês (R$)
          <input
            type="text"
            inputMode="decimal"
            value={faturamento}
            onChange={(e) => setFaturamento(e.target.value)}
            className="mt-1 h-10 w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm text-[var(--text-primary)]"
          />
        </label>

        <label className="mt-4 flex items-start gap-2 text-sm text-[var(--text-primary)]">
          <input
            type="checkbox"
            checked={casoEspecial}
            onChange={(e) => setCasoEspecial(e.target.checked)}
            className="mt-1"
          />
          <span>
            Este mês não é o caso padrão
            <span className="block text-xs text-[var(--text-muted)]">
              Marque se houver fator R, ISS em outro município, retenção, ST, exportação, folha ou filial.
            </span>
          </span>
        </label>

        {casoEspecial ? (
          <div className="mt-4 space-y-3 rounded-[12px] border border-[var(--card-border)] p-3">
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--text-muted)]">Serviço</p>
              <AppSelect value={idServico} onChange={setIdServico} options={SERVICO_OPTIONS} />
            </div>
            {precisaMunicipio ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Código município (ISS)
                  <input
                    type="text"
                    value={codigoMunicipio}
                    onChange={(e) => setCodigoMunicipio(e.target.value)}
                    className="mt-1 h-10 w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  UF
                  <input
                    type="text"
                    maxLength={2}
                    value={outraUf}
                    onChange={(e) => setOutraUf(e.target.value.toUpperCase())}
                    className="mt-1 h-10 w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm"
                  />
                </label>
              </div>
            ) : null}
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--text-muted)]">Mercadoria</p>
              <AppSelect value={idMercadoria} onChange={setIdMercadoria} options={MERCADORIA_OPTIONS} />
            </div>
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Exportação / mercado externo (R$)
              <input
                type="text"
                inputMode="decimal"
                value={valorExterno}
                onChange={(e) => setValorExterno(e.target.value)}
                placeholder="0,00"
                className="mt-1 h-10 w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Folha de salário do mês (R$)
              <input
                type="text"
                inputMode="decimal"
                value={valorFolha}
                onChange={(e) => setValorFolha(e.target.value)}
                placeholder="0,00"
                className="mt-1 h-10 w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              CNPJ de filial sem movimento (opcional)
              <input
                type="text"
                value={filiais}
                onChange={(e) => setFiliais(e.target.value)}
                placeholder="Só números, separados por vírgula"
                className="mt-1 h-10 w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm"
              />
            </label>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        {draftSavedAt ? (
          <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
            Rascunho salvo. Você pode fechar e continuar depois.
          </p>
        ) : null}
        {simulationResult ? (
          <div className="mt-3 rounded-[12px] border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-semibold">Simulação concluída — nada foi transmitido.</p>
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">Ver retorno da Receita</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(simulationResult.dados ?? simulationResult, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || saving}
            className="inline-flex h-9 items-center rounded-[10px] border border-[var(--card-border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleAction(onSave)}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[var(--card-border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={() => handleAction(onSimulate)}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Simular sem transmitir
          </button>
          <button
            type="button"
            onClick={() => handleAction(onConfirm)}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-1 rounded-[10px] bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            Transmitir de verdade
          </button>
        </div>
      </div>
    </div>
  );
}
