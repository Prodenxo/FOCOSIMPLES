'use client';

import { useCallback, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Save,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  criarCatalogoCliente,
  atualizarCatalogoCliente,
  excluirCatalogoCliente,
  lookupCnpj,
  lookupCep,
} from '@/lib/fiscalApi';
import { maskCep, maskCpfCnpj, onlyDigits, isValidCpfCnpj } from '@/lib/fiscalEmit';

/**
 * Modal para criar ou editar um cliente do catálogo.
 * Se `cliente` for passado, abre em modo edição.
 */
export function ClienteModal({ cliente, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [form, setForm] = useState({
    documento: cliente?.documento || '',
    nome: cliente?.nome || '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    endereco: {
      logradouro: cliente?.metadata_json?.endereco?.logradouro || '',
      numero: cliente?.metadata_json?.endereco?.numero || '',
      complemento: cliente?.metadata_json?.endereco?.complemento || '',
      bairro: cliente?.metadata_json?.endereco?.bairro || '',
      cep: cliente?.metadata_json?.endereco?.cep || '',
      cidade: cliente?.metadata_json?.endereco?.cidade || '',
      estado: cliente?.metadata_json?.endereco?.estado || '',
      codigoCidade: cliente?.metadata_json?.endereco?.codigoCidade || '',
    },
    indIEDest: cliente?.metadata_json?.indIEDest || '9',
    inscricaoEstadual: cliente?.metadata_json?.inscricaoEstadual || '',
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEnderecoChange = (field, value) => {
    setForm((prev) => ({ ...prev, endereco: { ...prev.endereco, [field]: value } }));
  };

  const handleLookupCnpj = async () => {
    const doc = onlyDigits(form.documento);
    if (doc.length !== 11 && doc.length !== 14) return;
    setLookingUp(true);
    try {
      const data = await lookupCnpj(doc);
      if (data) {
        setForm((prev) => ({
          ...prev,
          nome: data.nome || data.razaoSocial || prev.nome,
          email: data.email || prev.email,
          telefone: data.telefone || prev.telefone,
          endereco: {
            ...prev.endereco,
            logradouro: data.endereco?.logradouro || prev.endereco.logradouro,
            numero: data.endereco?.numero || prev.endereco.numero,
            complemento: data.endereco?.complemento || prev.endereco.complemento,
            bairro: data.endereco?.bairro || prev.endereco.bairro,
            cep: data.endereco?.cep || prev.endereco.cep,
            cidade: data.endereco?.cidade || data.endereco?.localidade || prev.endereco.cidade,
            estado: data.endereco?.uf || prev.endereco.estado,
          },
        }));
      }
    } catch (err) {
      console.warn('Lookup CNPJ failed:', err);
    } finally {
      setLookingUp(false);
    }
  };

  const handleLookupCep = async () => {
    const cep = onlyDigits(form.endereco.cep);
    if (cep.length !== 8) return;
    setLookingUp(true);
    try {
      const data = await lookupCep(cep);
      if (data) {
        setForm((prev) => ({
          ...prev,
          endereco: {
            ...prev.endereco,
            logradouro: data.logradouro || prev.endereco.logradouro,
            bairro: data.bairro || prev.endereco.bairro,
            cep: cep,
            cidade: data.cidade || data.localidade || prev.endereco.cidade,
            estado: data.uf || prev.endereco.estado,
            codigoCidade: data.ibge || prev.endereco.codigoCidade,
          },
        }));
      }
    } catch (err) {
      console.warn('Lookup CEP failed:', err);
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async () => {
    const doc = onlyDigits(form.documento);
    if (!doc || (!isValidCpfCnpj(doc))) {
      setError('Informe um CPF ou CNPJ válido.');
      return;
    }
    if (!form.nome?.trim()) {
      setError('Informe o nome/razão social.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        documento: doc,
        nome: form.nome.trim(),
        email: form.email?.trim() || undefined,
        telefone: form.telefone?.trim() || undefined,
        metadata_json: {
          endereco: {
            logradouro: form.endereco.logradouro?.trim(),
            numero: form.endereco.numero?.trim(),
            complemento: form.endereco.complemento?.trim(),
            bairro: form.endereco.bairro?.trim(),
            cep: onlyDigits(form.endereco.cep),
            cidade: form.endereco.cidade?.trim(),
            estado: form.endereco.estado?.trim()?.toUpperCase(),
            codigoCidade: onlyDigits(form.endereco.codigoCidade),
          },
          indIEDest: form.indIEDest,
          ...(form.indIEDest === '1' ? { inscricaoEstadual: form.inscricaoEstadual?.trim() } : {}),
        },
      };

      if (cliente?.id) {
        await atualizarCatalogoCliente(cliente.id, payload);
      } else {
        await criarCatalogoCliente(payload);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!cliente?.id) return;
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;

    setLoading(true);
    try {
      await excluirCatalogoCliente(cliente.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[20px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {cliente ? 'Editar cliente' : 'Novo cliente'}
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
            {/* Documento */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">CPF/CNPJ *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.documento}
                  onChange={(e) => handleChange('documento', maskCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                  className="flex-1 rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleLookupCnpj}
                  disabled={lookingUp}
                  className="rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-[var(--text-muted)] hover:bg-[var(--card-border)]"
                >
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nome / Razão Social *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                placeholder="Nome do cliente"
                className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              />
            </div>

            {/* Contato */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@cliente.com"
                  className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Telefone</label>
                <input
                  type="text"
                  value={form.telefone}
                  onChange={(e) => handleChange('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3">
              <p className="mb-3 text-xs font-semibold text-[var(--text-muted)]">Endereço</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] font-medium text-[var(--text-muted)]">CEP</label>
                  <input
                    type="text"
                    value={form.endereco.cep}
                    onChange={(e) => handleEnderecoChange('cep', maskCep(e.target.value))}
                    onBlur={handleLookupCep}
                    placeholder="00000-000"
                    className="w-full rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="mb-1 block text-[10px] font-medium text-[var(--text-muted)]">Logradouro</label>
                  <input
                    type="text"
                    value={form.endereco.logradouro}
                    onChange={(e) => handleEnderecoChange('logradouro', e.target.value)}
                    placeholder="Rua, Av..."
                    className="w-full rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-[var(--text-muted)]">Número</label>
                  <input
                    type="text"
                    value={form.endereco.numero}
                    onChange={(e) => handleEnderecoChange('numero', e.target.value)}
                    placeholder="123"
                    className="w-full rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[10px] font-medium text-[var(--text-muted)]">Complemento</label>
                  <input
                    type="text"
                    value={form.endereco.complemento}
                    onChange={(e) => handleEnderecoChange('complemento', e.target.value)}
                    placeholder="Sala, andar..."
                    className="w-full rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[10px] font-medium text-[var(--text-muted)]">Bairro</label>
                  <input
                    type="text"
                    value={form.endereco.bairro}
                    onChange={(e) => handleEnderecoChange('bairro', e.target.value)}
                    placeholder="Bairro"
                    className="w-full rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-[var(--text-muted)]">UF</label>
                  <input
                    type="text"
                    value={form.endereco.estado}
                    onChange={(e) => handleEnderecoChange('estado', e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    maxLength={2}
                    className="w-full rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[10px] font-medium text-[var(--text-muted)]">Cidade</label>
                  <input
                    type="text"
                    value={form.endereco.cidade}
                    onChange={(e) => handleEnderecoChange('cidade', e.target.value)}
                    placeholder="Cidade"
                    className="w-full rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* IE */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Indicador de IE</label>
                <select
                  value={form.indIEDest}
                  onChange={(e) => handleChange('indIEDest', e.target.value)}
                  className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                >
                  <option value="9">Não contribuinte</option>
                  <option value="1">Contribuinte ICMS</option>
                  <option value="2">Isento</option>
                </select>
              </div>
              {form.indIEDest === '1' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Inscrição Estadual</label>
                  <input
                    type="text"
                    value={form.inscricaoEstadual}
                    onChange={(e) => handleChange('inscricaoEstadual', e.target.value)}
                    placeholder="Número da IE"
                    className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                  />
                </div>
              )}
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
            {cliente?.id && (
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
