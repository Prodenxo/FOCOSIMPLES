'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Database,
  Loader2,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  criarCatalogoProduto,
  atualizarCatalogoProduto,
  excluirCatalogoProduto,
  importCnaesProdutos,
} from '@/lib/fiscalApi';
import { maskMoney, parseMoney } from '@/lib/fiscalEmit';
import {
  buildNfseCatalogProdutoMetadata,
  emptyNfseCatalogProdutoFormFields,
  lookupSuggestedCodigoNbs,
  NFSE_CINDOP_FIELD_HINT,
  nfseCatalogProdutoFormFieldsFromMetadata,
  normalizeCIndOpInput,
  normalizeCodigoNbsInput,
  validateNfseCatalogProdutoFormFields,
} from '@/lib/nfseCatalogProdutoMetadata';

/**
 * Modal para criar ou editar um produto/serviço do catálogo.
 * Se `produto` for passado, abre em modo edição.
 */
export function ProdutoModal({ produto, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const initialNfseReforma = nfseCatalogProdutoFormFieldsFromMetadata(produto?.metadata_json);

  const [form, setForm] = useState({
    codigo: produto?.codigo || '',
    nome: produto?.nome || '',
    discriminacao: produto?.discriminacao || '',
    descricao: produto?.descricao || '',
    ncm: produto?.ncm || '',
    cnae: produto?.cnae || '',
    cfop: produto?.cfop || '5102',
    valor_sugerido: produto?.valor_sugerido ? String(produto.valor_sugerido.toFixed(2)).replace('.', ',') : '',
    aliquota: produto?.aliquota ? String(produto.aliquota).replace('.', ',') : '',
    nfseReforma: initialNfseReforma,
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.codigo?.trim()) {
      setError('Informe o código do produto/serviço.');
      return;
    }
    if (!form.nome?.trim() && !form.discriminacao?.trim()) {
      setError('Informe o nome ou discriminação.');
      return;
    }

    const reformaError = validateNfseCatalogProdutoFormFields(form.nfseReforma || emptyNfseCatalogProdutoFormFields());
    if (reformaError) {
      setError(reformaError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const metadata_json = buildNfseCatalogProdutoMetadata(
        produto?.metadata_json,
        form.nfseReforma || emptyNfseCatalogProdutoFormFields(),
      );
      const payload = {
        codigo: form.codigo.trim(),
        nome: form.nome?.trim() || form.discriminacao?.trim(),
        discriminacao: form.discriminacao?.trim() || form.nome?.trim(),
        descricao: form.descricao?.trim() || form.discriminacao?.trim() || form.nome?.trim(),
        ncm: form.ncm?.replace(/\D/g, '') || undefined,
        cnae: form.cnae?.replace(/\D/g, '') || undefined,
        cfop: form.cfop?.replace(/\D/g, '') || '5102',
        documentType: produto?.document_type || 'NFSE',
        ...(Object.keys(metadata_json).length ? { metadata_json } : {}),
        ...(form.valor_sugerido ? { valor_sugerido: parseMoney(form.valor_sugerido) } : {}),
        ...(form.aliquota ? { aliquota: parseFloat(form.aliquota.replace(',', '.')) } : {}),
      };

      if (produto?.id) {
        await atualizarCatalogoProduto(produto.id, payload);
      } else {
        await criarCatalogoProduto(payload);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!produto?.id) return;
    if (!window.confirm('Tem certeza que deseja excluir este produto/serviço?')) return;

    setLoading(true);
    try {
      await excluirCatalogoProduto(produto.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir produto.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCnaes = async () => {
    if (!window.confirm('Isso vai importar os CNAEs do Simples Nacional. Continuar?')) return;

    setImporting(true);
    setError(null);
    try {
      await importCnaesProdutos();
      onSuccess?.();
      alert('CNAEs importados com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar CNAEs.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[20px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {produto ? 'Editar produto/serviço' : 'Novo produto/serviço'}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Adicione ao catálogo para usar nas emissões
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--canvas)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-4">
            {/* Importar CNAEs */}
            {!produto && (
              <div className="rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[var(--text-muted)]" />
                    <span className="text-sm text-[var(--text-primary)]">Importar CNAEs do Simples</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleImportCnaes}
                    disabled={importing}
                    className="rounded-[8px] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Importar'}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Importa os códigos de serviço da LC 116 para uso no catálogo.
                </p>
              </div>
            )}

            {/* Código */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Código *</label>
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => handleChange('codigo', e.target.value)}
                placeholder="Código do produto ou serviço (ex: 171901)"
                className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              />
            </div>

            {/* Nome / Discriminação */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nome / Descrição *</label>
              <input
                type="text"
                value={form.nome || form.discriminacao}
                onChange={(e) => handleChange('nome', e.target.value)}
                placeholder="Nome ou descrição do produto/serviço"
                className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              />
            </div>

            {/* Discriminação detalhada (para NFS-e) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Discriminação (detalhamento)</label>
              <textarea
                value={form.discriminacao}
                onChange={(e) => handleChange('discriminacao', e.target.value)}
                placeholder="Descrição detalhada do serviço..."
                rows={2}
                className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              />
            </div>

            {/* Campos fiscais */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">NCM (mercadoria)</label>
                <input
                  type="text"
                  value={form.ncm}
                  onChange={(e) => handleChange('ncm', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000000"
                  className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">CNAE (serviço)</label>
                <input
                  type="text"
                  value={form.cnae}
                  onChange={(e) => handleChange('cnae', e.target.value.replace(/\D/g, ''))}
                  placeholder="4530701"
                  className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">CFOP padrão</label>
                <input
                  type="text"
                  value={form.cfop}
                  onChange={(e) => handleChange('cfop', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="5102"
                  className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Alíquota ISS (%)</label>
                <input
                  type="text"
                  value={form.aliquota}
                  onChange={(e) => handleChange('aliquota', e.target.value)}
                  placeholder="5"
                  className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Valor sugerido */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Valor sugerido (R$)</label>
              <input
                type="text"
                value={form.valor_sugerido}
                onChange={(e) => handleChange('valor_sugerido', maskMoney(e.target.value))}
                placeholder="0,00"
                className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              />
            </div>

            {/* Reforma Tributária (NFS-e) */}
            <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="text-xs text-amber-900 dark:text-amber-100">
                Campos IBS/CBS exigidos por algumas prefeituras (ex.: Ribeirão Preto). Configure uma vez
                no catálogo; na emissão basta escolher o serviço.
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Reforma Tributária (NFS-e)</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">NBS (9 dígitos)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.nfseReforma?.codigoNbs || ''}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      nfseReforma: {
                        ...prev.nfseReforma,
                        codigoNbs: normalizeCodigoNbsInput(e.target.value),
                      },
                    }))}
                    onBlur={() => {
                      const nbs = form.nfseReforma?.codigoNbs?.trim() || '';
                      if (nbs.length === 9 && nbs[0] === '1') return;
                      const suggested = lookupSuggestedCodigoNbs(form.codigo);
                      if (suggested && !nbs) {
                        setForm((prev) => ({
                          ...prev,
                          nfseReforma: { ...prev.nfseReforma, codigoNbs: suggested },
                        }));
                      }
                    }}
                    placeholder="Ex.: 104011900"
                    maxLength={9}
                    className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    Nomenclatura Brasileira de Serviços — 9 dígitos, começando com 1 (diferente do código LC 116).
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Indicador de operação (cIndOp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.nfseReforma?.cIndOp || ''}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      nfseReforma: {
                        ...prev.nfseReforma,
                        cIndOp: normalizeCIndOpInput(e.target.value),
                      },
                    }))}
                    placeholder="Ex.: 160201"
                    maxLength={6}
                    className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">{NFSE_CINDOP_FIELD_HINT}</p>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--card-border)] px-5 py-4">
          <div>
            {produto?.id && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)]"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
