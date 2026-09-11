'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { parsePasswordRecoveryFromLocation } from '@/lib/passwordRecoveryUrl';
import { validateStrongPassword } from '@/lib/passwordPolicy';
import { BrandWordmark } from '@/components/brand/BrandLogo';
import { writeLocalAuthSnapshot, buildLocalUser } from '@/lib/authSession';

function ResetPasswordForm() {
  const parsed = useMemo(() => {
    if (typeof window === 'undefined') return { kind: 'loading' };
    return parsePasswordRecoveryFromLocation(window.location.href);
  }, []);

  const [status, setStatus] = useState('validating');
  const [message, setMessage] = useState('Validando link de recuperação…');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (parsed.kind === 'loading') return;
    if (parsed.kind !== 'password_recovery') {
      setStatus('invalid');
      setMessage('Link inválido. Volte ao login e solicite nova recuperação de senha.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let sessionPayload;
        if (parsed.mode === 'token_hash') {
          sessionPayload = await apiClient.postPublic('/auth/verify-recovery-otp', {
            token_hash: parsed.tokenHash,
          });
        } else {
          sessionPayload = await apiClient.postPublic('/auth/process-recovery-hash', {
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
            type: 'recovery',
          });
        }
        const session = sessionPayload?.session ?? sessionPayload;
        const accessToken = session?.access_token;
        const user = session?.user;
        if (!accessToken || !user?.id) throw new Error('Sessão inválida');

        writeLocalAuthSnapshot({
          accessToken,
          user: buildLocalUser({
            id: user.id,
            email: user.email,
            phone: user.user_metadata?.phone,
            displayName: user.user_metadata?.display_name,
          }),
          role: null,
          empresaId: null,
          mei: null,
        });

        if (!cancelled) {
          setStatus('ready');
          setMessage('Defina sua nova senha para concluir a recuperação.');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('invalid');
          setMessage(
            err instanceof Error ? err.message : 'Link expirado ou inválido. Solicite um novo e-mail.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pwd = validateStrongPassword(password);
    if (!pwd.ok) {
      setMessage(pwd.message);
      return;
    }
    if (password !== confirm) {
      setMessage('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/update-password', { newPassword: password });
      setStatus('done');
      setMessage('Senha atualizada. Faça login com a nova senha.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B2030] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-[#15202b]">
        <BrandWordmark className="mx-auto mb-6 h-8" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Redefinir senha</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>

        {status === 'validating' ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
          </div>
        ) : null}

        {status === 'ready' ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--text-muted)]">Nova senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
                autoComplete="new-password"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--text-muted)]">Confirmar senha</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
                autoComplete="new-password"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar nova senha'}
            </button>
          </form>
        ) : null}

        {status === 'done' || status === 'invalid' ? (
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[14px] border border-[var(--accent)] text-sm font-semibold text-[var(--accent)]"
          >
            Ir para login
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Carregando…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
