'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpAZ,
  KeyRound,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { hasRole } from '@/lib/authRoles';
import {
  banUser,
  createUser,
  deleteUser,
  listEmpresas,
  listUsers,
  resetUserPassword,
  unbanUser,
  updateUser,
} from '@/lib/userManagement';
import {
  createInvite,
  listPendingInvites,
  revokeInvite,
} from '@/lib/invitesManagement';
import {
  deleteEmpresa,
  listEmpresasAdmin,
  updateEmpresa,
} from '@/lib/empresaManagement';
import {
  fetchAdminMeiCertificateStatus,
  patchAdminMeiDocumentosAtivos,
} from '@/lib/adminUserApi';
import { normalizePhoneDigits } from '@/lib/internationalPhone';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { Pagination } from '@/components/ui/Pagination';
import { AppSelect } from '@/components/ui/AppSelect';
import { formatCnpj } from '@/lib/fiscalFormat';
import { onlyDigits } from '@/lib/fiscalEmit';
import { getManagedUserActions } from '@/lib/managedUserActions';

const PAGE_SIZE = 10;

const ROLE_OPTIONS = [
  { value: 'usuario', label: 'Usuário' },
  { value: 'admin', label: 'Admin' },
  { value: 'outsider', label: 'Outsider' },
];

const ROLE_OPTIONS_CREATE = ROLE_OPTIONS.filter((r) => r.value !== 'outsider');

function BackLink() {
  return (
    <Link href="/minha-conta" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
      <ArrowLeft className="h-4 w-4" /> Voltar às configurações
    </Link>
  );
}

export function ManageUsersPage() {
  const { role, userId, impersonate, refreshSession } = useAuth();
  const canManage = hasRole(role, ['admin']);
  const isSuperadmin = role === 'superadmin';

  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [empresaSearch, setEmpresaSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);
  const [msg, setMsg] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmpresaId, setInviteEmpresaId] = useState('');
  const [inviteReusable, setInviteReusable] = useState(true);
  const [createForm, setCreateForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'usuario',
    empresaId: '',
    mei: false,
  });

  const [confirmBan, setConfirmBan] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
  const [confirmDeleteEmpresa, setConfirmDeleteEmpresa] = useState(null);
  const [resetPwdUser, setResetPwdUser] = useState(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [impersonateTarget, setImpersonateTarget] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editDocsLoading, setEditDocsLoading] = useState(false);

  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [empresaLimits, setEmpresaLimits] = useState({ max_mei: '', max_usuarios_nao_mei: '' });

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const [userList, inviteList, empresaList] = await Promise.all([
        listUsers(search),
        listPendingInvites(isSuperadmin ? {} : undefined),
        isSuperadmin ? listEmpresasAdmin() : listEmpresas(),
      ]);
      setUsers(userList);
      setInvites(inviteList);
      setEmpresas(empresaList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [canManage, search, isSuperadmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, tab, sortAsc]);

  const blockedCount = useMemo(
    () => users.filter((u) => u.status === false).length,
    [users],
  );

  const sortedUsers = useMemo(() => {
    const list = [...users];
    list.sort((a, b) => {
      const aKey = (a.displayName || a.email || '').toLowerCase();
      const bKey = (b.displayName || b.email || '').toLowerCase();
      if (aKey < bKey) return sortAsc ? -1 : 1;
      if (aKey > bKey) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [users, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, pageSafe]);

  const filteredEmpresas = useMemo(() => {
    const q = empresaSearch.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter((e) => String(e.empresa || '').toLowerCase().includes(q));
  }, [empresas, empresaSearch]);

  const empresaOptions = useMemo(
    () => empresas.map((e) => ({
      value: e.id,
      label: e.nome_fantasia || e.empresa || 'Empresa',
    })),
    [empresas],
  );

  const cnpjFromEmpresaId = useCallback(
    (empresaId) => {
      const emp = empresas.find((e) => e.id === empresaId);
      return emp?.cnpj ? formatCnpj(emp.cnpj) : '';
    },
    [empresas],
  );

  const openEditUser = async (user) => {
    setEditingUser(user);
    setEditForm({
      displayName: user.displayName || '',
      email: user.email || '',
      originalEmail: user.email || '',
      phone: user.phone || '',
      role: user.role || 'usuario',
      empresaId: user.empresaId || '',
      empresaCnpj: cnpjFromEmpresaId(user.empresaId || ''),
      mei: user.mei === true,
      expiresAt: user.expires_at ? String(user.expires_at).slice(0, 10) : '',
      docNfse: true,
      docNfe: false,
      docNfce: false,
    });
    if (user.mei) {
      setEditDocsLoading(true);
      try {
        const status = await fetchAdminMeiCertificateStatus(user.id);
        const docs = status?.documentosAtivos;
        if (docs) {
          setEditForm((f) => ({
            ...f,
            docNfse: Boolean(docs.nfse),
            docNfe: Boolean(docs.nfe),
            docNfce: Boolean(docs.nfce),
          }));
        }
      } catch {
        /* defaults */
      } finally {
        setEditDocsLoading(false);
      }
    }
  };

  const saveEditUser = async () => {
    if (!editingUser) return;
    setActing('edit');
    setMsg(null);
    try {
      const trimmedEmail = String(editForm.email || '').trim().toLowerCase();
      const emailChanged = trimmedEmail && trimmedEmail !== String(editForm.originalEmail || '').trim().toLowerCase();
      if (editForm.mei && !editForm.docNfse && !editForm.docNfe && !editForm.docNfce) {
        throw new Error('Com emissão fiscal, libere ao menos um tipo de nota.');
      }
      if (isSuperadmin && editForm.empresaId && editForm.mei) {
        const cnpjDigits = onlyDigits(editForm.empresaCnpj || '');
        if (cnpjDigits && cnpjDigits.length !== 14) {
          throw new Error('Informe o CNPJ da empresa com 14 dígitos (igual ao certificado).');
        }
      }
      const payload = {
        displayName: editForm.displayName || undefined,
        phone: normalizePhoneDigits(editForm.phone) || undefined,
        mei: editForm.mei === true,
        ...(emailChanged ? { email: trimmedEmail } : {}),
      };
      const isEditingSelf = editingUser.id === userId;
      if (isSuperadmin && !isEditingSelf) {
        payload.role = editForm.role;
        if (editForm.empresaId) payload.empresaId = editForm.empresaId;
        if (editForm.role === 'usuario' && editForm.expiresAt) {
          const d = new Date(editForm.expiresAt);
          if (!Number.isNaN(d.getTime())) payload.expiresAt = d.toISOString();
        }
      }
      if (!isSuperadmin && isEditingSelf && editingUser.role === 'usuario' && editForm.expiresAt) {
        const d = new Date(editForm.expiresAt);
        if (!Number.isNaN(d.getTime())) payload.expiresAt = d.toISOString();
      }
      await updateUser(editingUser.id, payload);
      if (isSuperadmin && editForm.empresaId && editForm.mei) {
        const cnpjDigits = onlyDigits(editForm.empresaCnpj || '');
        const prev = onlyDigits(cnpjFromEmpresaId(editForm.empresaId));
        if (cnpjDigits.length === 14 && cnpjDigits !== prev) {
          await updateEmpresa(editForm.empresaId, { cnpj: cnpjDigits });
        }
      }
      if (editForm.mei) {
        await patchAdminMeiDocumentosAtivos(editingUser.id, {
          nfse: editForm.docNfse,
          nfe: editForm.docNfe,
          nfce: editForm.docNfce,
        });
      }
      setMsg({
        type: 'success',
        text: emailChanged ? 'Usuário atualizado. Confirmação enviada por e-mail se aplicável.' : 'Usuário atualizado.',
      });
      setEditingUser(null);
      if (isEditingSelf) {
        await refreshSession();
      }
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao salvar.' });
    } finally {
      setActing(null);
    }
  };

  const handleBanToggle = async (user) => {
    setActing(user.id);
    setMsg(null);
    try {
      if (user.status === false) await unbanUser(user.id);
      else await banUser(user.id);
      setMsg({ type: 'success', text: user.status === false ? 'Usuário desbloqueado.' : 'Usuário bloqueado.' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha na operação.' });
    } finally {
      setActing(null);
      setConfirmBan(null);
    }
  };

  const handleDeleteUser = async (user) => {
    setActing(user.id);
    try {
      await deleteUser(user.id);
      setMsg({ type: 'success', text: 'Usuário excluído.' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao excluir.' });
    } finally {
      setActing(null);
      setConfirmDeleteUser(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdUser) return;
    setActing('reset');
    try {
      await resetUserPassword(resetPwdUser.id, resetPwdValue || undefined);
      setMsg({ type: 'success', text: 'Senha redefinida.' });
      setResetPwdUser(null);
      setResetPwdValue('');
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao redefinir senha.' });
    } finally {
      setActing(null);
    }
  };

  const handleImpersonate = async () => {
    if (!impersonateTarget?.id) return;
    setActing('impersonate');
    try {
      await impersonate(impersonateTarget.id);
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao acessar como usuário.' });
      setActing(null);
      setImpersonateTarget(null);
    }
  };

  const saveEmpresaLimits = async () => {
    if (!editingEmpresa?.id) return;
    setActing('empresa');
    try {
      await updateEmpresa(editingEmpresa.id, {
        max_mei: empresaLimits.max_mei === '' ? null : Number(empresaLimits.max_mei),
        max_usuarios_nao_mei: empresaLimits.max_usuarios_nao_mei === '' ? null : Number(empresaLimits.max_usuarios_nao_mei),
      });
      setMsg({ type: 'success', text: 'Limites da empresa atualizados.' });
      setEditingEmpresa(null);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao salvar empresa.' });
    } finally {
      setActing(null);
    }
  };

  const handleDeleteEmpresa = async (empresa) => {
    setActing(empresa.id);
    try {
      await deleteEmpresa(empresa.id);
      setMsg({ type: 'success', text: 'Empresa excluída.' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao excluir empresa.' });
    } finally {
      setActing(null);
      setConfirmDeleteEmpresa(null);
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

  const tabs = [
    { key: 'users', label: 'Usuários' },
    { key: 'invites', label: 'Convites' },
    ...(isSuperadmin ? [{ key: 'empresas', label: 'Empresas' }] : []),
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-8">
      <BackLink />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gerenciar usuários</h1>
          <p className="text-sm text-[var(--text-muted)]">Convites, papéis, empresas e acesso</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Novo usuário
          </button>
          <button
            type="button"
            onClick={() => {
              setInviteEmpresaId((prev) => prev || empresas[0]?.id || '');
              setShowInviteModal(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] px-4 text-sm font-semibold"
          >
            Gerar convite
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-[var(--text-muted)]">Usuários</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{users.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-muted)]">Bloqueados</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{blockedCount}</p>
        </Card>
        {isSuperadmin ? (
          <Card className="p-4">
            <p className="text-xs text-[var(--text-muted)]">Empresas</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{empresas.length}</p>
          </Card>
        ) : null}
      </div>

      {msg ? (
        <div className={`rounded-[12px] border p-3 text-sm ${msg.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'}`}>
          {msg.text}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t.key ? 'bg-[var(--accent)] text-white' : 'bg-[var(--canvas)] text-[var(--text-muted)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' ? (
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex h-10 flex-1 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="Buscar por nome ou e-mail"
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] px-3 text-xs font-semibold"
            >
              {sortAsc ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
              Nome
            </button>
          </div>
          {loading ? <LoadingPanel label="Carregando usuários…" /> : error ? (
            <ErrorPanel message={error} onRetry={load} />
          ) : paginatedUsers.length === 0 ? (
            <EmptyPanel title="Nenhum usuário" />
          ) : (
            <>
              <ul className="divide-y divide-[var(--card-border)]">
                {paginatedUsers.map((u) => {
                  const actions = getManagedUserActions(role, u, userId);
                  const isSelf = u.id === userId;
                  return (
                  <li key={u.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {u.displayName || u.email}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">(você)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {u.email} · {u.role}
                        {u.mei ? ' · fiscal' : ''}
                        {u.status === false ? ' · bloqueado' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {actions.canEdit ? (
                        <IconBtn label="Editar" onClick={() => openEditUser(u)} icon={Pencil} />
                      ) : null}
                      {actions.canImpersonate ? (
                        <IconBtn label="Acessar como" onClick={() => setImpersonateTarget(u)} icon={LogIn} />
                      ) : null}
                      {actions.canEdit && !isSelf ? (
                        <IconBtn label="Redefinir senha" onClick={() => setResetPwdUser(u)} icon={KeyRound} />
                      ) : null}
                      {actions.canBan ? (
                        <IconBtn
                          label={u.status === false ? 'Desbloquear' : 'Bloquear'}
                          onClick={() => (u.status === false ? handleBanToggle(u) : setConfirmBan(u))}
                          icon={u.status === false ? UserCheck : UserX}
                          disabled={acting === u.id}
                        />
                      ) : null}
                      {actions.canDelete && isSuperadmin ? (
                        <IconBtn label="Excluir" onClick={() => setConfirmDeleteUser(u)} icon={Trash2} destructive />
                      ) : null}
                    </div>
                  </li>
                  );
                })}
              </ul>
              <Pagination
                page={pageSafe}
                totalPages={totalPages}
                total={sortedUsers.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      ) : null}

      {tab === 'invites' ? (
        <Card className="p-4 sm:p-5">
          {loading ? <LoadingPanel label="Carregando convites…" /> : invites.length === 0 ? (
            <EmptyPanel title="Nenhum convite pendente" />
          ) : (
            <ul className="divide-y divide-[var(--card-border)]">
              {invites.map((inv) => {
                const empresaLabel = inv.empresas_id
                  ? empresas.find((e) => e.id === inv.empresas_id)?.empresa
                  : null;
                return (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{inv.invited_email || 'Convite reutilizável'}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {empresaLabel ? `${empresaLabel} · ` : ''}
                      Expira {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={acting === inv.id}
                    onClick={async () => {
                      setActing(inv.id);
                      try {
                        await revokeInvite(inv.id);
                        await load();
                      } finally {
                        setActing(null);
                      }
                    }}
                    className="text-xs font-semibold text-red-600"
                  >
                    Revogar
                  </button>
                </li>
              );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'empresas' && isSuperadmin ? (
        <Card className="p-4 sm:p-5">
          <label className="mb-4 flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={empresaSearch}
              onChange={(e) => setEmpresaSearch(e.target.value)}
              placeholder="Buscar empresa"
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </label>
          {filteredEmpresas.length === 0 ? (
            <EmptyPanel title="Nenhuma empresa" />
          ) : (
            <ul className="divide-y divide-[var(--card-border)]">
              {filteredEmpresas.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{e.empresa}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      MEI max {e.max_mei ?? '—'} · PF max {e.max_usuarios_nao_mei ?? '—'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-[10px] border px-2 py-1 text-xs font-semibold"
                      onClick={() => {
                        setEditingEmpresa(e);
                        setEmpresaLimits({
                          max_mei: e.max_mei ?? '',
                          max_usuarios_nao_mei: e.max_usuarios_nao_mei ?? '',
                        });
                      }}
                    >
                      Limites
                    </button>
                    <button
                      type="button"
                      className="rounded-[10px] border border-red-200 px-2 py-1 text-xs font-semibold text-red-600"
                      onClick={() => setConfirmDeleteEmpresa(e)}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {showInviteModal ? (
        <ModalShell title="Gerar convite" onClose={() => setShowInviteModal(false)}>
          {isSuperadmin ? (
            <AppSelect
              label="Empresa"
              value={inviteEmpresaId}
              onChange={setInviteEmpresaId}
              options={empresaOptions}
              placeholder="Selecione a empresa"
              emptyHint="Nenhuma empresa encontrada"
            />
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inviteReusable}
              onChange={(e) => setInviteReusable(e.target.checked)}
            />
            Link reutilizável (vários cadastros)
          </label>
          <ModalActions
            onCancel={() => setShowInviteModal(false)}
            onConfirm={async () => {
              if (isSuperadmin && !inviteEmpresaId) {
                setMsg({ type: 'error', text: 'Selecione a empresa para gerar o convite.' });
                return;
              }
              setActing('invite');
              setMsg(null);
              try {
                const body = {
                  is_reusable: inviteReusable,
                  ...(isSuperadmin ? { empresas_id: inviteEmpresaId } : {}),
                };
                const result = await createInvite(body);
                setMsg({
                  type: 'success',
                  text: result?.inviteUrl
                    ? `Convite gerado: ${result.inviteUrl}`
                    : 'Convite gerado com sucesso.',
                });
                setShowInviteModal(false);
                setTab('invites');
                await load();
              } catch (err) {
                setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao criar convite.' });
              } finally {
                setActing(null);
              }
            }}
            confirmLabel={acting === 'invite' ? 'Gerando…' : 'Gerar link'}
            disabled={acting === 'invite'}
          />
        </ModalShell>
      ) : null}

      {showCreate ? (
        <ModalShell title="Novo usuário" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            <input placeholder="E-mail" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" />
            <input placeholder="Nome" value={createForm.displayName} onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })} className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" />
            <input placeholder="Senha (opcional)" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={createForm.mei} onChange={(e) => setCreateForm({ ...createForm, mei: e.target.checked })} />
              Emissão fiscal (MEI)
            </label>
            {isSuperadmin ? (
              <>
                <AppSelect
                  label="Papel"
                  value={createForm.role}
                  onChange={(role) => setCreateForm({ ...createForm, role })}
                  options={ROLE_OPTIONS_CREATE}
                  placeholder="Papel do usuário"
                />
                <AppSelect
                  label="Empresa"
                  value={createForm.empresaId}
                  onChange={(empresaId) => setCreateForm({ ...createForm, empresaId })}
                  options={empresaOptions}
                  placeholder="Vincular à empresa"
                />
              </>
            ) : null}
          </div>
          <ModalActions
            onCancel={() => setShowCreate(false)}
            onConfirm={async () => {
              setActing('create');
              try {
                const result = await createUser(createForm);
                setMsg({
                  type: 'success',
                  text: result?.generatedPassword ? `Criado. Senha: ${result.generatedPassword}` : 'Usuário criado.',
                });
                setShowCreate(false);
                await load();
              } catch (err) {
                setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao criar.' });
              } finally {
                setActing(null);
              }
            }}
            confirmLabel={acting === 'create' ? 'Criando…' : 'Criar'}
            disabled={acting === 'create'}
          />
        </ModalShell>
      ) : null}

      {editingUser ? (
        <ModalShell title="Editar usuário" onClose={() => setEditingUser(null)}>
          <div className="space-y-3">
            <input className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" placeholder="Nome" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
            <input className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" placeholder="E-mail" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            <input className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" placeholder="Telefone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            {isSuperadmin && editingUser.id !== userId ? (
              <>
                <AppSelect
                  label="Papel"
                  value={editForm.role}
                  onChange={(role) => setEditForm({ ...editForm, role })}
                  options={ROLE_OPTIONS}
                  placeholder="Papel"
                />
                <AppSelect
                  label="Empresa"
                  value={editForm.empresaId}
                  onChange={(empresaId) => setEditForm({
                    ...editForm,
                    empresaId,
                    empresaCnpj: cnpjFromEmpresaId(empresaId),
                  })}
                  options={empresaOptions}
                  placeholder="Empresa"
                />
                {editForm.mei && editForm.empresaId ? (
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
                      CNPJ da empresa
                    </span>
                    <input
                      className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm"
                      placeholder="00.000.000/0000-00"
                      value={editForm.empresaCnpj || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        empresaCnpj: formatCnpj(e.target.value),
                      })}
                      inputMode="numeric"
                    />
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">
                      Deve ser o mesmo CNPJ do certificado e-CNPJ (evita erro no DAS).
                    </span>
                  </label>
                ) : null}
                {editForm.role === 'usuario' ? (
                  <input type="date" className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" value={editForm.expiresAt} onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })} />
                ) : null}
              </>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={editForm.mei} onChange={(e) => setEditForm({ ...editForm, mei: e.target.checked })} />
                Habilitar notas (emissão fiscal)
              </span>
              {editingUser.id === userId ? (
                <span className="text-xs text-[var(--text-muted)]">
                  {editForm.mei
                    ? 'Com isto ligado, a aba Notas aparece no menu.'
                    : 'Ligue para liberar NFS-e, NF-e e NFC-e na sua conta.'}
                </span>
              ) : null}
            </label>
            {editForm.mei ? (
              <div className="space-y-1 text-sm">
                {editDocsLoading ? <p className="text-[var(--text-muted)]">Carregando tipos de nota…</p> : null}
                <label className="flex gap-2"><input type="checkbox" checked={editForm.docNfse} onChange={(e) => setEditForm({ ...editForm, docNfse: e.target.checked })} /> NFS-e</label>
                <label className="flex gap-2"><input type="checkbox" checked={editForm.docNfe} onChange={(e) => setEditForm({ ...editForm, docNfe: e.target.checked })} /> NF-e</label>
                <label className="flex gap-2"><input type="checkbox" checked={editForm.docNfce} onChange={(e) => setEditForm({ ...editForm, docNfce: e.target.checked })} /> NFC-e</label>
              </div>
            ) : null}
          </div>
          <ModalActions onCancel={() => setEditingUser(null)} onConfirm={saveEditUser} confirmLabel={acting === 'edit' ? 'Salvando…' : 'Salvar'} disabled={acting === 'edit'} />
        </ModalShell>
      ) : null}

      {editingEmpresa ? (
        <ModalShell title={`Limites — ${editingEmpresa.empresa}`} onClose={() => setEditingEmpresa(null)}>
          <div className="space-y-3">
            <input className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" type="number" placeholder="Max MEI" value={empresaLimits.max_mei} onChange={(e) => setEmpresaLimits({ ...empresaLimits, max_mei: e.target.value })} />
            <input className="h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" type="number" placeholder="Max usuários PF" value={empresaLimits.max_usuarios_nao_mei} onChange={(e) => setEmpresaLimits({ ...empresaLimits, max_usuarios_nao_mei: e.target.value })} />
          </div>
          <ModalActions onCancel={() => setEditingEmpresa(null)} onConfirm={saveEmpresaLimits} confirmLabel="Salvar" disabled={acting === 'empresa'} />
        </ModalShell>
      ) : null}

      {resetPwdUser ? (
        <ModalShell title="Redefinir senha" onClose={() => setResetPwdUser(null)}>
          <p className="text-sm text-[var(--text-muted)]">{resetPwdUser.displayName || resetPwdUser.email}</p>
          <input className="field mt-2" type="password" placeholder="Nova senha (vazio = gerar)" value={resetPwdValue} onChange={(e) => setResetPwdValue(e.target.value)} />
          <ModalActions onCancel={() => setResetPwdUser(null)} onConfirm={handleResetPassword} confirmLabel="Redefinir" disabled={acting === 'reset'} />
        </ModalShell>
      ) : null}

      <ConfirmDialog open={Boolean(confirmBan)} title="Bloquear usuário?" message={`Bloquear ${confirmBan?.displayName || confirmBan?.email}?`} confirmLabel="Bloquear" onConfirm={() => handleBanToggle(confirmBan)} onCancel={() => setConfirmBan(null)} loading={acting === confirmBan?.id} destructive />
      <ConfirmDialog open={Boolean(confirmDeleteUser)} title="Excluir usuário?" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" onConfirm={() => handleDeleteUser(confirmDeleteUser)} onCancel={() => setConfirmDeleteUser(null)} loading={acting === confirmDeleteUser?.id} destructive />
      <ConfirmDialog open={Boolean(confirmDeleteEmpresa)} title="Excluir empresa?" message={`Excluir ${confirmDeleteEmpresa?.empresa}?`} confirmLabel="Excluir" onConfirm={() => handleDeleteEmpresa(confirmDeleteEmpresa)} onCancel={() => setConfirmDeleteEmpresa(null)} loading={acting === confirmDeleteEmpresa?.id} destructive />
      <ConfirmDialog open={Boolean(impersonateTarget)} title="Acessar como usuário?" message={`Entrar na conta de ${impersonateTarget?.displayName || impersonateTarget?.email}?`} confirmLabel="Acessar" onConfirm={handleImpersonate} onCancel={() => setImpersonateTarget(null)} loading={acting === 'impersonate'} />
    </div>
  );
}

function IconBtn({ label, onClick, icon: Icon, disabled, destructive }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] border ${destructive ? 'border-red-200 text-red-600' : 'border-[var(--card-border)] text-[var(--text-primary)]'} disabled:opacity-50`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-visible rounded-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, disabled }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="h-9 rounded-[10px] border px-3 text-xs font-semibold">Cancelar</button>
      <button type="button" onClick={onConfirm} disabled={disabled} className="h-9 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white disabled:opacity-50">{confirmLabel}</button>
    </div>
  );
}
