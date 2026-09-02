import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { presentDownloadedFile } from '../lib/platformDownload';
import { useThemeStore } from '../store/themeStore';
import { getTheme } from '../lib/theme';
import { hasRole } from '../lib/auth-roles';
import { listUsers, type ManagedUser } from '../lib/user-management';
import { alertDialog, confirmDialog } from '../lib/confirmDialog';
import { UserPicker } from '../components/admin/UserPicker';
import { UserContextHeader } from '../components/admin/UserContextHeader';
import { KpiCard } from '../components/admin/KpiCard';
import { EmptyState } from '../components/admin/EmptyState';
import { SectionTabs } from '../components/admin/SectionTabs';
import {
  fetchAdminUserTransactions,
  fetchAdminUserCategories,
  fetchAdminUserBudgetSummary,
  fetchAdminUserBalance,
  fetchAdminDasStatus,
  reprocessAdminDas,
  fetchAdminMeiCertificateStatus,
  fetchAdminMeiPeriods,
  downloadAdminMeiGuide,
  sendAdminMeiGuideWhatsapp,
  fetchAdminParcelamentos,
  fetchAdminNotas,
  downloadAdminParcelamentoPdf,
  emitirNotaAsAdmin,
  fetchAdminNfsePrestadorPrefill,
  type AdminBalance,
  type AdminDasPendingSummary,
  type AdminMeiPeriod,
  type AdminMeiCertificateStatus,
  type AdminParcelamentoItem,
  type AdminNfseRecord,
} from '../services/adminUserDataService';
import { formatNfseStatus } from '../lib/meiFormatters';
import { getNfseValidationMessage } from '../lib/meiNfseForms';
import {
  applyAdminPrestadorPrefill,
  emptyAdminNfseEmitirForm,
  formatPrestadorEnderecoResumoForAdmin,
} from '../lib/adminNfsePrestadorForm';
import type { EmitirNfseInput } from '../services/meiNotasService';
import { useAuthStore } from '../store/authStore';
import { formatCurrencyBR } from '../lib/numberFormat';

const normalizeDoc = (value: string) => value.replace(/\D/g, '');
const formatDocument = (value: string) => {
  const d = normalizeDoc(value);
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

interface Props {
  onBack: () => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const getCertificadoLabel = (status: AdminMeiCertificateStatus | null): string => {
  if (!status) return 'Indisponível';
  if (status.hasUserCertificate) return 'Cliente';
  if (status.hasEnvCertificate) return 'Servidor';
  return 'Indisponível';
};

const getValidadeText = (status: AdminMeiCertificateStatus | null): string | null => {
  if (!status) return null;
  const from = status.certValidFrom ?? status.validade ?? null;
  const to = status.certValidTo ?? status.validUntil ?? null;
  if (from && to) return `Válido de ${formatDate(from)} até ${formatDate(to)}`;
  if (to) return `Válido até ${formatDate(to)}`;
  if (from) return `Válido de ${formatDate(from)}`;
  return null;
};

export default function AdminUserDataScreen({ onBack }: Props) {
  const { role, empresaId } = useAuthStore();
  const canView = hasRole(role, ['admin']);
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const selectedUserIdRef = useRef('');
  selectedUserIdRef.current = selectedUserId;
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<any[]>([]);
  const [balance, setBalance] = useState<AdminBalance | null>(null);
  const [dasSummary, setDasSummary] = useState<AdminDasPendingSummary | null>(null);
  const [meiPeriods, setMeiPeriods] = useState<AdminMeiPeriod[]>([]);
  const [meiCertStatus, setMeiCertStatus] = useState<AdminMeiCertificateStatus | null>(null);
  const meiCertStatusRef = useRef<AdminMeiCertificateStatus | null>(null);
  meiCertStatusRef.current = meiCertStatus;
  const [meiLoading, setMeiLoading] = useState(false);
  const [parcelamentos, setParcelamentos] = useState<AdminParcelamentoItem[]>([]);
  const [parcelamentosLoading, setParcelamentosLoading] = useState(false);
  const [parcelamentosUnavailable, setParcelamentosUnavailable] = useState(false);
  const [notas, setNotas] = useState<AdminNfseRecord[]>([]);
  const [notasLoading, setNotasLoading] = useState(false);
  const [notasUnavailable, setNotasUnavailable] = useState(false);
  const [parcelamentoPdfLoadingNumero, setParcelamentoPdfLoadingNumero] = useState<string | null>(null);
  const [emitirNotaVisible, setEmitirNotaVisible] = useState(false);
  const [emitirNotaLoading, setEmitirNotaLoading] = useState(false);
  const [emitirNotaError, setEmitirNotaError] = useState<string | null>(null);
  const [nfseForm, setNfseForm] = useState<EmitirNfseInput>(() => emptyAdminNfseEmitirForm());
  const [nfseAdminPrefillLoading, setNfseAdminPrefillLoading] = useState(false);
  const [dasCompetencia] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'financeiro' | 'fiscal'>('financeiro');
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 900;

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      if (c?.id != null && c?.nome) map.set(String(c.id), String(c.nome));
    }
    return map;
  }, [categories]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const certificadoLabel = getCertificadoLabel(meiCertStatus);
  const validadeLabel = getValidadeText(meiCertStatus);
  const isMeiUser = Boolean(meiCertStatus?.documento);

  useEffect(() => {
    if (!canView) return;
    setLoadingUsers(true);
    setError('');
    listUsers()
      .then((data) => {
        const list = role === 'admin' && empresaId ? (data || []).filter((u) => u.empresaId === empresaId) : data || [];
        setUsers(list);
        if (list.length > 0 && !selectedUserId) setSelectedUserId(list[0].id);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro ao carregar usuários'))
      .finally(() => setLoadingUsers(false));
  }, [canView, role, empresaId]);

  const loadUserData = useCallback(async (userId: string) => {
    setLoadingData(true);
    try {
      const [tx, cat, bal, sum] = await Promise.all([
        fetchAdminUserTransactions(userId),
        fetchAdminUserCategories(userId),
        fetchAdminUserBalance(userId),
        fetchAdminUserBudgetSummary(userId, { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }),
      ]);
      setTransactions(Array.isArray(tx) ? tx : []);
      setCategories(Array.isArray(cat) ? cat : []);
      setBalance(bal ?? null);
      setBudgetSummary(Array.isArray(sum) ? sum : []);
    } catch {
      setTransactions([]);
      setCategories([]);
      setBalance(null);
      setBudgetSummary([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUserId) loadUserData(selectedUserId);
  }, [selectedUserId, loadUserData]);

  useEffect(() => {
    setEmitirNotaVisible(false);
    setEmitirNotaError(null);
    setNfseAdminPrefillLoading(false);
    setNfseForm(emptyAdminNfseEmitirForm());
  }, [selectedUserId]);

  const loadDas = useCallback(async () => {
    if (!selectedUserId) return;
    try {
      const data = await fetchAdminDasStatus({ competencia: dasCompetencia });
      setDasSummary(data ?? null);
    } catch {
      setDasSummary(null);
    }
  }, [selectedUserId, dasCompetencia]);

  useEffect(() => {
    if (selectedUserId) loadDas();
  }, [selectedUserId, loadDas]);

  const loadMei = useCallback(async () => {
    if (!selectedUserId) return;
    setMeiLoading(true);
    try {
      const [status, periods] = await Promise.all([
        fetchAdminMeiCertificateStatus(selectedUserId),
        fetchAdminMeiPeriods(selectedUserId),
      ]);
      setMeiCertStatus(status ?? null);
      setMeiPeriods(Array.isArray(periods) ? periods : []);
    } catch {
      setMeiCertStatus(null);
      setMeiPeriods([]);
    } finally {
      setMeiLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedUserId) loadMei();
  }, [selectedUserId, loadMei]);

  const loadParcelamentos = useCallback(
    async (cnpj?: string) => {
      if (!selectedUserId) return;
      setParcelamentosLoading(true);
      setParcelamentosUnavailable(false);
      try {
        const res = await fetchAdminParcelamentos(selectedUserId, cnpj);
        setParcelamentos(Array.isArray(res?.parcelamentos) ? res.parcelamentos : []);
      } catch {
        setParcelamentos([]);
        setParcelamentosUnavailable(true);
      } finally {
        setParcelamentosLoading(false);
      }
    },
    [selectedUserId]
  );

  const loadNotas = useCallback(async () => {
    if (!selectedUserId) return;
    setNotasLoading(true);
    setNotasUnavailable(false);
    try {
      const list = await fetchAdminNotas(selectedUserId, { includeArchived: true });
      setNotas(Array.isArray(list) ? list : []);
    } catch {
      setNotas([]);
      setNotasUnavailable(true);
    } finally {
      setNotasLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedUserId) loadParcelamentos(meiCertStatus?.documento ?? undefined);
  }, [selectedUserId, meiCertStatus?.documento, loadParcelamentos]);

  useEffect(() => {
    if (selectedUserId) loadNotas();
  }, [selectedUserId, loadNotas]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedUserId) {
      await loadUserData(selectedUserId);
      await loadDas();
      await loadMei();
      await loadParcelamentos(meiCertStatus?.documento ?? undefined);
      await loadNotas();
    }
    setRefreshing(false);
  };

  const handleReprocessDas = async (userId: string, competencia: string) => {
    setActionLoading('reprocess');
    try {
      await reprocessAdminDas(userId, competencia);
      alertDialog('Sucesso', 'DAS reprocessado.');
      loadDas();
    } catch (e: any) {
      alertDialog('Erro', e?.message || 'Falha ao reprocessar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadMeiGuide = async (userId: string, periodoApuracao: string) => {
    setActionLoading('download-mei');
    try {
      const result = await downloadAdminMeiGuide(userId, periodoApuracao);
      await presentDownloadedFile(result, {
        mimeType: 'application/pdf',
        dialogTitle: 'Guia MEI',
      });
    } catch (e: any) {
      alertDialog('Erro', e?.message || 'Falha ao baixar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendWhatsapp = async (userId: string, periodoApuracao: string) => {
    setActionLoading('whatsapp');
    try {
      const res = await sendAdminMeiGuideWhatsapp(userId, { periodoApuracao });
      alertDialog(res.sent ? 'Sucesso' : 'Atenção', res.sent ? 'Guia enviada pelo WhatsApp.' : 'Falha no envio.');
    } catch (e: any) {
      alertDialog('Erro', e?.message || 'Falha ao enviar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadParcelamentoPdf = async (numero: string, modalidade?: string) => {
    if (!selectedUserId || !numero) return;
    setParcelamentoPdfLoadingNumero(numero);
    try {
      const result = await downloadAdminParcelamentoPdf(selectedUserId, numero, {
        cnpj: meiCertStatus?.documento ?? undefined,
        modalidade: modalidade ?? undefined
      });
      await presentDownloadedFile(result, {
        mimeType: 'application/pdf',
        dialogTitle: 'Parcelamento',
      });
    } catch (e: any) {
      alertDialog('Erro', e?.message || 'PDF do parcelamento não disponível.');
    } finally {
      setParcelamentoPdfLoadingNumero(null);
    }
  };

  const handleEmitirNotaSubmit = async () => {
    if (!selectedUserId) return;
    const prestadorCnpj = normalizeDoc(nfseForm.prestadorCpfCnpj || meiCertStatusRef.current?.documento || '').slice(0, 14);
    const payload: EmitirNfseInput = {
      ...nfseForm,
      prestadorCpfCnpj: prestadorCnpj,
    };
    const err = getNfseValidationMessage(payload, {});
    if (err) {
      setEmitirNotaError(err);
      return;
    }
    setEmitirNotaError(null);
    setEmitirNotaLoading(true);
    try {
      await emitirNotaAsAdmin(selectedUserId, { documentType: 'NFSE', ...payload });
      setEmitirNotaVisible(false);
      setNfseForm(emptyAdminNfseEmitirForm());
      loadNotas();
      alertDialog('Sucesso', 'Nota enviada para emissão.');
    } catch (e: any) {
      setEmitirNotaError(e?.message || 'Falha ao emitir nota.');
    } finally {
      setEmitirNotaLoading(false);
    }
  };

  const openEmitirNotaModal = () => {
    if (!selectedUserId) return;
    const userIdForModal = selectedUserId;
    setEmitirNotaError(null);
    setNfseForm(emptyAdminNfseEmitirForm());
    setEmitirNotaVisible(true);
    setNfseAdminPrefillLoading(true);
    void (async () => {
      try {
        const prefill = await fetchAdminNfsePrestadorPrefill(userIdForModal);
        if (selectedUserIdRef.current !== userIdForModal) return;
        const docAtEnd = meiCertStatusRef.current?.documento ?? null;
        setNfseForm(applyAdminPrestadorPrefill(prefill, docAtEnd));
      } catch (e: unknown) {
        if (selectedUserIdRef.current !== userIdForModal) return;
        const msg = e instanceof Error ? e.message : 'Não foi possível carregar dados do prestador.';
        setEmitirNotaError(msg);
        const docAtEnd = meiCertStatusRef.current?.documento ?? null;
        setNfseForm(
          applyAdminPrestadorPrefill(
            {
              prestadorCpfCnpj: null,
              prestadorRazaoSocial: null,
              prestadorEmail: null,
              prestadorInscricaoMunicipal: null,
              prestadorEndereco: null,
              sourceRowId: null,
            },
            docAtEnd
          )
        );
      } finally {
        if (selectedUserIdRef.current === userIdForModal) {
          setNfseAdminPrefillLoading(false);
        }
      }
    })();
  };

  if (!canView) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Dados do usuário</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Acesso restrito a administradores.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Dados do usuário</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.pickerWrapper}>
          {loadingUsers ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <UserPicker
              users={users}
              selectedUserId={selectedUserId}
              onSelect={setSelectedUserId}
              theme={theme}
            />
          )}
        </View>

        {!selectedUserId ? (
          <EmptyState
            theme={theme}
            icon="people-outline"
            title="Selecione um usuário"
            description="Escolha um usuário acima para visualizar seus dados financeiros e fiscais."
          />
        ) : loadingData ? (
          <View style={styles.centered}><ActivityIndicator size="small" color={theme.primary} /></View>
        ) : (
          <>
            <UserContextHeader
              theme={theme}
              user={selectedUser}
              meiCnpj={meiCertStatus?.documento}
              meiValidityLabel={validadeLabel}
              certificateLabel={isMeiUser ? certificadoLabel : undefined}
            />

            <SectionTabs
              theme={theme}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id)}
              tabs={[
                { id: 'financeiro', label: 'Financeiro', icon: 'wallet-outline' },
                {
                  id: 'fiscal',
                  label: 'Fiscal / MEI',
                  icon: 'document-text-outline',
                  badge: dasSummary?.pendentes ?? null,
                },
              ]}
            />

            {activeTab === 'financeiro' ? (
              <>
                {balance ? (
                  <View style={[styles.kpiGrid, isDesktop && styles.kpiGridDesktop]}>
                    <KpiCard
                      theme={theme}
                      icon="arrow-down-circle-outline"
                      label="Entradas"
                      value={formatCurrencyBR(balance.totalEntradas)}
                      intent="positive"
                    />
                    <KpiCard
                      theme={theme}
                      icon="arrow-up-circle-outline"
                      label="Saídas"
                      value={formatCurrencyBR(balance.totalSaidas)}
                      intent="negative"
                    />
                    <KpiCard
                      theme={theme}
                      icon="wallet-outline"
                      label="Saldo"
                      value={formatCurrencyBR(balance.balance)}
                      intent={balance.balance < 0 ? 'negative' : 'positive'}
                    />
                    <KpiCard
                      theme={theme}
                      icon="list-outline"
                      label="Transações"
                      value={String(transactions.length)}
                      hint="período atual"
                      intent="neutral"
                    />
                  </View>
                ) : (
                  <View style={[styles.kpiGrid, isDesktop && styles.kpiGridDesktop]}>
                    <KpiCard
                      theme={theme}
                      icon="wallet-outline"
                      label="Saldo"
                      value="—"
                      hint="sem dados de balanço"
                      intent="neutral"
                    />
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Transações (últimas 20)</Text>
                  {transactions.length === 0 ? (
                    <EmptyState
                      theme={theme}
                      icon="receipt-outline"
                      title="Nenhuma transação"
                      description="Este usuário ainda não tem lançamentos registrados."
                    />
                  ) : (
                    transactions.slice(0, 20).map((t) => (
                      <View key={t.id} style={styles.row}>
                        <Text style={styles.rowLabel}>{t.classificacao || '-'} • {formatDate(t.data || t.criado_em)}</Text>
                        <Text style={t.tipo === 'entrada' ? styles.entrada : styles.saida}>
                          {formatCurrencyBR(Number(t.valor))}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Categorias</Text>
                  {categories.length === 0 ? (
                    <EmptyState
                      theme={theme}
                      icon="pricetags-outline"
                      title="Nenhuma categoria"
                      description="Nenhuma categoria personalizada cadastrada por este usuário."
                    />
                  ) : (
                    categories.map((c) => (
                      <View key={c.id} style={styles.row}>
                        <Text style={styles.rowLabel}>{c.nome}</Text>
                        <Text style={styles.rowMeta}>{c.tipo}</Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Orçamentos (resumo do mês)</Text>
                  {budgetSummary.length === 0 ? (
                    <EmptyState
                      theme={theme}
                      icon="pie-chart-outline"
                      title="Nenhum orçamento"
                      description="Sem orçamentos configurados para o mês atual."
                    />
                  ) : (
                    budgetSummary.slice(0, 15).map((b, i) => {
                      const catName = categoryNameById.get(String(b.categorias_id)) || `Cat. ${b.categorias_id}`;
                      return (
                        <View key={i} style={styles.row}>
                          <Text style={styles.rowLabel} numberOfLines={1}>{catName}</Text>
                          <Text style={styles.rowMeta}>
                            Orçado: {formatCurrencyBR(b.valor_orcado ?? 0)} • Gasto: {formatCurrencyBR(b.valor_gasto)}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            ) : null}

            {activeTab === 'fiscal' ? (
              !isMeiUser ? (
                <EmptyState
                  theme={theme}
                  icon="business-outline"
                  title="Este usuário não é MEI"
                  description="Não há certificado digital ou dados fiscais associados a este usuário."
                  variant="info"
                />
              ) : (
                <>
                  <View style={[styles.kpiGrid, isDesktop && styles.kpiGridDesktop]}>
                    <KpiCard
                      theme={theme}
                      icon="shield-checkmark-outline"
                      label="Certificado"
                      value={certificadoLabel}
                      hint={validadeLabel || undefined}
                      intent={certificadoLabel === 'Indisponível' ? 'warning' : 'positive'}
                    />
                    <KpiCard
                      theme={theme}
                      icon="alert-circle-outline"
                      label="DAS pendentes"
                      value={dasSummary ? String(dasSummary.pendentes) : '—'}
                      hint={dasSummary ? `Competência ${dasSummary.competencia}` : undefined}
                      intent={dasSummary && dasSummary.pendentes > 0 ? 'warning' : 'positive'}
                    />
                    <KpiCard
                      theme={theme}
                      icon="document-text-outline"
                      label="Notas"
                      value={String(notas.length)}
                      hint="últimas registradas"
                      intent="neutral"
                    />
                    <KpiCard
                      theme={theme}
                      icon="cash-outline"
                      label="Parcelamentos"
                      value={String(parcelamentos.length)}
                      hint={parcelamentosUnavailable ? 'indisponível' : undefined}
                      intent={parcelamentos.length > 0 ? 'warning' : 'neutral'}
                    />
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DAS (pendentes / status)</Text>
                    {dasSummary ? (
                      <>
                        <Text style={styles.rowLabel}>Competência: {dasSummary.competencia} • Pendentes: {dasSummary.pendentes}</Text>
                        {dasSummary.items?.slice(0, 10).map((item, idx) => (
                          <View key={idx} style={styles.row}>
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {item.displayName || item.email} — {item.status}
                            </Text>
                            <TouchableOpacity
                              style={styles.smallButton}
                              onPress={async () => {
                                const ok = await confirmDialog({
                                  title: 'Reprocessar DAS',
                                  message: `Confirma reprocessar o DAS de ${item.displayName || item.email} (${item.competencia})?`,
                                  confirmLabel: 'Reprocessar',
                                });
                                if (ok) handleReprocessDas(item.userId, item.competencia);
                              }}
                              disabled={actionLoading === 'reprocess'}
                            >
                              <Text style={styles.smallButtonText}>Reprocessar</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </>
                    ) : (
                      <EmptyState
                        theme={theme}
                        icon="cloud-offline-outline"
                        title="Nenhum dado DAS"
                        description="Não foi possível obter o status do DAS para este período."
                      />
                    )}
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Guias MEI</Text>
                    {meiLoading ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : meiPeriods.length === 0 ? (
                      <EmptyState
                        theme={theme}
                        icon="document-outline"
                        title="Nenhum período MEI"
                        description="Sem guias DAS disponíveis para este usuário."
                      />
                    ) : (
                      meiPeriods.slice(0, 12).map((p) => (
                        <View key={p.competencia} style={styles.row}>
                          <Text style={styles.rowLabel}>{p.competencia} — {p.status}</Text>
                          <View style={styles.rowActions}>
                            <TouchableOpacity
                              style={styles.smallButton}
                              onPress={() => selectedUserId && handleDownloadMeiGuide(selectedUserId, p.competencia)}
                              disabled={!!actionLoading}
                            >
                              <Text style={styles.smallButtonText}>PDF</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.smallButton, { marginLeft: 8 }]}
                              onPress={() => selectedUserId && handleSendWhatsapp(selectedUserId, p.competencia)}
                              disabled={!!actionLoading}
                            >
                              <Text style={styles.smallButtonText}>WhatsApp</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Parcelamentos</Text>
                    {parcelamentosLoading ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : parcelamentosUnavailable ? (
                      <EmptyState
                        theme={theme}
                        icon="cloud-offline-outline"
                        title="Parcelamentos indisponíveis"
                        description="Serviço de consulta de parcelamentos não respondeu."
                        variant="error"
                      />
                    ) : parcelamentos.length === 0 ? (
                      <EmptyState
                        theme={theme}
                        icon="checkmark-done-outline"
                        title="Nenhum parcelamento"
                        description="Este usuário não possui parcelamentos ativos."
                      />
                    ) : (
                      parcelamentos.slice(0, 20).map((p, idx) => (
                        <View key={p.numero ?? idx} style={styles.row}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowLabel}>
                              Nº {p.numero ?? '-'} • {p.modalidade ?? '-'}
                            </Text>
                            <Text style={styles.rowMeta}>
                              Pedido: {formatDate(p.dataPedido)} • Situação: {p.situacao ?? '-'}
                              {p.dataSituacao ? ` (${formatDate(p.dataSituacao)})` : ''}
                            </Text>
                          </View>
                          <View style={styles.rowActions}>
                            <TouchableOpacity
                              style={[styles.smallButton, { marginLeft: 4 }]}
                              onPress={() => p.numero && handleDownloadParcelamentoPdf(p.numero, p.modalidade)}
                              disabled={!p.numero || parcelamentoPdfLoadingNumero === p.numero}
                            >
                              {parcelamentoPdfLoadingNumero === p.numero ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.smallButtonText}>Baixar</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>Notas fiscais</Text>
                      <TouchableOpacity
                        testID="admin-open-emitir-nfse-modal"
                        style={styles.smallButton}
                        onPress={openEmitirNotaModal}
                        disabled={!selectedUserId || nfseAdminPrefillLoading}
                      >
                        <Text style={styles.smallButtonText}>Emitir nota</Text>
                      </TouchableOpacity>
                    </View>
                    {notasLoading ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : notasUnavailable ? (
                      <EmptyState
                        theme={theme}
                        icon="cloud-offline-outline"
                        title="Notas indisponíveis"
                        description="Não foi possível consultar as notas fiscais agora."
                        variant="error"
                      />
                    ) : notas.length === 0 ? (
                      <EmptyState
                        theme={theme}
                        icon="document-outline"
                        title="Nenhuma nota emitida"
                        description="Use o botão Emitir nota para criar uma NFSe."
                      />
                    ) : (
                      notas.slice(0, 20).map((n) => (
                        <View key={n.id} style={styles.row}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowLabel} numberOfLines={1}>
                              {n.protocol ?? n.id_integracao ?? n.id} • {n.document_type ?? 'NFSE'}
                            </Text>
                            <Text style={styles.rowMeta}>
                              {formatDate(n.created_at)} • Status: {formatNfseStatus(n.status)}
                              {n.archived_at ? ' • Arquivada' : ''}
                            </Text>
                          </View>
                          <View style={styles.rowActions}>
                            {n.pdf_url ? (
                              <TouchableOpacity
                                style={[styles.smallButton, { marginLeft: 4 }]}
                                onPress={() => Linking.openURL(n.pdf_url!)}
                              >
                                <Text style={styles.smallButtonText}>PDF</Text>
                              </TouchableOpacity>
                            ) : null}
                            {n.xml_url ? (
                              <TouchableOpacity
                                style={[styles.smallButton, { marginLeft: 4 }]}
                                onPress={() => Linking.openURL(n.xml_url!)}
                              >
                                <Text style={styles.smallButtonText}>XML</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </>
              )
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={emitirNotaVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Emitir NFSe</Text>
              <TouchableOpacity
                onPress={() => {
                  setEmitirNotaVisible(false);
                  setEmitirNotaError(null);
                  setNfseAdminPrefillLoading(false);
                }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            {emitirNotaError ? <Text style={styles.errorText}>{emitirNotaError}</Text> : null}
            {nfseAdminPrefillLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.placeholder, { marginTop: 8, textAlign: 'center' }]}>
                  A carregar dados do prestador…
                </Text>
              </View>
            ) : (
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>CNPJ prestador (usuário)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.border }]}
                  placeholder="Do certificado do usuário"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.prestadorCpfCnpj}
                  editable={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Endereço do prestador (cadastro MEI)</Text>
                <Text
                  testID="admin-nfse-prestador-endereco-resumo"
                  style={[styles.input, { backgroundColor: theme.border, lineHeight: 20 }]}
                  selectable
                >
                  {(() => {
                    const { summaryText, hasAddressData } = formatPrestadorEnderecoResumoForAdmin(
                      nfseForm.prestadorEndereco
                    );
                    return hasAddressData
                      ? summaryText
                      : 'Nenhum endereço veio do cadastro MEI. A emissão só prossegue quando o utilizador tiver endereço completo no sistema (sem morada inventada).';
                  })()}
                </Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>CPF/CNPJ tomador *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="CPF ou CNPJ"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.tomadorCpfCnpj ?? ''}
                  onChangeText={(t) => setNfseForm((f) => ({ ...f, tomadorCpfCnpj: formatDocument(t) }))}
                  keyboardType="numeric"
                  maxLength={18}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Razão social tomador *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nome do tomador"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.tomadorRazaoSocial ?? ''}
                  onChangeText={(t) => setNfseForm((f) => ({ ...f, tomadorRazaoSocial: t }))}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail tomador</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.tomadorEmail ?? ''}
                  onChangeText={(t) => setNfseForm((f) => ({ ...f, tomadorEmail: t }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Código serviço *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Código"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.servico?.codigo ?? ''}
                  onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico!, codigo: t } }))}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>CNAE *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="CNAE"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.servico?.cnae ?? ''}
                  onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico!, cnae: t } }))}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Discriminação *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Descrição do serviço"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.servico?.discriminacao ?? ''}
                  onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico!, discriminacao: t } }))}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Alíquota ISS *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 2 ou 2,5"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.servico?.aliquota != null ? String(nfseForm.servico.aliquota) : ''}
                  onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico!, aliquota: t } }))}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Valor do serviço *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 100,00"
                  placeholderTextColor={theme.textSecondary}
                  value={nfseForm.servico?.valorServico != null ? String(nfseForm.servico.valorServico) : ''}
                  onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico!, valorServico: t } }))}
                  keyboardType="decimal-pad"
                />
              </View>
            </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.smallButton, { marginTop: 16, paddingVertical: 12 }]}
              onPress={handleEmitirNotaSubmit}
              disabled={emitirNotaLoading || nfseAdminPrefillLoading}
            >
              {emitirNotaLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.smallButtonText}>Emitir nota</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    backBtn: {
      padding: 8,
      marginRight: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    scroll: {
      flex: 1,
    },
    centered: {
      padding: 20,
      alignItems: 'center',
    },
    errorText: {
      color: theme.error,
      padding: 12,
      fontSize: 14,
    },
    placeholder: {
      color: theme.textSecondary,
      fontSize: 14,
      padding: 8,
    },
    section: {
      margin: 16,
      padding: 16,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    pickerWrapper: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    kpiGridDesktop: {
      gap: 16,
    },
    userChips: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    userChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      marginRight: 8,
    },
    userChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    userChipText: {
      fontSize: 13,
      color: theme.text,
      maxWidth: 140,
    },
    userChipTextActive: {
      color: '#FFFFFF',
    },
    balanceRow: {
      fontSize: 14,
      color: theme.text,
      marginBottom: 4,
    },
    balanceTotal: {
      fontWeight: '600',
      marginTop: 4,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowLabel: {
      fontSize: 14,
      color: theme.text,
      flex: 1,
    },
    rowMeta: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    rowActions: {
      flexDirection: 'row',
    },
    entrada: {
      fontSize: 14,
      color: theme.success,
      fontWeight: '600',
    },
    saida: {
      fontSize: 14,
      color: theme.error,
      fontWeight: '600',
    },
    smallButton: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: theme.primary,
      borderRadius: 6,
    },
    smallButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputGroup: {
      marginBottom: 12,
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.background,
    },
  });
