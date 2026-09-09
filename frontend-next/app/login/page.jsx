'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { BrandWordmark } from '@/components/brand/BrandLogo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const convite = searchParams.get('convite');
  const { signIn, booting, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (convite) {
      router.replace(`/register?convite=${encodeURIComponent(convite)}`);
    }
  }, [convite, router]);

  useEffect(() => {
    if (!booting && isAuthenticated) router.replace('/');
  }, [booting, isAuthenticated, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B2030] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-[#15202b]">
        <div className="mb-8 flex flex-col items-center gap-4 rounded-[14px] bg-[#0B2030] px-6 py-4">
          <BrandWordmark />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#0B2030] dark:text-white">Bem-vindo de volta</h1>
            <p className="mt-1 text-sm text-[#5c6b7a]">Faça login para acessar sua conta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#0B2030] dark:text-white">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#e8edf2] px-3 py-2.5 text-sm focus:border-[#00856A] focus:outline-none focus:ring-2 focus:ring-[#00856A]/20 dark:border-[#243040] dark:bg-[#0f1720] dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#0B2030] dark:text-white">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#e8edf2] px-3 py-2.5 pr-10 text-sm focus:border-[#00856A] focus:outline-none focus:ring-2 focus:ring-[#00856A]/20 dark:border-[#243040] dark:bg-[#0f1720] dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#5c6b7a] hover:bg-[#f5f7fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00856A]"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link href="/forgot" className="text-sm font-medium text-[#00856A] hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading || booting}
            className="w-full rounded-xl bg-[#00856A] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#5c6b7a]">
          Ainda não tem conta?{' '}
          <Link href="/register" className="font-semibold text-[#00856A] hover:underline">
            Cadastre-se
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-[#5c6b7a]">
          Ao clicar em Entrar, você concorda com nossa Política de Privacidade.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0B2030] text-white">Carregando…</div>}>
      <LoginForm />
    </Suspense>
  );
}
