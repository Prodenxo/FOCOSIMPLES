import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/themeStore';
import { getTheme, type Theme } from '../lib/theme';
import { MfConfirmDialog } from '../components/ui/MfConfirmDialog';
import { fetchAccessReport, type AccessReportEntry } from '../lib/access-request-report';
import { invokeManageAccessRequests } from '../lib/manage-access-requests';

interface Props {
  onBack: () => void;
}

type AccessRequestEmpresa = {
  nome: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  endereco: string;
  cep: string | null;
  telefone: string | null;
  email: string | null;
};

type AccessRequest = {
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  observacao: string | null;
  requestedAt: string | null;
  empresa: AccessRequestEmpresa | null;
};

type AuditEntry = AccessReportEntry;

type TabKey = 'pending' | 'history';

const EVENT_LABELS: Record<AuditEntry['eventType'], string> = {
  submitted: 'Aguardando aprovação',
  approved: 'Aprovado',
};

function formatCnpj(value: string | null): string {
  if (!value) return '—';
  const d = value.replace(/\D/g, '');
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function callManageFn(
  action: string,
  extra?: Record<string, unknown>,
): Promise<{ requests?: AccessRequest[]; entries?: AuditEntry[]; ok?: boolean }> {
  const data = await invokeManageAccessRequests({ action, ...extra });
  return {
    requests: data.requests as AccessRequest[] | undefined,
    entries: data.entries as AuditEntry[] | undefined,
    ok: data.ok as boolean | undefined,
  };
}

export default function AccessApprovalsScreen({ onBack }: Props) {
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [tab, setTab] = useState<TabKey>('pending');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AccessRequest | null>(null);

  const loadPending = useCallback(async () => {
    const data = await callManageFn('list');
    setRequests(data.requests ?? []);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistory(await fetchAccessReport(100));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'pending') {
        await loadPending();
      } else {
        await loadHistory();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tab === 'pending'
            ? 'Erro ao carregar as solicitações.'
            : 'Erro ao carregar o histórico.',
      );
    } finally {
      setLoading(false);
    }
  }, [tab, loadPending, loadHistory]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (req: AccessRequest) => {
    setActingId(req.userId);
    setError('');
    try {
      await callManageFn('approve', { userId: req.userId });
      setRequests((prev) => prev.filter((r) => r.userId !== req.userId));
      if (tab === 'history') {
        await loadHistory();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar.');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = (req: AccessRequest) => {
    setRejectTarget(req);
  };

  const confirmReject = async () => {
    const req = rejectTarget;
    if (!req) return;
    setActingId(req.userId);
    setError('');
    try {
      await callManageFn('reject', { userId: req.userId });
      setRequests((prev) => prev.filter((r) => r.userId !== req.userId));
      setRejectTarget(null);
      if (tab === 'history') {
        await loadHistory();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao negar.');
      setRejectTarget(null);
    } finally {
      setActingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitações de acesso</Text>
        <TouchableOpacity onPress={load} hitSlop={10} style={styles.backButton}>
          <Ionicons name="refresh-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setTab('pending')}
          style={[styles.tabBtn, tab === 'pending' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            Pendentes
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('history')}
          style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            Histórico
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {tab === 'pending' && requests.length === 0 && !error ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-done-outline" size={44} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Nenhuma solicitação pendente.</Text>
            </View>
          ) : null}

          {tab === 'history' && history.length === 0 && !error ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={44} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Nenhum registro no histórico ainda.</Text>
              <Text style={styles.emptyHint}>
                Requer API do site atualizada (Easypanel). Pendentes e aprovados via solicitação de acesso.
              </Text>
            </View>
          ) : null}

          {tab === 'history'
            ? history.map((entry) => {
                const badgeStyle =
                  entry.eventType === 'approved' ? styles.badgeApproved : styles.badgeSubmitted;
                const badgeTextStyle =
                  entry.eventType === 'approved'
                    ? styles.badgeTextApproved
                    : styles.badgeTextSubmitted;

                return (
                  <View key={entry.id} style={styles.card}>
                    <View style={styles.historyTopRow}>
                      <View style={[styles.badge, badgeStyle]}>
                        <Text style={[styles.badgeText, badgeTextStyle]}>
                          {EVENT_LABELS[entry.eventType]}
                        </Text>
                      </View>
                      <Text style={styles.historyDate}>{formatDateTime(entry.occurredAt)}</Text>
                    </View>
                    <Text style={styles.name}>{entry.fullName || 'Sem nome'}</Text>
                    {entry.email ? <Text style={styles.muted}>{entry.email}</Text> : null}
                    {entry.empresaNome ? (
                      <Text style={styles.muted}>{entry.empresaNome}</Text>
                    ) : null}
                    {entry.cnpj ? (
                      <Text style={styles.muted}>CNPJ: {formatCnpj(entry.cnpj)}</Text>
                    ) : null}
                    {entry.eventType === 'approved' && entry.requestedAt ? (
                      <Text style={styles.muted}>
                        Solicitado em {formatDateTime(entry.requestedAt)}
                      </Text>
                    ) : null}
                    {entry.eventType === 'approved' && entry.approvedAt ? (
                      <Text style={styles.muted}>
                        Aprovado em {formatDateTime(entry.approvedAt)}
                      </Text>
                    ) : null}
                    {entry.actorEmail && entry.eventType === 'approved' ? (
                      <Text style={styles.actorLine}>Por: {entry.actorEmail}</Text>
                    ) : null}
                  </View>
                );
              })
            : null}

          {tab === 'pending'
            ? requests.map((req) => {
            const acting = actingId === req.userId;
            return (
              <View key={req.userId} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.avatar}>
                    <Ionicons name="person-outline" size={20} color={theme.primary} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.name}>{req.fullName || 'Sem nome'}</Text>
                    {req.email ? <Text style={styles.muted}>{req.email}</Text> : null}
                    {req.phone ? <Text style={styles.muted}>{req.phone}</Text> : null}
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>Empresa</Text>
                <Text style={styles.empresaName}>{req.empresa?.nome || '—'}</Text>
                <Text style={styles.muted}>CNPJ: {formatCnpj(req.empresa?.cnpj ?? null)}</Text>
                {req.empresa?.razaoSocial ? (
                  <Text style={styles.muted}>Razão social: {req.empresa.razaoSocial}</Text>
                ) : null}
                {req.empresa?.endereco ? (
                  <Text style={styles.muted}>{req.empresa.endereco}</Text>
                ) : null}
                {req.empresa?.telefone ? (
                  <Text style={styles.muted}>Tel.: {req.empresa.telefone}</Text>
                ) : null}
                {req.empresa?.email ? (
                  <Text style={styles.muted}>{req.empresa.email}</Text>
                ) : null}

                {req.observacao ? (
                  <View style={styles.obsBox}>
                    <Text style={styles.obsText}>{req.observacao}</Text>
                  </View>
                ) : null}

                {req.requestedAt ? (
                  <Text style={styles.requestedAt}>
                    Solicitado em {formatDate(req.requestedAt)}
                  </Text>
                ) : null}

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => handleReject(req)}
                    disabled={acting}
                    style={[styles.actionBtn, styles.rejectBtn, acting && styles.btnDisabled]}
                  >
                    {acting ? (
                      <ActivityIndicator size="small" color={theme.error} />
                    ) : (
                      <Text style={[styles.actionText, { color: theme.error }]}>Negar</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => void handleApprove(req)}
                    disabled={acting}
                    style={[styles.actionBtn, styles.approveBtn, acting && styles.btnDisabled]}
                  >
                    {acting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Aprovar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
              })
            : null}
        </ScrollView>
      )}

      <MfConfirmDialog
        visible={rejectTarget !== null}
        variant="confirm"
        confirmIntent="danger"
        iconName="trash-outline"
        title="Negar solicitação"
        message={
          rejectTarget
            ? `Negar e remover o cadastro de ${rejectTarget.fullName || rejectTarget.email || 'este solicitante'}? O usuário e a empresa serão excluídos do banco. Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Negar e excluir"
        cancelLabel="Cancelar"
        loading={rejectTarget !== null && actingId === rejectTarget.userId}
        onConfirm={() => void confirmReject()}
        onCancel={() => setRejectTarget(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginLeft: 4,
    },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      padding: 4,
      borderRadius: 12,
      backgroundColor: theme.backgroundMuted,
      gap: 4,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    tabBtnActive: {
      backgroundColor: theme.card,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.text,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: 16,
      gap: 14,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.errorLight,
      borderRadius: 12,
      padding: 12,
    },
    errorText: {
      flex: 1,
      color: theme.error,
      fontSize: 13,
    },
    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      gap: 12,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 15,
    },
    emptyHint: {
      color: theme.textTertiary,
      fontSize: 13,
      textAlign: 'center',
      paddingHorizontal: 24,
      marginTop: 4,
    },
    historyTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
    },
    historyDate: {
      fontSize: 12,
      color: theme.textTertiary,
      flexShrink: 1,
      textAlign: 'right',
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    badgeSubmitted: {
      backgroundColor: theme.primaryLight,
    },
    badgeTextSubmitted: {
      color: theme.primary,
    },
    badgeApproved: {
      backgroundColor: theme.successLight ?? theme.primaryLight,
    },
    badgeTextApproved: {
      color: theme.success,
    },
    badgeRejected: {
      backgroundColor: theme.errorLight,
    },
    badgeTextRejected: {
      color: theme.error,
    },
    actorLine: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 8,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flex1: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    muted: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: theme.borderLight,
      marginVertical: 12,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: theme.textTertiary,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    empresaName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    obsBox: {
      backgroundColor: theme.backgroundMuted,
      borderRadius: 10,
      padding: 10,
      marginTop: 10,
    },
    obsText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    requestedAt: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 10,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    actionBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rejectBtn: {
      borderWidth: 1.5,
      borderColor: theme.error,
      backgroundColor: 'transparent',
    },
    approveBtn: {
      backgroundColor: theme.success,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    actionText: {
      fontSize: 15,
      fontWeight: '700',
    },
  });
