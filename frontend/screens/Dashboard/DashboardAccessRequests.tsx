import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { invokeManageAccessRequests } from '../../lib/manage-access-requests';
import { useAuthStore } from '../../store/authStore';
import type { Theme } from '../../lib/theme';
import { MfConfirmDialog } from '../../components/ui/MfConfirmDialog';

type PendingRequest = {
  userId: string;
  email: string | null;
  fullName: string | null;
  empresa: { nome: string | null } | null;
};

async function callList(): Promise<PendingRequest[]> {
  try {
    const data = await invokeManageAccessRequests({ action: 'list' });
    return (data.requests ?? []) as PendingRequest[];
  } catch {
    return [];
  }
}

async function callAction(action: 'approve' | 'reject', userId: string): Promise<void> {
  await invokeManageAccessRequests({ action, userId });
}

type Props = {
  theme: Theme;
  isDesktop: boolean;
};

/**
 * Bloco do Dashboard — só superadmin, só aparece quando há solicitações de
 * acesso pendentes. Permite negar/aprovar direto ou abrir a tela completa.
 */
export function DashboardAccessRequests({ theme, isDesktop }: Props) {
  const role = useAuthStore((s) => s.role);
  const router = useRouter();
  const isSuper = role === 'superadmin';

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingRequest | null>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const load = useCallback(async () => {
    if (!isSuper) return;
    const list = await callList();
    setRequests(list);
    setLoaded(true);
  }, [isSuper]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (req: PendingRequest) => {
    setActingId(req.userId);
    try {
      await callAction('approve', req.userId);
      setRequests((prev) => prev.filter((r) => r.userId !== req.userId));
    } catch {
      /* silencioso: widget de dashboard não derruba a tela */
    } finally {
      setActingId(null);
    }
  };

  const confirmReject = async () => {
    const req = rejectTarget;
    if (!req) return;
    setActingId(req.userId);
    try {
      await callAction('reject', req.userId);
      setRequests((prev) => prev.filter((r) => r.userId !== req.userId));
    } catch {
      /* silencioso */
    } finally {
      setRejectTarget(null);
      setActingId(null);
    }
  };

  // Só superadmin, e só quando há solicitações pendentes.
  if (!isSuper || !loaded || requests.length === 0) return null;

  return (
    <View style={[styles.panel, { width: isDesktop ? 340 : '100%' }]}>
      <View style={styles.header}>
        <Ionicons name="notifications-outline" size={18} color={theme.primary} />
        <Text style={styles.title}>Solicitações de acesso</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{requests.length}</Text>
        </View>
      </View>

      {requests.map((req) => {
        const acting = actingId === req.userId;
        return (
          <View key={req.userId} style={styles.card}>
            <Text style={styles.name} numberOfLines={1}>
              {req.fullName || 'Sem nome'}
            </Text>
            <Text style={styles.empresa} numberOfLines={1}>
              {req.empresa?.nome || 'Empresa não informada'}
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => setRejectTarget(req)}
                disabled={acting}
                accessibilityLabel="Negar"
                style={[styles.iconBtn, styles.rejectBtn, acting && styles.btnDisabled]}
              >
                {acting ? (
                  <ActivityIndicator size="small" color={theme.error} />
                ) : (
                  <Ionicons name="close" size={18} color={theme.error} />
                )}
              </Pressable>
              <Pressable
                onPress={() => void handleApprove(req)}
                disabled={acting}
                accessibilityLabel="Aceitar"
                style={[styles.iconBtn, styles.approveBtn, acting && styles.btnDisabled]}
              >
                {acting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                )}
              </Pressable>
              <Pressable
                onPress={() => router.push('/(app)/solicitacoes')}
                accessibilityLabel="Detalhes"
                style={[styles.iconBtn, styles.detailBtn]}
              >
                <Ionicons name="eye-outline" size={18} color={theme.primary} />
              </Pressable>
            </View>
          </View>
        );
      })}

      <Pressable onPress={() => router.push('/(app)/solicitacoes')} style={styles.viewAll}>
        <Text style={[styles.viewAllText, { color: theme.primary }]}>Ver todas</Text>
        <Ionicons name="arrow-forward" size={14} color={theme.primary} />
      </Pressable>

      <MfConfirmDialog
        visible={rejectTarget !== null}
        variant="confirm"
        confirmIntent="danger"
        iconName="trash-outline"
        title="Negar solicitação"
        message={
          rejectTarget
            ? `Negar e remover o cadastro de ${
                rejectTarget.fullName || rejectTarget.email || 'este solicitante'
              }? O usuário e a empresa serão excluídos do banco.`
            : ''
        }
        confirmLabel="Negar e excluir"
        cancelLabel="Cancelar"
        loading={rejectTarget !== null && actingId === rejectTarget.userId}
        onConfirm={() => void confirmReject()}
        onCancel={() => setRejectTarget(null)}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    panel: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 12,
      alignSelf: 'flex-start',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    badge: {
      backgroundColor: theme.primary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      minWidth: 22,
      alignItems: 'center',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    card: {
      backgroundColor: theme.backgroundMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderLight,
      padding: 12,
      gap: 2,
    },
    name: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    empresa: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
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
    detailBtn: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      flex: 1,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    viewAll: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    viewAllText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
