'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthProvider';
import { validateStrongPassword } from '@/lib/passwordPolicy';
import { BrandWordmark } from '@/components/brand/BrandLogo';

function maskCnpj(value) {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function SolicitarAcessoPage() {
  const { signIn } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pwd = validateStrongPassword(password);
    if (!pwd.ok) {
      setError(pwd.message);
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    if (cnpj.replace(/\D/g, '').length !== 14) {
      setError('Informe um CNPJ válido (14 dígitos).');
      return;
    }
    if (!razaoSocial.trim() && !nomeFantasia.trim()) {
      setError('Informe razão social ou nome fantasia.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.postPublic('/auth/register-empresa', {
        user: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          password,
        },
        empresa: {
          cnpj: cnpj.replace(/\D/g, ''),
          razaoSocial: razaoSocial.trim(),
          nomeFantasia: nomeFantasia.trim(),
        },
        observacao: null,
        appOrigin: 'focosimples',
        signupMode: 'self_serve',
      });

      if (result?.session?.access_token) {
        await signIn(email.trim(), password);
        return;
      }
      if (result?.pendingApproval) {
        setSubmitted(true);
        return;
      }
      try {
        await signIn(email.trim(), password);
      } catch {
        setSubmitted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B2030] px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl dark:bg-[#15202b]">
          <h1 className="text-xl font-bold">Cadastro enviado</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Sua solicitação está em análise. Quando for aprovada, faça login normalmente.
          </p>
          <Link href="/login" className="mt-6 inline-flex h-11 items-center rounded-[14px] bg-[var(--accent)] px-6 text-sm font-semibold text-white">
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#0B2030] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl dark:bg-[#15202b]">
        <BrandWordmark className="mx-auto mb-6 h-8" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Quero ser cliente</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Cadastro da empresa e do administrador</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Nome completo</span>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 w-full rounded-[14px] border px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">E-mail</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-[14px] border px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">WhatsApp</span>
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 w-full rounded-[14px] border px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">CNPJ</span>
            <input required value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} className="h-11 w-full rounded-[14px] border px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Razão social</span>
            <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="h-11 w-full rounded-[14px] border px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Nome fantasia</span>
            <input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} className="h-11 w-full rounded-[14px] border px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Senha</span>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-[14px] border px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Confirmar senha</span>
            <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 w-full rounded-[14px] border px-3" />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enviar cadastro
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
          Já tem conta?{' '}
          <Link href="/login" className="font-semibold text-[var(--accent)]">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
