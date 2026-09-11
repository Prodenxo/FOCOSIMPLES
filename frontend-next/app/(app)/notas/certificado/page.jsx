'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileWarning,
  KeyRound,
  Loader2,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import {
  cadastrarFiscalCompany,
  fetchCertificateStatus,
  fetchFiscalCompany,
  fetchNfsePrestadorPrefill,
  lookupCnpj,
  removeCertificate,
  updateFiscalCompany,
  uploadCertificate,
  importCnaesProdutos,
} from '@/lib/fiscalApi';
import {
  buildEnrichedCertPageForm,
  buildPlugNotasEmpresaPayload,
  getPlugNotasCompanyValidationMessage,
  isEmpresaCadastradaNoEmissor,
  mergeCnpjLookupIntoCertPageForm,
} from '@/lib/plugNotasEmpresaForm';
import { EmpresaFiscalForm } from '@/components/notas/EmpresaFiscalForm';
import {
  describeCertificateState,
  formatCnpj,
  formatDateBR,
  resolveCertificateState,
} from '@/lib/fiscalFormat';
import { Card } from '@/components/ui/Card';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { CertificateIllustration } from '@/components/illustrations/CertificateIllustration';
import { humanizePlugNotasEmpresaError } from '@/lib/plugNotasEmpresaErrorHints';

/**
 * Aba Certificado — gerencia o certificado digital e dados da empresa fiscal.
 * Documentação:
 * - Upload via input file (.pfx) com campo de senha.
 * - Substituição via novo upload; remoção exige confirmação clara.
 * - Senha nunca é exibida após o envio nem armazenada no navegador.
 * - Edição da empresa fiscal via formulário (PATCH).
 * - Importação de CNAEs como produtos é uma ação secundária opcional.
 */
export default function CertificadoPage() {
  const { userId } = useAuth();

  const [certStatus, setCertStatus] = useState(null);
  const [certLoading, setCertLoading] = useState(true);
  const [certError, setCertError] = useState(null);

  const [company, setCompany] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState(null);

  const [companyForm, setCompanyForm] = useState(null);
  const [companyDirty, setCompanyDirty] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySavedAt, setCompanySavedAt] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPassword, setUploadPassword] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [importCnaesLoading, setImportCnaesLoading] = useState(false);
  const [importCnaesMsg, setImportCnaesMsg] = useState(null);

  const [empresaRegistered, setEmpresaRegistered] = useState(false);
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState(null);

  const documento = certStatus?.documento || company?.cpfCnpj || company?.cnpj || null;

  const loadCert = useCallback(async () => {
    setCertLoading(true);
    setCertError(null);
    try {
      const data = await fetchCertificateStatus();
      setCertStatus(data || null);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Falha ao consultar certificado.');
      setCertStatus(null);
    } finally {
      setCertLoading(false);
    }
  }, []);

  const enrichCompanyForm = useCallback(async (empresaData, options = {}) => {
    const {
      prefillOnlyFillEmpty = true,
      lookupOnlyFillEmpty = true,
      cnpj = documento,
    } = options;

    let prefill = null;
    try {
      prefill = await fetchNfsePrestadorPrefill();
    } catch {
      prefill = null;
    }

    return buildEnrichedCertPageForm({
      empresa: empresaData,
      prefill,
      cnpj,
      lookupCnpjFn: lookupCnpj,
      prefillOnlyFillEmpty,
      lookupOnlyFillEmpty,
    });
  }, [documento]);

  const loadCompany = useCallback(async () => {
    if (!documento) {
      setCompany(null);
      setCompanyForm(null);
      return;
    }
    setCompanyLoading(true);
    setCompanyError(null);
    try {
      let data = null;
      try {
        data = await fetchFiscalCompany(documento);
      } catch {
        data = null;
      }

      const enrichedForm = await enrichCompanyForm(data, {
        prefillOnlyFillEmpty: true,
        lookupOnlyFillEmpty: true,
      });

      const hasEmpresa = Boolean(data);
      const hasPrefill = Boolean(
        enrichedForm?.razaoSocial
        || enrichedForm?.cpfCnpj
        || enrichedForm?.logradouro
        || enrichedForm?.cep,
      );

      setEmpresaRegistered(isEmpresaCadastradaNoEmissor(data));
      setCompany(hasEmpresa || hasPrefill ? (data || { cpfCnpj: documento }) : null);
      if (hasEmpresa || hasPrefill) {
        setCompanyForm(enrichedForm);
        setCompanyDirty(false);
      } else {
        setCompanyForm(null);
      }
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : 'Falha ao consultar empresa.');
      setCompany(null);
      setCompanyForm(null);
    } finally {
      setCompanyLoading(false);
    }
  }, [documento, enrichCompanyForm]);

  useEffect(() => {
    if (!userId) return;
    loadCert();
  }, [userId, loadCert]);

  useEffect(() => {
    if (!userId) return;
    loadCompany();
  }, [userId, loadCompany]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onRefresh = () => {
      loadCert();
      loadCompany();
    };
    window.addEventListener('focosimples:fiscal-refresh', onRefresh);
    return () => window.removeEventListener('focosimples:fiscal-refresh', onRefresh);
  }, [loadCert, loadCompany]);

  const certState = resolveCertificateState({
    loading: certLoading,
    error: certError,
    hasUserCertificate: Boolean(certStatus?.hasUserCertificate),
    hasEnvCertificate: Boolean(certStatus?.hasEnvCertificate),
    validTo: certStatus?.certValidTo || null,
  });
  const certInfo = describeCertificateState(certState);

  const handleSelectFile = (e) => {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);
    setUploadError(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Selecione o arquivo .pfx do certificado.');
      return;
    }
    if (!uploadPassword) {
      setUploadError('Informe a senha do certificado.');
      return;
    }
    setUploadSubmitting(true);
    setUploadError(null);
    try {
      await uploadCertificate(uploadFile, uploadPassword);
      setUploadFile(null);
      setUploadPassword('');
      // Limpa input file.
      const input = document.getElementById('cert-upload-input');
      if (input) input.value = '';
      await loadCert();
      const status = await fetchCertificateStatus().catch(() => certStatus);
      const cnpjDoc = status?.documento || documento;
      if (cnpjDoc) {
        let empresaData = null;
        try {
          empresaData = await fetchFiscalCompany(cnpjDoc);
        } catch {
          empresaData = null;
        }
        const enrichedForm = await enrichCompanyForm(empresaData, {
          cnpj: cnpjDoc,
          prefillOnlyFillEmpty: false,
          lookupOnlyFillEmpty: true,
        });
        setEmpresaRegistered(isEmpresaCadastradaNoEmissor(empresaData));
        setCompany(empresaData || { cpfCnpj: cnpjDoc });
        setCompanyForm(enrichedForm);
        setCompanyDirty(false);
        void runCnpjLookup(cnpjDoc, enrichedForm, false);
      } else {
        await loadCompany();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Falha no envio do certificado.');
    } finally {
      setUploadSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeCertificate();
      setConfirmRemove(false);
      await loadCert();
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Falha ao remover certificado.');
    } finally {
      setRemoving(false);
    }
  };

  const runCnpjLookup = useCallback(async (cnpjDigits, currentForm, onlyFillEmpty = true) => {
    const digits = String(cnpjDigits || '').replace(/\D/g, '');
    if (digits.length !== 14) return;
    setCnpjLookupLoading(true);
    setCnpjLookupError(null);
    try {
      const lookup = await lookupCnpj(digits);
      setCompanyForm((prev) => mergeCnpjLookupIntoCertPageForm(
        prev || currentForm,
        lookup,
        { onlyFillEmpty },
      ));
    } catch (err) {
      setCnpjLookupError(err instanceof Error ? err.message : 'Falha ao consultar CNPJ.');
    } finally {
      setCnpjLookupLoading(false);
    }
  }, []);

  const handleCompanyField = (field, value) => {
    setCompanyForm((prev) => ({ ...(prev || {}), [field]: value }));
    setCompanyDirty(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!companyForm) return;

    const validationMsg = getPlugNotasCompanyValidationMessage(companyForm);
    if (validationMsg) {
      setCompanyError(validationMsg);
      return;
    }

    setCompanySaving(true);
    setCompanySavedAt(null);
    setCompanyError(null);
    try {
      const payload = buildPlugNotasEmpresaPayload(companyForm);
      const updated = empresaRegistered
        ? await updateFiscalCompany(payload)
        : await cadastrarFiscalCompany(payload);
      setEmpresaRegistered(true);
      const refreshedForm = await enrichCompanyForm(updated || companyForm);
      setCompany(updated || companyForm);
      setCompanyForm(refreshedForm);
      setCompanyDirty(false);
      setCompanySavedAt(new Date());
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Falha ao salvar dados da empresa.';
      setCompanyError(humanizePlugNotasEmpresaError(raw));
    } finally {
      setCompanySaving(false);
    }
  };

  const handleImportCnaes = async () => {
    setImportCnaesLoading(true);
    setImportCnaesMsg(null);
    try {
      const result = await importCnaesProdutos();
      const count = result?.count || result?.total || result?.imported || 0;
      setImportCnaesMsg(
        count > 0
          ? `${count} produto${count === 1 ? '' : 's'} importado${count === 1 ? '' : 's'} a partir dos CNAEs.`
          : 'Nenhum CNAE disponível para importação.',
      );
    } catch (err) {
      setImportCnaesMsg(
        err instanceof Error ? err.message : 'Falha ao importar CNAEs.',
      );
    } finally {
      setImportCnaesLoading(false);
    }
  };

  const hasCert = Boolean(certStatus?.hasUserCertificate || certStatus?.hasEnvCertificate);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Card do Certificado */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                Certificado digital
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Arquivo .pfx utilizado para emissão fiscal.
              </p>
            </div>
            <button
              type="button"
              onClick={loadCert}
              className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              aria-label="Recarregar certificado"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              Recarregar
            </button>
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)]/60 dark:bg-[var(--accent-soft)]/40">
              <CertificateIllustration size={84} />
            </div>
            <div className="min-w-0 flex-1">
              {certLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Verificando…</p>
              ) : certError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{certError}</p>
              ) : (
                <>
                  <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${certBadgeClass(certInfo.tone)}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${certDotClass(certInfo.tone)}`} aria-hidden />
                    {certInfo.label}
                  </span>
                  <ul className="mt-3 space-y-1 text-sm text-[var(--text-primary)]">
                    <li>
                      <span className="text-[var(--text-muted)]">Documento:</span>{' '}
                      {documento ? formatCnpj(documento) : '—'}
                    </li>
                    <li>
                      <span className="text-[var(--text-muted)]">Validade:</span>{' '}
                      {certStatus?.certValidTo ? formatDateBR(certStatus.certValidTo) : '—'}
                    </li>
                    <li>
                      <span className="text-[var(--text-muted)]">Origem:</span>{' '}
                      {certStatus?.hasUserCertificate
                        ? 'Enviado pelo usuário'
                        : certStatus?.hasEnvCertificate
                          ? 'Configurado no servidor'
                          : 'Não configurado'}
                    </li>
                  </ul>
                  {Array.isArray(certStatus?.documentosAtivos) ? null : certStatus?.documentosAtivos ? (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Documentos ativos:{' '}
                      {Object.entries(certStatus.documentosAtivos)
                        .filter(([, v]) => v)
                        .map(([k]) => k.toUpperCase())
                        .join(', ') || '—'}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Upload / substituição */}
          <form onSubmit={handleUpload} className="mt-6 border-t border-[var(--card-border)] pt-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {hasCert ? 'Substituir certificado' : 'Enviar certificado'}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              A senha é usada apenas neste envio e não fica salva no navegador.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm">
                <Upload className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
                <span className="truncate text-[var(--text-primary)]">
                  {uploadFile ? uploadFile.name : 'Selecionar arquivo .pfx'}
                </span>
                <input
                  id="cert-upload-input"
                  type="file"
                  accept=".pfx,application/x-pkcs12"
                  onChange={handleSelectFile}
                  className="sr-only"
                />
              </label>

              <label className="flex h-11 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm">
                <Lock className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
                <input
                  type="password"
                  value={uploadPassword}
                  onChange={(e) => setUploadPassword(e.target.value)}
                  placeholder="Senha do certificado"
                  autoComplete="off"
                  className="w-40 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </label>
            </div>

            {uploadError ? (
              <p className="mt-2 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {uploadError}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={uploadSubmitting}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-card)] hover:opacity-90 disabled:opacity-60"
              >
                {uploadSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
                {hasCert ? 'Substituir' : 'Enviar certificado'}
              </button>

              {hasCert ? (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  disabled={removing}
                  className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remover
                </button>
              ) : null}
            </div>
          </form>

          {/* Confirmação de remoção */}
          {confirmRemove ? (
            <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                Remover o certificado?
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                Esta ação interrompe a emissão de notas fiscais até um novo envio.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                  Confirmar remoção
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="inline-flex h-9 items-center rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-4 text-xs font-semibold text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </Card>

        {/* Card da Empresa */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                Dados da empresa
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Informações fiscais vinculadas ao CNPJ configurado.
              </p>
            </div>
          </div>

          {companyLoading && !company ? (
            <div className="mt-4"><LoadingPanel label="Carregando dados da empresa…" /></div>
          ) : companyError ? (
            <div className="mt-4"><ErrorPanel message={companyError} onRetry={loadCompany} /></div>
          ) : !company ? (
            <div className="mt-4 flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
              <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  Empresa ainda não cadastrada
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Envie o certificado para iniciar a configuração automática no serviço de emissão.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveCompany} className="mt-4 space-y-4">
              {!empresaRegistered ? (
                <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  Primeira configuração: preencha os dados e salve para cadastrar a empresa no emissor fiscal.
                </p>
              ) : null}

              <EmpresaFiscalForm
                form={companyForm}
                onChange={handleCompanyField}
                cnpjLookupLoading={cnpjLookupLoading}
                cnpjLookupError={cnpjLookupError}
              />

              {documento ? (
                <button
                  type="button"
                  onClick={() => runCnpjLookup(documento, companyForm, true)}
                  disabled={cnpjLookupLoading}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline disabled:opacity-60"
                >
                  Atualizar dados do CNPJ na Receita
                </button>
              ) : null}

              <div className="border-t border-[var(--card-border)] pt-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Importar CNAEs como produtos
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Cria itens básicos no catálogo a partir dos CNAEs da empresa.
                    </p>
                    {importCnaesMsg ? (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{importCnaesMsg}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleImportCnaes}
                    disabled={importCnaesLoading}
                    className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-4 text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
                  >
                    {importCnaesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
                    Importar CNAEs
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--card-border)] pt-4">
                <button
                  type="submit"
                  disabled={!companyDirty || companySaving}
                  className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-card)] hover:opacity-90 disabled:opacity-60"
                >
                  {companySaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                  Salvar alterações
                </button>
                {companySavedAt ? (
                  <span className="text-xs text-[var(--text-muted)]">
                    Salvo às {companySavedAt.toLocaleTimeString('pt-BR')}
                  </span>
                ) : null}
              </div>
            </form>
          )}
        </Card>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        O conteúdo e a senha do certificado são transmitidos de forma segura e nunca ficam visíveis após o envio.
      </p>
    </div>
  );
}

function certBadgeClass(tone) {
  switch (tone) {
    case 'success': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'danger': return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'warning': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300';
  }
}

function certDotClass(tone) {
  switch (tone) {
    case 'success': return 'bg-emerald-500';
    case 'danger': return 'bg-red-500';
    case 'warning': return 'bg-amber-500';
    default: return 'bg-slate-400';
  }
}
