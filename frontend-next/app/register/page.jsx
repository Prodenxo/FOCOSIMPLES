'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { BrandWordmark } from '@/components/brand/BrandLogo';
import { validateStrongPassword } from '@/lib/passwordPolicy';
import { validateInviteTokenPublic } from '@/lib/invitesService';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = (searchParams.get('convite') || '').trim();
  const { signUp, booting, isAuthenticated } = useAuth();

  const [phase, setPhase] = useState(inviteToken ? 'loading' : 'no_invite');
  const [empresaName, setEmpresaName] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!booting && isAuthenticated) router.replace('/');
  }, [booting, isAuthenticated, router]);

  useEffect(() => {
    if (!inviteToken) {
      setPhase('no_invite');
      return;
    }
    let cancelled = false;
    setPhase('loading');
    validateInviteTokenPublic(inviteToken)
      .then((r) => {
        if (cancelled) return;
        setPhase(r.status === 'valid' ? 'valid' : r.status);
        if (r.empresaName) setEmpresaName(r.empresaName);
      })
      .catch(() => {
        if (!cancelled) setPhase('network_error');
      });
    return () => { cancelled = true; };
  }, [inviteToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !displayName.trim() || !phone.trim()) {
      setError('Preencha nome, e-mail, telefone e senha.');
      return;
    }
    const pwd = validateStrongPassword(password);
    if (!pwd.ok) {
      setError(pwd.message);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await signUp({
        email,
        password,
        phone,
        displayName,
        inviteToken,
      });
      if (result.needsEmailConfirmation) {
        setError(`Verifique seu e-mail (${result.email}) para confirmar a conta. Depois faça login.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B2030] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-[#15202b]">
        <div className="mb-6 flex flex-col items-center gap-3">
          <BrandWordmark />
          <h1 className="text-xl font-bold text-[#0B2030] dark:text-white">Criar conta</h1>
        </div>

        {phase === 'loading' ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#5c6b7a]">
            <Loader2 className="h-5 w-5 animate-spin text-[#00856A]" />
            Verificando convite…
          </div>
        ) : null}

        {phase === 'no_invite' ? (
          <div className="space-y-4 text-center">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Nenhum convite detectado.
            </p>
            <p className="text-sm text-[#5c6b7a]">
              Você precisa de um link de convite válido para criar uma conta nesta plataforma.
            </p>
            <Link href="/login" className="inline-block text-sm font-semibold text-[#00856A] hover:underline">
              Voltar ao login
            </Link>
          </div>
        ) : null}

        {phase !== 'valid' && phase !== 'loading' && phase !== 'no_invite' ? (
          <div className="space-y-4 text-center">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Convite inválido ou expirado.
            </p>
            <p className="text-sm text-[#5c6b7a]">
              Solicite um novo link ao administrador da sua empresa.
            </p>
            <Link href="/login" className="inline-block text-sm font-semibold text-[#00856A] hover:underline">
              Voltar ao login
            </Link>
          </div>
        ) : null}

        {phase === 'valid' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {empresaName ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Convite da empresa <strong>{empresaName}</strong>
              </p>
            ) : null}

            <div>
              <label htmlFor="reg-email" className="mb-1 block text-sm font-medium">E-mail *</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#e8edf2] px-3 py-2.5 text-sm focus:border-[#00856A] focus:outline-none focus:ring-2 focus:ring-[#00856A]/20"
              />
            </div>
            <div>
              <label htmlFor="reg-name" className="mb-1 block text-sm font-medium">Nome completo *</label>
              <input
                id="reg-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-[#e8edf2] px-3 py-2.5 text-sm focus:border-[#00856A] focus:outline-none focus:ring-2 focus:ring-[#00856A]/20"
              />
            </div>
            <div>
              <label htmlFor="reg-phone" className="mb-1 block text-sm font-medium">Telefone *</label>
              <input
                id="reg-phone"
                type="tel"
                placeholder="(16) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-[#e8edf2] px-3 py-2.5 text-sm focus:border-[#00856A] focus:outline-none focus:ring-2 focus:ring-[#00856A]/20"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="mb-1 block text-sm font-medium">Senha *</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#e8edf2] px-3 py-2.5 text-sm focus:border-[#00856A] focus:outline-none focus:ring-2 focus:ring-[#00856A]/20"
              />
              <p className="mt-1 text-xs text-[#5c6b7a]">Mínimo 8 caracteres, 1 maiúscula e 1 especial.</p>
            </div>

            {error ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#00856A] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Criando conta…' : 'Cadastrar'}
            </button>

            <p className="text-center text-sm text-[#5c6b7a]">
              Já tem conta?{' '}
              <Link href="/login" className="font-semibold text-[#00856A] hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0B2030] text-white">Carregando…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
