'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Calendar,
  Headphones,
  MessageCircle,
  Palette,
  Shield,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { hasRole } from '@/lib/authRoles';
import {
  getBrazilPhoneValidationError,
  normalizePhoneDigits,
  phonesMatch,
} from '@/lib/internationalPhone';
import { updateEmail } from '@/lib/profileApi';
import {
  captureGoogleCalendarOAuthReturn,
  checkGoogleAuth,
  consumeGoogleCalendarOAuthReturn,
  disconnectGoogleAuth,
  startGoogleAuthFlow,
} from '@/lib/googleCalendarService';
import { openExternalUrl, SUPPORT_GROUP_URL, SUPPORT_WHATSAPP_URL } from '@/lib/supportLinks';
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH, openLegalDocument } from '@/lib/legalUrls';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { SettingsActionLink } from '@/components/settings/SettingsActionLink';
import { SettingsProfileField } from '@/components/settings/SettingsProfileField';
import { SettingsPhoneField } from '@/components/settings/SettingsPhoneField';
import { ThemeAppearancePicker } from '@/components/settings/ThemeAppearancePicker';
import { OpenaiUsageModal } from '@/components/settings/OpenaiUsageModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function MinhaContaPage() {
  const {
    displayName,
    email,
    phone,
    role,
    updateDisplayName,
    updatePhone,
  } = useAuth();

  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleChecking, setGoogleChecking] = useState(true);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    setNameInput(displayName || '');
  }, [displayName]);

  useEffect(() => {
    setPhoneInput(phone || '');
  }, [phone]);

  useEffect(() => {
    setEmailInput(email || '');
  }, [email]);

  const refreshGoogle = useCallback(async () => {
    setGoogleChecking(true);
    try {
      setGoogleConnected(await checkGoogleAuth());
    } catch {
      setGoogleConnected(false);
    } finally {
      setGoogleChecking(false);
    }
  }, []);

  useEffect(() => {
    captureGoogleCalendarOAuthReturn();
    const status = consumeGoogleCalendarOAuthReturn();
    if (status === 'connected') {
      setActionMsg({ type: 'success', text: 'Google Agenda conectada com sucesso.' });
    } else if (status === 'error') {
      setActionMsg({ type: 'error', text: 'Não foi possível conectar o Google Calendar.' });
    }
    refreshGoogle();
  }, [refreshGoogle]);

  const emailHint = useMemo(() => {
    const trimmed = emailInput.trim().toLowerCase();
    const current = (email || '').trim().toLowerCase();
    if (!trimmed || trimmed === current) return '';
    return `Ao salvar, enviaremos um link de confirmação para ${emailInput.trim()}. O e-mail só passa a valer após você clicar no link.`;
  }, [emailInput, email]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setActionMsg({ type: 'error', text: 'Informe um nome válido.' });
      return;
    }
    setSavingName(true);
    setActionMsg(null);
    try {
      await updateDisplayName(trimmed);
      setActionMsg({ type: 'success', text: 'Nome atualizado.' });
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao salvar nome.',
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleSavePhone = async () => {
    const digits = normalizePhoneDigits(phoneInput);
    if (!digits || digits.length < 10) {
      setActionMsg({ type: 'error', text: 'Informe um telefone válido.' });
      return;
    }
    const brError = getBrazilPhoneValidationError(digits);
    if (brError) {
      setActionMsg({ type: 'error', text: brError });
      return;
    }
    setSavingPhone(true);
    setActionMsg(null);
    try {
      await updatePhone(digits);
      setActionMsg({ type: 'success', text: 'Telefone salvo.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar telefone.';
      setActionMsg({
        type: 'error',
        text: msg.includes('PHONE_ALREADY_LINKED')
          ? 'Este número já está vinculado a outra conta.'
          : msg,
      });
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSaveEmail = async () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setActionMsg({ type: 'error', text: 'E-mail inválido.' });
      return;
    }
    if (trimmed === (email || '').trim().toLowerCase()) {
      setActionMsg({ type: 'error', text: 'Informe um e-mail diferente do atual.' });
      return;
    }
    setSavingEmail(true);
    setActionMsg(null);
    try {
      await updateEmail(trimmed);
      setActionMsg({
        type: 'success',
        text: `Confirmação enviada para ${trimmed}. O e-mail só muda após clicar no link.`,
      });
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao solicitar alteração de e-mail.',
      });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGoogleBusy(true);
    try {
      await startGoogleAuthFlow(`${window.location.origin}/minha-conta`);
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao iniciar conexão com Google.',
      });
      setGoogleBusy(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setGoogleBusy(true);
    try {
      await disconnectGoogleAuth();
      setGoogleConnected(false);
      setActionMsg({ type: 'success', text: 'Google Agenda desconectada.' });
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao desconectar Google.',
      });
    } finally {
      setGoogleBusy(false);
      setDisconnectOpen(false);
    }
  };

  const isAdmin = hasRole(role, ['admin']);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">Configurações</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Perfil, integrações e preferências da sua conta.
        </p>
      </header>

      {actionMsg ? (
        <div
          className={`rounded-[12px] border p-3 text-sm ${
            actionMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200'
          }`}
          role="status"
        >
          {actionMsg.text}
        </div>
      ) : null}

      <SettingsSectionCard icon={User} title="Perfil" description="Atualize seus dados de acesso.">
        <SettingsProfileField
          label="Nome"
          value={nameInput}
          onChange={setNameInput}
          onSave={handleSaveName}
          saving={savingName}
          disabled={nameInput.trim() === (displayName || '').trim()}
          placeholder="Como quer ser chamado no app"
        />
        <SettingsPhoneField
          value={phoneInput}
          onChange={setPhoneInput}
          onSave={handleSavePhone}
          saving={savingPhone}
          disabled={phonesMatch(phoneInput, phone)}
        />
        <SettingsProfileField
          label="E-mail"
          type="email"
          value={emailInput}
          onChange={setEmailInput}
          onSave={handleSaveEmail}
          saving={savingEmail}
          saveLabel="Alterar e-mail"
          savingLabel="Enviando…"
          disabled={!emailInput.trim() || emailInput.trim().toLowerCase() === (email || '').trim().toLowerCase()}
          hint={emailHint}
          placeholder="seu@email.com"
          isLast
        />
      </SettingsSectionCard>

      {isAdmin ? (
        <SettingsSectionCard
          icon={Users}
          title="Equipe e administração"
          description="Gerencie acessos e configurações."
        >
          <SettingsActionLink
            href="/minha-conta/usuarios"
            title="Gerenciar usuários"
            description="Convites, papéis e bloqueios"
            icon={Users}
          />
          <SettingsActionLink
            href="/minha-conta/produtos-fiscais"
            title="Produtos e configuração fiscal"
            description="Configurações por empresa"
            icon={Shield}
          />
          {role === 'superadmin' ? (
            <SettingsActionLink
              href="/minha-conta/solicitacoes"
              title="Solicitações de acesso"
              description="Revise os pedidos de entrada"
              icon={Shield}
            />
          ) : null}
        </SettingsSectionCard>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsSectionCard
          icon={Calendar}
          title="Google Agenda"
          description="Organize pagamentos e compromissos."
        >
          {googleChecking ? (
            <p className="text-sm text-[var(--text-muted)]">Verificando integração…</p>
          ) : googleConnected ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Conectado
              </span>
              <button
                type="button"
                onClick={() => setDisconnectOpen(true)}
                disabled={googleBusy}
                className="text-sm font-semibold text-[var(--accent)] hover:underline disabled:opacity-60"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={googleBusy}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--card-bg)] disabled:opacity-60"
            >
              Conectar com Google
            </button>
          )}
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={Palette}
          title="Aparência"
          description="Escolha como deseja ver o Foco Simples."
        >
          <ThemeAppearancePicker />
        </SettingsSectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {role === 'superadmin' ? (
          <SettingsSectionCard
            icon={Bot}
            title="Consumo de IA"
            description="Acompanhe os custos das suas integrações."
          >
            <p className="mb-3 text-xs text-[var(--text-muted)]">Estimativa em reais · Acesso restrito</p>
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/80"
            >
              Ver painel
            </button>
          </SettingsSectionCard>
        ) : null}

        <SettingsSectionCard
          icon={Headphones}
          title="Suporte"
          description="Ajuda humana e comunidade."
          className={role === 'superadmin' ? '' : 'lg:col-span-2'}
        >
          <SettingsActionLink
            onClick={() => openExternalUrl(SUPPORT_WHATSAPP_URL)}
            title="Fale com o agente"
            description="WhatsApp do seu consultor"
            icon={MessageCircle}
          />
          <SettingsActionLink
            onClick={() => openExternalUrl(SUPPORT_GROUP_URL)}
            title="Grupo de suporte"
            description="Tire dúvidas com outros usuários"
            icon={Users}
          />
        </SettingsSectionCard>
      </div>

      <footer className="flex flex-col gap-2 border-t border-[var(--card-border)] pt-4 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Foco Simples</p>
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => openLegalDocument(LEGAL_PRIVACY_PATH)} className="hover:text-[var(--text-primary)]">
            Política de Privacidade
          </button>
          <button type="button" onClick={() => openLegalDocument(LEGAL_TERMS_PATH)} className="hover:text-[var(--text-primary)]">
            Termos de Uso
          </button>
        </div>
      </footer>

      <OpenaiUsageModal open={aiOpen} onClose={() => setAiOpen(false)} />

      <ConfirmDialog
        open={disconnectOpen}
        title="Desconectar Google Agenda?"
        message="Seus compromissos no app deixam de sincronizar com o Google Calendar. Você pode conectar de novo quando quiser."
        confirmLabel="Desconectar"
        onConfirm={handleDisconnectGoogle}
        onCancel={() => setDisconnectOpen(false)}
        loading={googleBusy}
        destructive
      />
    </div>
  );
}
