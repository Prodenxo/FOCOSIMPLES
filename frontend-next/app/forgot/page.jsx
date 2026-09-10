'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { BrandWordmark } from '@/components/brand/BrandLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Informe seu e-mail.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.postPublic('/auth/reset-password', { email: email.trim().toLowerCase() });
      setSuccess('Link de recuperação enviado! Verifique seu e-mail.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B2030] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <BrandWordmark />
          <h1 className="text-xl font-bold text-[#0B2030]">Recuperar senha</h1>
          <p className="text-center text-sm text-[#5c6b7a]">
            Digite seu e-mail para receber o link de recuperação.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[#e8edf2] px-3 py-2.5 text-sm"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-[#00856A]">{success}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#00856A] py-3 text-sm font-semibold text-white"
          >
            {loading ? 'Enviando…' : 'Enviar link'}
          </button>
        </form>
        <Link href="/login" className="mt-6 block text-center text-sm font-medium text-[#00856A]">
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
