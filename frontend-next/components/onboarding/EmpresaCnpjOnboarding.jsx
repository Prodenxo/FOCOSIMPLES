'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { useAuth } from '@/context/AuthProvider';

function Field({ label, required, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm';

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
    if (digits.length !== 14 || !isValidEmpresaCnpj(digits)) {
      setCnpjError('Informe um CNPJ válido com 14 dígitos.');
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
      setCnpjError(e instanceof Error ? e.message : 'Erro ao consultar CNPJ.');
      setLookupLoaded(false);
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!lookupLoaded) {
      setError('Consulte o CNPJ antes de salvar.');
      return;
    }
    if (!confirmed) {
      setError('Confirme que os dados estão corretos.');
      return;
    }
    const email = String(form.email || '').trim();
    if (!email.includes('@')) {
      setError('Informe o e-mail da empresa.');
      return;
    }
    setSubmitting(true);
    try {
      await completeEmpresaCnpjOnboarding({ ...form, confirmed: true });
      await leaveIfDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  if (booting) {
    return <LoadingPanel label="Verificando cadastro…" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CNPJ da empresa</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Cadastro obrigatório uma vez. Use o CNPJ que consta no certificado e-CNPJ.
        </p>
      </div>

      <Field label="CNPJ" required>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={cnpjInput}
            onChange={(e) => setCnpjInput(formatEmpresaCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
          />
          <button
            type="button"
            className="shrink-0 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void handleLookup()}
            disabled={cnpjLoading}
          >
            {cnpjLoading ? '…' : 'Buscar'}
          </button>
        </div>
        {cnpjError ? <p className="mt-1 text-xs text-red-600">{cnpjError}</p> : null}
      </Field>

      {lookupLoaded ? (
        <div className="space-y-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <Field label="Razão social">
            <input className={inputClass} value={form.razao_social || ''} onChange={(e) => setField('razao_social', e.target.value)} />
          </Field>
          <Field label="Nome fantasia">
            <input className={inputClass} value={form.nome_fantasia || ''} onChange={(e) => setField('nome_fantasia', e.target.value)} />
          </Field>
          <Field label="E-mail da empresa" required>
            <input className={inputClass} value={form.email || ''} onChange={(e) => setField('email', e.target.value)} type="email" />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
            <span>Confirmo que os dados conferem com a Receita Federal.</span>
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        disabled={submitting || !lookupLoaded}
        onClick={() => void handleSubmit()}
      >
        {submitting ? 'Salvando…' : 'Salvar e continuar'}
      </button>
    </div>
  );
}
