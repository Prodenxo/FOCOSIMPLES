'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Search } from 'lucide-react';
import {
  formatEmpresaCnpj,
  isValidEmpresaCnpj,
  onlyEmpresaCnpjDigits,
} from '@/lib/empresaCnpj';
import { mapCnpjLookupToEmpresa } from '@/lib/mapCnpjLookupToEmpresa';
import {
  completeEmpresaCnpjOnboarding,
  lookupEmpresaCnpj,
} from '@/lib/empresaOnboardingApi';
import { isEmpresaCnpjOnboardingRequired } from '@/lib/empresaCnpjGate';
import { fetchActivationProgress, isActivationCoreComplete } from '@/lib/activationApi';
import { humanizeCnpjLookupError } from '@/lib/humanizeCnpjLookupError';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthProvider';

function FormField({
  label,
  required,
  children,
  className = '',
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
        {label}
        {required ? <span className="text-[var(--text-muted)]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'h-11 w-full rounded-xl border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]';

const isValidEmail = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed.includes('@') && trimmed.includes('.') && trimmed.length >= 6;
};

export function EmpresaCnpjOnboarding() {
  const router = useRouter();
  const { role } = useAuth();
  const [booting, setBooting] = useState(true);
  const [form, setForm] = useState({});
  const [cnpjInput, setCnpjInput] = useState('');
  const [lookupLoaded, setLookupLoaded] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const leaveIfDone = useCallback(async () => {
    const still = await isEmpresaCnpjOnboardingRequired(role);
    if (still) {
      setBooting(false);
      return;
    }
    const activation = await fetchActivationProgress();
    if (activation && !isActivationCoreComplete(activation)) {
      router.replace('/ativacao');
    } else {
      router.replace('/');
    }
  }, [router, role]);

  useEffect(() => {
    void leaveIfDone();
  }, [leaveIfDone]);

  const handleLookup = async () => {
    const digits = onlyEmpresaCnpjDigits(cnpjInput);
    if (digits.length !== 14) {
      setCnpjError('Informe um CNPJ com 14 dígitos.');
      return;
    }
    if (!isValidEmpresaCnpj(digits)) {
      setCnpjError('CNPJ inválido. Confira os dígitos verificadores.');
      return;
    }
    setCnpjLoading(true);
    setCnpjError('');
    try {
      const data = await lookupEmpresaCnpj(digits);
      setForm((prev) => mapCnpjLookupToEmpresa(data, { ...prev, cnpj: digits }));
      setLookupLoaded(true);
      setConfirmed(false);
    } catch (e) {
      setCnpjError(humanizeCnpjLookupError(e));
      setLookupLoaded(false);
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    const digits = onlyEmpresaCnpjDigits(cnpjInput);
    if (digits.length !== 14) {
      setError('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    if (!lookupLoaded || (!form.razao_social && !form.empresa)) {
      setError('Busque o CNPJ na Receita antes de salvar.');
      return;
    }
    if (!isValidEmail(form.email)) {
      setError('Informe um e-mail válido da empresa.');
      return;
    }
    if (!confirmed) {
      setError('Marque a confirmação para salvar os dados.');
      return;
    }
    setSubmitting(true);
    try {
      await completeEmpresaCnpjOnboarding({
        ...form,
        cnpj: digits,
        empresa: form.empresa || form.razao_social,
        razao_social: form.razao_social || form.empresa,
        confirmed: true,
      });
      await leaveIfDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar dados da empresa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (booting) {
    return <LoadingPanel label="Verificando cadastro…" />;
  }

  const cnpjValid = isValidEmpresaCnpj(cnpjInput);

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Cadastro da empresa
        </h1>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Busque os dados na Receita, revise, informe o e-mail e confirme. Feito uma vez, não pedimos de novo.
        </p>
      </header>

      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">CNPJ</h2>
        <input
          className={`${inputClass} mb-2`}
          value={cnpjInput}
          onChange={(e) => {
            setCnpjInput(formatEmpresaCnpj(e.target.value));
            if (cnpjError) setCnpjError('');
            if (lookupLoaded) setLookupLoaded(false);
          }}
          placeholder="00.000.000/0001-00"
          inputMode="numeric"
          maxLength={18}
          aria-label="CNPJ da empresa"
        />
        {cnpjError ? (
          <p className="mb-3 text-xs text-red-600">{cnpjError}</p>
        ) : null}
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => void handleLookup()}
          disabled={cnpjLoading || !cnpjValid}
        >
          {cnpjLoading ? (
            <span className="text-[var(--text-muted)]">Consultando…</span>
          ) : (
            <>
              <Search className="h-4 w-4" aria-hidden />
              Buscar dados na Receita
            </>
          )}
        </button>
      </Card>

      {lookupLoaded ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[var(--accent)]" aria-hidden />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados encontrados</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Confira e ajuste se necessário. O e-mail não vem da Receita — informe o da empresa.
          </p>

          <FormField label="Razão social" required>
            <input
              className={inputClass}
              value={form.razao_social || form.empresa || ''}
              onChange={(e) => {
                const t = e.target.value;
                setForm((prev) => ({ ...prev, razao_social: t, empresa: t }));
              }}
              placeholder="Razão social conforme Receita Federal"
            />
          </FormField>

          <FormField label="Nome fantasia">
            <input
              className={inputClass}
              value={form.nome_fantasia || ''}
              onChange={(e) => setField('nome_fantasia', e.target.value)}
              placeholder="Como a empresa é conhecida"
            />
          </FormField>

          <FormField label="Inscrição estadual">
            <input
              className={inputClass}
              value={form.inscricao_estadual || ''}
              onChange={(e) => setField('inscricao_estadual', e.target.value)}
            />
          </FormField>

          <FormField label="Logradouro">
            <input
              className={inputClass}
              value={form.logradouro || ''}
              onChange={(e) => setField('logradouro', e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Número" className="sm:col-span-1">
              <input
                className={inputClass}
                value={form.numero || ''}
                onChange={(e) => setField('numero', e.target.value)}
              />
            </FormField>
            <FormField label="Complemento" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.complemento || ''}
                onChange={(e) => setField('complemento', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Bairro">
            <input
              className={inputClass}
              value={form.bairro || ''}
              onChange={(e) => setField('bairro', e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Cidade" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.cidade || ''}
                onChange={(e) => setField('cidade', e.target.value)}
              />
            </FormField>
            <FormField label="UF">
              <input
                className={inputClass}
                value={form.estado || ''}
                onChange={(e) => setField('estado', e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
                maxLength={2}
              />
            </FormField>
          </div>

          <FormField label="CEP">
            <input
              className={inputClass}
              value={form.cep || ''}
              onChange={(e) => setField('cep', e.target.value)}
              inputMode="numeric"
            />
          </FormField>

          <FormField label="Telefone">
            <input
              className={inputClass}
              value={form.telefone || ''}
              onChange={(e) => setField('telefone', e.target.value)}
              inputMode="tel"
            />
          </FormField>

          <FormField label="E-mail da empresa" required>
            <input
              className={inputClass}
              type="email"
              autoCapitalize="none"
              value={form.email || ''}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="contato@empresa.com.br"
            />
          </FormField>

          <button
            type="button"
            className={`mt-2 flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition ${
              confirmed
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--card-border)] bg-transparent'
            }`}
            onClick={() => setConfirmed((v) => !v)}
            aria-pressed={confirmed}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                confirmed
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--card-border)]'
              }`}
              aria-hidden
            >
              {confirmed ? '✓' : ''}
            </span>
            <span className="leading-snug text-[var(--text-primary)]">
              Confirmo que os dados acima correspondem à minha empresa.
            </span>
          </button>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!confirmed || submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Salvando…' : 'Salvar e entrar'}
          </button>
        </Card>
      ) : null}
    </div>
  );
}
