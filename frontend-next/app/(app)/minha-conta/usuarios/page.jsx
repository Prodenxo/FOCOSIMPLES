'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Search, UserX, UserCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { hasRole } from '@/lib/authRoles';
import {
  banUser,
  createUser,
  listEmpresas,
  listUsers,
  unbanUser,
  updateUser,
} from '@/lib/userManagement';
import {
  createInvite,
  listPendingInvites,
  revokeInvite,
} from '@/lib/invitesManagement';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

export default function UsuariosPage() {
  const { role, userId } = useAuth();
  const canManage = hasRole(role, ['admin']);
  const isSuperadmin = role === 'superadmin';

  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);
  const [msg, setMsg] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'usuario',
    empresaId: '',
    mei: false,
  });
  const [confirmBan, setConfirmBan] = useState(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const [userList, inviteList, empresaList] = await Promise.all([
        listUsers(search),
        listPendingInvites(isSuperadmin ? {} : undefined),
        isSuperadmin ? listEmpresas() : Promise.resolve([]),
      ]);
      setUsers(userList);
      setInvites(inviteList);
      setEmpresas(empresaList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, [canManage, search, isSuperadmin]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setActing('create');
    setMsg(null);
    try {
      const result = await createUser(createForm);
      setMsg({
        type: 'success',
        text: result?.generatedPassword
          ? `Usuário criado. Senha gerada: ${result.generatedPassword}`
          : 'Usuário criado.',
      });
      setShowCreate(false);
      setCreateForm({
        email: '',
        displayName: '',
        password: '',
        role: 'usuario',
        empresaId: '',
        mei: false,
      });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao criar usuário.' });
    } finally {
      setActing(null);
    }
  };

  const handleBanToggle = async (user) => {
    setActing(user.id);
    setMsg(null);
    try {
      if (user.status === false) {
        await unbanUser(user.id);
        setMsg({ type: 'success', text: 'Usuário desbloqueado.' });
      } else {
        await banUser(user.id);
        setMsg({ type: 'success', text: 'Usuário bloqueado.' });
      }
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha na operação.' });
    } finally {
      setActing(null);
      setConfirmBan(null);
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    setActing(inviteId);
    try {
      await revokeInvite(inviteId);
      setMsg({ type: 'success', text: 'Convite revogado.' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao revogar convite.' });
    } finally {
      setActing(null);
    }
  };

  const handleNewInvite = async () => {
    setActing('invite');
    try {
      const body = isSuperadmin && createForm.empresaId ? { empresas_id: createForm.empresaId } : {};
      const result = await createInvite(body);
      setMsg({ type: 'success', text: `Convite criado: ${result?.inviteUrl || 'link gerado'}` });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao criar convite.' });
    } finally {
      setActing(null);
    }
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl">
        <BackLink />
        <Card className="mt-4 p-6">
          <EmptyPanel title="Acesso restrito" description="Somente administradores podem gerenciar usuários." />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 pb-6">
      <BackLink />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gerenciar usuários</h1>
          <p className="text-sm text-[var(--text-muted)]">Convites, papéis e bloqueios</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Novo usuário
          </button>
          <button
            type="button"
            onClick={handleNewInvite}
            disabled={acting === 'invite'}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] px-4 text-sm font-semibold"
          >
            {acting === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Gerar convite
          </button>
        </div>
      </div>

      {msg ? (
        <div className={`rounded-[12px] border p-3 text-sm ${msg.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {msg.text}
        </div>
      ) : null}

      <div className="flex gap-2">
        {['users', 'invites'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === key ? 'bg-[var(--accent)] text-white' : 'bg-[var(--canvas)] text-[var(--text-muted)]'}`}
          >
            {key === 'users' ? 'Usuários' : 'Convites pendentes'}
          </button>
        ))}
      </div>

      {tab === 'users' ? (
        <Card className="p-4 sm:p-5">
          <label className="mb-4 flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Buscar por nome ou e-mail"
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </label>
          {loading ? <LoadingPanel label="Carregando usuários…" /> : error ? (
            <ErrorPanel message={error} onRetry={load} />
          ) : users.length === 0 ? (
            <EmptyPanel title="Nenhum usuário" description="Ajuste a busca ou crie um novo usuário." />
          ) : (
            <ul className="divide-y divide-[var(--card-border)]">
              {users.map((u) => (
                <li key={u.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{u.displayName || u.email}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {u.email} · {u.role}
                      {u.status === false ? ' · bloqueado' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {u.id !== userId && u.role !== 'superadmin' ? (
                      <button
                        type="button"
                        disabled={acting === u.id}
                        onClick={() => (u.status === false ? handleBanToggle(u) : setConfirmBan(u))}
                        className="inline-flex h-8 items-center gap-1 rounded-[10px] border px-2 text-xs font-semibold"
                      >
                        {u.status === false ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                        {u.status === false ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    ) : null}
                    {isSuperadmin && u.id !== userId && u.role !== 'superadmin' ? (
                      <select
                        value={u.role || 'usuario'}
                        onChange={async (e) => {
                          setActing(u.id);
                          try {
                            await updateUser(u.id, { role: e.target.value });
                            await load();
                          } catch (err) {
                            setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha.' });
                          } finally {
                            setActing(null);
                          }
                        }}
                        className="h-8 rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-2 text-xs"
                      >
                        <option value="usuario">Usuário</option>
                        <option value="admin">Admin</option>
                        <option value="outsider">Outsider</option>
                      </select>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="p-4 sm:p-5">
          {loading ? <LoadingPanel label="Carregando convites…" /> : invites.length === 0 ? (
            <EmptyPanel title="Nenhum convite pendente" />
          ) : (
            <ul className="divide-y divide-[var(--card-border)]">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{inv.invited_email || 'Convite reutilizável'}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Expira {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={acting === inv.id}
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="text-xs font-semibold text-red-600"
                  >
                    Revogar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Novo usuário</h3>
            <div className="mt-4 space-y-3">
              <input placeholder="E-mail" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="h-10 w-full rounded-[12px] border px-3 text-sm" />
              <input placeholder="Nome" value={createForm.displayName} onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })} className="h-10 w-full rounded-[12px] border px-3 text-sm" />
              <input placeholder="Senha (opcional)" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="h-10 w-full rounded-[12px] border px-3 text-sm" />
              {isSuperadmin ? (
                <>
                  <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} className="h-10 w-full rounded-[12px] border px-3 text-sm">
                    <option value="usuario">Usuário</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select value={createForm.empresaId} onChange={(e) => setCreateForm({ ...createForm, empresaId: e.target.value })} className="h-10 w-full rounded-[12px] border px-3 text-sm">
                    <option value="">Empresa</option>
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>{e.empresa}</option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="h-9 rounded-[10px] border px-3 text-xs font-semibold">Cancelar</button>
              <button type="button" onClick={handleCreate} disabled={acting === 'create'} className="h-9 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white">
                {acting === 'create' ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmBan)}
        title="Bloquear usuário?"
        message={`Deseja bloquear ${confirmBan?.displayName || confirmBan?.email}?`}
        confirmLabel="Bloquear"
        onConfirm={() => handleBanToggle(confirmBan)}
        onCancel={() => setConfirmBan(null)}
        loading={acting === confirmBan?.id}
        destructive
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/minha-conta" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
      <ArrowLeft className="h-4 w-4" /> Voltar às configurações
    </Link>
  );
}
