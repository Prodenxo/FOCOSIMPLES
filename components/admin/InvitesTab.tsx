import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToggleSwitch } from '../ToggleSwitch';
import { MfTechKpiCard } from '../ui/MfTechKpiCard';
import { MfScrollView } from '../ui/MfScrollView';
import { useMfTheme } from '../ui/useMfTheme';
import { InvitesTabChrome } from './invitesTabChrome';
import type { Theme } from '../../lib/theme';
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme';
import type { ManagedUser } from '../../lib/user-management';
import type { EmpresaOption } from '../../services/empresaService';
import { buildInviteRegisterUrl } from '../../lib/inviteRegisterUrl';
import { confirmDialog, alertDialog } from '../../lib/confirmDialog';
import {
  createInvite,
  listPendingInvites,
  revokeInvite,
  type EmpresaInviteRow,
} from '../../services/invitesService';
import {
  getTechTokens,
  mfTechInsetSurface,
  mfTechPanelChrome,
} from '../../lib/techDesign';

type ClipboardModule = typeof import('expo-clipboard');

interface Props {
  role: string | null;
  empresas: EmpresaOption[];
  users: ManagedUser[];
  theme: Theme;
  isDesktop: boolean;
  onFeedback?: (payload: { type: 'success' | 'error'; message: string }) => void;
}

function formatInviteDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function InvitesTab({ role, empresas, users, theme, isDesktop, onFeedback }: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);
  const insetSurface = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const accentPanel = useMemo(() => mfTechPanelChrome(isDarkMode, 'accent'), [isDarkMode]);
  const styles = useMemo(
    () => createStyles(theme, tokens, isDesktop, isDarkMode),
    [theme, tokens, isDesktop, isDarkMode],
  );
  const clipboardRef = useRef<ClipboardModule | null>(null);

  const [invites, setInvites] = useState<EmpresaInviteRow[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [inviteActionLoading, setInviteActionLoading] = useState(false);
  const [inviteEmpresaId, setInviteEmpresaId] = useState('');
  const [empresaPickerOpen, setEmpresaPickerOpen] = useState(false);
  const [empresaPickerSearch, setEmpresaPickerSearch] = useState('');
  const [isReusable, setIsReusable] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const isSuperadmin = role === 'superadmin';

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => {
      if (onFeedback) {
        onFeedback({ type, message });
        return;
      }
      alertDialog(type === 'success' ? 'Sucesso' : 'Erro', message);
    },
    [onFeedback],
  );

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    setInvitesError('');
    try {
      const data = await listPendingInvites();
      setInvites(data.invites || []);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao listar convites');
      setInvitesError(msg);
      notify('error', msg);
    } finally {
      setInvitesLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const getInviteCreatorLabel = (createdBy: string) => {
    const match = users.find((u) => u.id === createdBy);
    if (match) return match.displayName || match.email || '—';
    return '—';
  };

  const getEmpresaNameForInvite = (empresaId: string) => {
    const found = empresas.find((e) => e.id === empresaId);
    return found?.nome_fantasia || found?.empresa || '—';
  };

  const copyToClipboard = async (url: string) => {
    if (!url) {
      notify('error', 'Nenhum link para copiar.');
      return;
    }
    try {
      const Clipboard = clipboardRef.current ?? (await import('expo-clipboard'));
      clipboardRef.current = Clipboard;
      await Clipboard.setStringAsync(url);
      notify('success', 'Link copiado!');
    } catch {
      notify('error', 'Erro ao copiar link.');
    }
  };

  const handleGenerateInvite = async () => {
    if (isSuperadmin && !inviteEmpresaId) {
      notify('error', 'Selecione a empresa para gerar o convite.');
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setInviteActionLoading(true);
    try {
      const body = {
        ...(isSuperadmin ? { empresas_id: inviteEmpresaId } : {}),
        is_reusable: isReusable,
      };
      const result = await createInvite(body);
      setLastInviteUrl(result.inviteUrl);
      notify('success', isReusable ? 'Link reutilizável gerado!' : 'Link único gerado!');
      await loadInvites();
    } catch (err: unknown) {
      notify('error', getErrorMessage(err, 'Erro ao gerar convite'));
    } finally {
      setInviteActionLoading(false);
    }
  };

  const handleCopyLastInvite = () => {
    if (!lastInviteUrl) {
      notify('error', 'Gere um link antes de copiar.');
      return;
    }
    void copyToClipboard(lastInviteUrl);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const confirmed = await confirmDialog({
      title: 'Revogar convite',
      message: 'Revogar este convite? O link deixará de funcionar.',
      confirmLabel: 'Revogar',
      destructive: true,
    });
    if (!confirmed) return;

    setInviteActionLoading(true);
    try {
      await revokeInvite(inviteId);
      notify('success', 'Convite revogado.');
      await loadInvites();
    } catch (err: unknown) {
      notify('error', getErrorMessage(err, 'Erro ao revogar convite'));
    } finally {
      setInviteActionLoading(false);
    }
  };

  const filteredEmpresas = useMemo(() => {
    const q = empresaPickerSearch.trim().toLowerCase();
    return [...empresas]
      .sort((a, b) =>
        (a.nome_fantasia || a.empresa).localeCompare(b.nome_fantasia || b.empresa, 'pt-BR', {
          sensitivity: 'base',
        }),
      )
      .filter((empresa) => {
        if (!q) return true;
        const label = (empresa.nome_fantasia || empresa.empresa).toLowerCase();
        return label.includes(q);
      });
  }, [empresas, empresaPickerSearch]);

  const selectedEmpresaLabel = useMemo(() => {
    const found = empresas.find((e) => e.id === inviteEmpresaId);
    return found ? found.nome_fantasia || found.empresa : '';
  }, [empresas, inviteEmpresaId]);

  const renderTypeBadge = (reusable?: boolean) => (
    <View style={[styles.typeBadge, reusable ? styles.typeBadgeReusable : styles.typeBadgeSingle]}>
      <Text
        style={[
          styles.typeBadgeText,
          reusable ? styles.typeBadgeTextReusable : styles.typeBadgeTextSingle,
        ]}
      >
        {reusable ? 'Reutilizável' : 'Único'}
      </Text>
    </View>
  );

  const renderInviteRow = ({ item: inv }: { item: EmpresaInviteRow }) => {
    const inviteUrl = inv.raw_token ? buildInviteRegisterUrl(inv.raw_token) : '';

    if (isDesktop) {
      return (
        <View style={[styles.tableRow, insetSurface]}>
          {isSuperadmin ? (
            <Text style={[styles.tableCell, styles.tableCellEmpresa]} numberOfLines={2}>
              {getEmpresaNameForInvite(inv.empresas_id)}
            </Text>
          ) : null}
          <Text style={[styles.tableCell, styles.tableCellDate]} numberOfLines={1}>
            {formatInviteDate(inv.created_at)}
          </Text>
          <View style={[styles.tableCell, styles.tableCellType]}>{renderTypeBadge(inv.is_reusable)}</View>
          <Text style={[styles.tableCell, styles.tableCellUses]}>{inv.uses_count || 0}</Text>
          <View style={[styles.tableCell, styles.tableCellActions]}>
            {inviteUrl ? (
              <TouchableOpacity
                style={[styles.rowActionBtn, { backgroundColor: tokens.accentSoft }]}
                onPress={() => void copyToClipboard(inviteUrl)}
                accessibilityRole="button"
                accessibilityLabel="Copiar link do convite"
              >
                <Ionicons name="copy-outline" size={14} color={tokens.accent} />
                <Text style={[styles.rowActionBtnTextPrimary, { color: tokens.accent }]}>Copiar</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.rowActionBtn, styles.rowActionBtnDanger]}
              onPress={() => void handleRevokeInvite(inv.id)}
              disabled={inviteActionLoading}
              accessibilityRole="button"
              accessibilityLabel="Revogar convite"
            >
              <Ionicons name="close-circle-outline" size={14} color={theme.error} />
              <Text style={styles.rowActionBtnTextDanger}>Revogar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <MfTechKpiCard style={styles.inviteCardShell}>
        {isSuperadmin ? (
          <View style={styles.inviteCardRow}>
            <Ionicons name="business-outline" size={16} color={tokens.accent} />
            <Text style={styles.inviteCardEmpresa} numberOfLines={2}>
              {getEmpresaNameForInvite(inv.empresas_id)}
            </Text>
          </View>
        ) : null}
        <View style={styles.inviteCardMeta}>
          <Text style={styles.inviteCardDate}>{formatInviteDate(inv.created_at)}</Text>
          {renderTypeBadge(inv.is_reusable)}
        </View>
        <Text style={styles.inviteCardUses}>Usos: {inv.uses_count || 0}</Text>
        <Text style={styles.inviteCardCreator} numberOfLines={1}>
          Criado por {getInviteCreatorLabel(inv.created_by)}
        </Text>
        <View style={styles.inviteCardActions}>
          {inviteUrl ? (
            <TouchableOpacity
              style={[styles.cardActionPrimary, { backgroundColor: tokens.accent }]}
              onPress={() => void copyToClipboard(inviteUrl)}
              accessibilityRole="button"
            >
              <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
              <Text style={styles.cardActionPrimaryText}>Copiar link</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.cardActionSecondary}
            onPress={() => void handleRevokeInvite(inv.id)}
            disabled={inviteActionLoading}
            accessibilityRole="button"
          >
            <Text style={styles.cardActionSecondaryText}>Revogar</Text>
          </TouchableOpacity>
        </View>
      </MfTechKpiCard>
    );
  };

  return (
    <MfScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      hideLegalFooter
    >
      <InvitesTabChrome
        theme={theme}
        pendingCount={invites.length}
        isSuperadmin={isSuperadmin}
        loading={invitesLoading}
      />

      <View style={[styles.commandPanel, panelChrome]}>
        <View style={styles.panelSectionHeader}>
          <Ionicons name="link-outline" size={18} color={tokens.accent} />
          <Text style={styles.panelSectionTitle}>Gerar convite</Text>
        </View>

        {isSuperadmin ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              Empresa <Text style={styles.requiredMark}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.selector,
                insetSurface,
                showErrors && !inviteEmpresaId && styles.selectorError,
              ]}
              onPress={() => setEmpresaPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Selecionar empresa para convite"
            >
              <View style={styles.selectorLeft}>
                <Ionicons name="business-outline" size={16} color={tokens.accent} />
                <Text
                  style={[styles.selectorText, !inviteEmpresaId && { color: theme.placeholder }]}
                  numberOfLines={1}
                >
                  {selectedEmpresaLabel || 'Selecionar empresa'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.reusableRow, insetSurface]}>
          <ToggleSwitch
            value={isReusable}
            onValueChange={setIsReusable}
            activeColor={tokens.accent}
          />
          <Pressable style={styles.reusableLabelWrap} onPress={() => setIsReusable((v) => !v)}>
            <Text style={styles.reusableLabel}>Link reutilizável</Text>
            <Text style={styles.reusableHint}>Permite múltiplos cadastros com o mesmo link</Text>
          </Pressable>
        </View>

        <View style={[styles.actionsRow, !isDesktop && styles.actionsRowMobile]}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: tokens.accent },
              (inviteActionLoading || (isSuperadmin && !inviteEmpresaId)) && styles.primaryBtnDisabled,
            ]}
            onPress={() => void handleGenerateInvite()}
            disabled={inviteActionLoading || (isSuperadmin && !inviteEmpresaId)}
            accessibilityRole="button"
          >
            {inviteActionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Gerar link</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, insetSurface, !lastInviteUrl && styles.secondaryBtnDisabled]}
            onPress={handleCopyLastInvite}
            disabled={!lastInviteUrl}
            accessibilityRole="button"
          >
            <Ionicons name="copy-outline" size={16} color={tokens.accent} />
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Copiar link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, insetSurface]}
            onPress={() => void loadInvites()}
            disabled={invitesLoading}
            accessibilityRole="button"
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={tokens.accent}
              style={invitesLoading ? { opacity: 0.5 } : undefined}
            />
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
              {invitesLoading ? 'Atualizando…' : 'Atualizar'}
            </Text>
          </TouchableOpacity>
        </View>

        {lastInviteUrl ? (
          <View style={[styles.generatedHint, { backgroundColor: tokens.accentSoft, borderColor: tokens.accentMuted }]}>
            <Ionicons name="checkmark-circle" size={16} color={tokens.accent} />
            <Text style={[styles.generatedHintText, { color: theme.text }]}>
              Link gerado — use <Text style={{ fontWeight: '700', color: tokens.accent }}>Copiar link</Text> para
              enviar por e-mail ou mensagem.
            </Text>
          </View>
        ) : null}
      </View>

      {invitesError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={theme.error} />
          <Text style={styles.errorBannerText}>{invitesError}</Text>
        </View>
      ) : null}

      <View style={[styles.listPanel, accentPanel]}>
        <View style={styles.listPanelHeader}>
          <View style={styles.listPanelTitleRow}>
            <Ionicons name="mail-unread-outline" size={18} color={tokens.accent} />
            <Text style={styles.listPanelTitle}>Convites pendentes</Text>
          </View>
          {!invitesLoading ? (
            <View style={[styles.listCountBadge, { backgroundColor: tokens.accentSoft }]}>
              <Text style={[styles.listCountText, { color: tokens.accent }]}>{invites.length}</Text>
            </View>
          ) : null}
        </View>

        {isDesktop && invites.length > 0 ? (
          <View style={[styles.tableHeader, insetSurface]}>
            {isSuperadmin ? (
              <Text style={[styles.tableHeadCell, styles.tableCellEmpresa]}>Empresa</Text>
            ) : null}
            <Text style={[styles.tableHeadCell, styles.tableCellDate]}>Criado em</Text>
            <Text style={[styles.tableHeadCell, styles.tableCellType]}>Tipo</Text>
            <Text style={[styles.tableHeadCell, styles.tableCellUses]}>Usos</Text>
            <Text style={[styles.tableHeadCell, styles.tableCellActions]}>Ações</Text>
          </View>
        ) : null}

        {invitesLoading && invites.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={tokens.accent} />
            <Text style={styles.loadingText}>Carregando convites…</Text>
          </View>
        ) : (
          <FlatList
            data={invites}
            keyExtractor={(item) => item.id}
            renderItem={renderInviteRow}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: isDesktop ? 8 : mfSpacing.sm }} />}
            ListEmptyComponent={
              <View style={[styles.emptyWrap, insetSurface]}>
                <Ionicons name="mail-open-outline" size={28} color={tokens.accent} />
                <Text style={styles.emptyTitle}>Nenhum convite pendente</Text>
                <Text style={styles.emptyDescription}>Gere um link acima para convidar novos membros.</Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      <Modal
        visible={empresaPickerOpen}
        animationType={isDesktop ? 'fade' : 'slide'}
        transparent
        onRequestClose={() => setEmpresaPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEmpresaPickerOpen(false)} />
          <View
            style={[
              styles.modalPanel,
              panelChrome,
              isDesktop ? styles.modalPanelDesktop : styles.modalPanelMobile,
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: tokens.divider }]}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalIconWrap, { backgroundColor: tokens.accentSoft }]}>
                  <Ionicons name="business-outline" size={18} color={tokens.accent} />
                </View>
                <Text style={styles.modalTitle}>Selecionar empresa</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEmpresaPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.modalSearch, insetSurface]}>
              <Ionicons name="search" size={16} color={theme.textTertiary} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar empresa"
                placeholderTextColor={theme.placeholder}
                value={empresaPickerSearch}
                onChangeText={setEmpresaPickerSearch}
                autoCapitalize="none"
              />
            </View>
            <MfScrollView style={styles.modalList} keyboardShouldPersistTaps="handled" hideLegalFooter>
              {filteredEmpresas.map((empresa) => {
                const active = inviteEmpresaId === empresa.id;
                const label = empresa.nome_fantasia || empresa.empresa;
                return (
                  <TouchableOpacity
                    key={empresa.id}
                    style={[
                      styles.pickerRow,
                      active && { backgroundColor: tokens.accentSoft, borderColor: tokens.accentMuted },
                    ]}
                    onPress={() => {
                      setInviteEmpresaId(empresa.id);
                      setEmpresaPickerOpen(false);
                      setEmpresaPickerSearch('');
                      setShowErrors(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerRowText,
                        active && { color: tokens.accent, fontWeight: '600' },
                      ]}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={tokens.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
              {filteredEmpresas.length === 0 ? (
                <Text style={styles.pickerEmpty}>Nenhuma empresa encontrada.</Text>
              ) : null}
            </MfScrollView>
          </View>
        </View>
      </Modal>
    </MfScrollView>
  );
}

const createStyles = (
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
  isDesktop: boolean,
  isDarkMode: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: mfSpacing.xl,
      gap: mfSpacing.md,
    },
    commandPanel: {
      padding: mfSpacing.md,
      gap: mfSpacing.md,
    },
    panelSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    panelSectionTitle: {
      ...mfTypography.subtitle,
      fontSize: 15,
      color: theme.text,
    },
    fieldBlock: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    requiredMark: {
      color: theme.error,
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: Platform.select({ ios: 12, default: 14 }),
      minHeight: 48,
    },
    selectorError: {
      borderColor: theme.error,
    },
    selectorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 8,
    },
    selectorText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    reusableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    reusableLabelWrap: {
      flex: 1,
      gap: 2,
    },
    reusableLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    reusableHint: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    actionsRowMobile: {
      flexDirection: 'column',
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: mfRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: 18,
      minHeight: 44,
      ...(isDesktop ? {} : { width: '100%' }),
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    primaryBtnDisabled: {
      opacity: 0.5,
    },
    primaryBtnText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: mfRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 44,
      ...(isDesktop ? {} : { width: '100%' }),
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    secondaryBtnDisabled: {
      opacity: 0.45,
    },
    secondaryBtnText: {
      fontWeight: '600',
      fontSize: 14,
    },
    generatedHint: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderRadius: mfRadius.sm,
      padding: 12,
      borderWidth: 1,
    },
    generatedHintText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.errorLight,
      borderRadius: mfRadius.sm,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.error + '40',
    },
    errorBannerText: {
      flex: 1,
      color: theme.error,
      fontSize: 13,
      fontWeight: '500',
    },
    listPanel: {
      padding: mfSpacing.md,
      gap: mfSpacing.sm,
    },
    listPanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    listPanelTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    listPanelTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    listCountBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    listCountText: {
      fontSize: 13,
      fontWeight: '700',
    },
    loadingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 12,
    },
    loadingText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    listContent: {
      paddingTop: 4,
    },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 4,
    },
    tableHeadCell: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    tableCell: {
      fontSize: 13,
      color: theme.text,
    },
    tableCellEmpresa: {
      flex: 2,
      paddingRight: 8,
    },
    tableCellDate: {
      flex: 1.4,
      minWidth: 110,
    },
    tableCellType: {
      flex: 1,
      minWidth: 100,
    },
    tableCellUses: {
      width: 48,
      textAlign: 'center',
      fontWeight: '600',
    },
    tableCellActions: {
      flex: 1.6,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      minWidth: 160,
    },
    typeBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    typeBadgeReusable: {
      backgroundColor: tokens.accentSoft,
    },
    typeBadgeSingle: {
      backgroundColor: isDarkMode ? 'rgba(148, 163, 184, 0.12)' : theme.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.insetBorder,
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    typeBadgeTextReusable: {
      color: tokens.accent,
    },
    typeBadgeTextSingle: {
      color: theme.textSecondary,
    },
    rowActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: mfRadius.sm,
    },
    rowActionBtnDanger: {
      backgroundColor: theme.errorLight,
    },
    rowActionBtnTextPrimary: {
      fontSize: 12,
      fontWeight: '600',
    },
    rowActionBtnTextDanger: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.error,
    },
    inviteCardShell: {
      flex: 0,
      alignSelf: 'stretch',
    },
    inviteCardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    inviteCardEmpresa: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    inviteCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    inviteCardDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    inviteCardUses: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    inviteCardCreator: {
      fontSize: 12,
      color: theme.textTertiary,
    },
    inviteCardActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    cardActionPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: mfRadius.sm,
      paddingVertical: 10,
    },
    cardActionPrimaryText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 13,
    },
    cardActionSecondary: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: theme.error + '60',
      backgroundColor: theme.errorLight,
      justifyContent: 'center',
    },
    cardActionSecondaryText: {
      color: theme.error,
      fontWeight: '600',
      fontSize: 13,
    },
    emptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
      paddingHorizontal: 16,
      gap: 8,
      marginTop: 4,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: isDesktop ? 'center' : 'flex-end',
      padding: isDesktop ? 24 : 0,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalPanel: {
      overflow: 'hidden',
      maxHeight: isDesktop ? '80%' : '85%',
    },
    modalPanelDesktop: {
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
    },
    modalPanelMobile: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    modalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modalIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    modalSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: Platform.select({ ios: 10, default: 12 }),
    },
    modalSearchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    modalList: {
      maxHeight: 360,
      paddingHorizontal: 12,
      paddingBottom: 16,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: mfRadius.sm,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    pickerRowText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      marginRight: 8,
    },
    pickerEmpty: {
      textAlign: 'center',
      paddingVertical: 24,
      color: theme.textSecondary,
      fontSize: 13,
    },
  });
