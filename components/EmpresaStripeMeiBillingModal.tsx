import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import {
  createMeiStripeCheckout,
  listStripeMeiSubscriptionLines,
  syncMaxMeiFromStripeLines,
  type BillingTimingOption,
  type StripeMeiSubscriptionLine,
} from '../services/adminBillingService';
import type { EmpresaOption } from '../services/empresaService';
import { useAppToastStore } from '../store/appToastStore';
import { ActivationPageCanvas } from './activation/ActivationPageCanvas';
import { ActivationEyebrow } from './activation/activationUi';
import { MeiPrimaryButton } from './mei/meiFlowUi';
import { MfGlassCard } from './ui/MfGlassCard';
import { MfScrollView } from './ui/MfScrollView';
import { useMfTheme } from './ui/useMfTheme';
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../lib/techDesign';
import { mfRadius, mfSpacing, mfTypography } from '../lib/theme';
import { MEI_SLOT_PACKAGE_OPTIONS, resolveMeiPackagePrice } from '../lib/meiBillingPricing';

const apiErrorMessage = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;
const BILLING_MODAL_MAX_WIDTH = 720;

export interface EmpresaStripeMeiBillingModalProps {
  open: boolean;
  empresa: EmpresaOption | null;
  /** @deprecated usa tema global via useMfTheme — mantido só por compatibilidade */
  theme?: unknown;
  meiUsuariosEmUso?: number | null;
  onClose: () => void;
  onMaxMeiSynced?: () => void | Promise<void>;
}

const formatBrl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
};

const billingTypeLabel = (t: string) => {
  if (t === 'stripe_checkout') return 'Link de pagamento';
  if (t === 'stripe_next_cycle') return 'Próxima fatura';
  return t || '—';
};

const statusLabel = (s: string) => {
  if (s === 'active') return 'Ativo';
  if (s === 'pending') return 'Pendente';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelado';
  return s || '—';
};

const shortEmpresaId = (id: string) =>
  id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

export function EmpresaStripeMeiBillingModal({
  open,
  empresa,
  meiUsuariosEmUso,
  onClose,
  onMaxMeiSynced,
}: EmpresaStripeMeiBillingModalProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens, isDarkMode), [theme, tokens, isDarkMode]);
  const showToast = useAppToastStore((s) => s.show);

  const [lines, setLines] = useState<StripeMeiSubscriptionLine[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [meiSlots, setMeiSlots] = useState(5);
  const [billingTiming, setBillingTiming] = useState<BillingTimingOption>('checkout');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [lastCheckoutUrl, setLastCheckoutUrl] = useState<string | null>(null);
  const [syncMaxMeiLoading, setSyncMaxMeiLoading] = useState(false);

  const loadLines = useCallback(async () => {
    if (!empresa?.id) return;
    setListLoading(true);
    setListError(null);
    try {
      const data = await listStripeMeiSubscriptionLines(empresa.id);
      setLines(data.lines || []);
    } catch (e: unknown) {
      const msg = apiErrorMessage(e, 'Erro ao carregar linhas de assinatura');
      setListError(msg);
      setLines([]);
      showToast(msg, 'error');
    } finally {
      setListLoading(false);
    }
  }, [empresa?.id, showToast]);

  useEffect(() => {
    if (!open || !empresa) return;
    setLastCheckoutUrl(null);
    void loadLines();
  }, [open, empresa?.id, loadLines]);

  const hasActiveSubscription = useMemo(
    () =>
      lines.some(
        (l) =>
          l.status === 'active' &&
          l.stripe_subscription_id &&
          String(l.stripe_subscription_id).trim().length > 0,
      ),
    [lines],
  );

  const billingOptionsReady = !listLoading;
  const canUseCheckout = billingOptionsReady && !hasActiveSubscription;
  const canUseNextCycle = billingOptionsReady && hasActiveSubscription;

  useEffect(() => {
    if (!open || listLoading) return;
    setBillingTiming(hasActiveSubscription ? 'next_cycle' : 'checkout');
  }, [open, listLoading, hasActiveSubscription]);

  const pricePreview = useMemo(() => resolveMeiPackagePrice(meiSlots), [meiSlots]);

  const activeMeiSlotsTotal = useMemo(
    () =>
      lines.filter((l) => l.status === 'active').reduce((sum, l) => sum + Number(l.mei_slots || 0), 0),
    [lines],
  );

  const projectedMeiSlotsTotal = activeMeiSlotsTotal + meiSlots;

  const plataformaMeiGuardadoLabel = useMemo(() => {
    const lim =
      empresa?.max_mei === null || empresa?.max_mei === undefined
        ? 0
        : Number(empresa?.max_mei) || 0;
    if (lim > 0) return String(lim);
    return 'Desligado';
  }, [empresa?.max_mei]);

  const meiEmUso =
    meiUsuariosEmUso !== null && meiUsuariosEmUso !== undefined ? Number(meiUsuariosEmUso) : null;

  const empresaDisplayName = useMemo(() => {
    if (!empresa) return '';
    return empresa.nome_fantasia?.trim() || empresa.empresa;
  }, [empresa]);

  const handleSubmit = async () => {
    if (!empresa) return;
    if (!billingOptionsReady) return;
    if (billingTiming === 'next_cycle' && !hasActiveSubscription) {
      showToast(
        'Esta empresa ainda não tem assinatura ativa com cartão. Use o link de pagamento primeiro.',
        'info',
      );
      return;
    }
    if (billingTiming === 'checkout' && hasActiveSubscription) {
      showToast(
        'Esta empresa já tem assinatura ativa. Acrescente vagas só em «Próxima fatura».',
        'info',
      );
      return;
    }
    setSubmitLoading(true);
    setLastCheckoutUrl(null);
    try {
      const data = await createMeiStripeCheckout({
        empresaId: empresa.id,
        meiSlots,
        billingTiming,
      });
      await loadLines();
      if (data.checkoutUrl) {
        setLastCheckoutUrl(data.checkoutUrl);
        showToast(
          'Link de pagamento gerado. Copie ou abra no navegador para enviar ao cliente.',
          'success',
        );
      } else {
        showToast(
          'Pacote incluído na assinatura. O valor entra na próxima fatura (sem prorata imediata).',
          'success',
        );
      }
    } catch (e: unknown) {
      showToast(apiErrorMessage(e, 'Erro ao processar cobrança MEI'), 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSyncMaxMeiFromLines = async () => {
    if (!empresa) return;
    setSyncMaxMeiLoading(true);
    try {
      const { max_mei: next } = await syncMaxMeiFromStripeLines(empresa.id);
      await onMaxMeiSynced?.();
      showToast(
        `Limite MEI alinhado: ${next} vagas. Atualize a lista de empresas se o número ainda não mudou.`,
        'success',
      );
    } catch (e: unknown) {
      showToast(apiErrorMessage(e, 'Erro ao alinhar limite MEI'), 'error');
    } finally {
      setSyncMaxMeiLoading(false);
    }
  };

  const copyCheckoutUrl = async () => {
    if (!lastCheckoutUrl) return;
    try {
      await Clipboard.setStringAsync(lastCheckoutUrl);
      showToast('Link copiado para a área de transferência.', 'success');
    } catch {
      showToast('Não foi possível copiar o link.', 'error');
    }
  };

  const openCheckoutUrl = async () => {
    if (!lastCheckoutUrl) return;
    try {
      await WebBrowser.openBrowserAsync(lastCheckoutUrl);
    } catch {
      showToast('Não foi possível abrir o link.', 'error');
    }
  };

  const submitLabel =
    billingTiming === 'checkout' ? 'Gerar link de pagamento' : 'Incluir na próxima fatura';

  if (!open || !empresa) return null;

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <ActivationPageCanvas
        isDarkMode={isDarkMode}
        maxWidth={BILLING_MODAL_MAX_WIDTH}
        canvasScrim
        opaqueShell
        pagePadding="none"
      >
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <View style={styles.shell}>
            <View style={styles.headerBar}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  mfTechInsetSurface(isDarkMode),
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Fechar cobrança MEI"
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
              <View style={styles.headerTitles}>
                <ActivationEyebrow label="COBRANÇA · STRIPE" isDarkMode={isDarkMode} style={styles.headerEyebrow} />
                <Text style={styles.headerTitle} accessibilityRole="header">
                  Pacotes MEI
                </Text>
              </View>
              <View style={styles.headerIconSpacer} />
            </View>
            <View style={[styles.headerDivider, { backgroundColor: tokens.divider }]} />

            <MfScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: mfSpacing.md },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              hideLegalFooter
            >
              <View style={[mfTechPanelChrome(isDarkMode, 'accent'), styles.heroPanel]}>
                <Text style={styles.heroName} numberOfLines={2}>
                  {empresaDisplayName}
                </Text>
                {empresa.empresa !== empresaDisplayName ? (
                  <Text style={styles.heroLegal} numberOfLines={1}>
                    {empresa.empresa}
                  </Text>
                ) : null}
                <Text style={styles.heroMeta} selectable>
                  Ref. {shortEmpresaId(empresa.id)}
                </Text>
              </View>

              <View style={styles.sectionBlock}>
                <View style={styles.sectionRow}>
                  <ActivationEyebrow label="HISTÓRICO" isDarkMode={isDarkMode} style={styles.sectionEyebrow} />
                  <View style={styles.sectionActions}>
                    <Pressable
                      onPress={() => void handleSyncMaxMeiFromLines()}
                      disabled={syncMaxMeiLoading}
                      style={({ pressed }) => [
                        styles.toolBtn,
                        mfTechInsetSurface(isDarkMode),
                        pressed && styles.pressed,
                      ]}
                      accessibilityLabel="Alinhar limite MEI com linhas Stripe ativas"
                    >
                      {syncMaxMeiLoading ? (
                        <ActivityIndicator size="small" color={tokens.accent} />
                      ) : (
                        <Ionicons name="sync-outline" size={16} color={tokens.accent} />
                      )}
                      <Text style={styles.toolBtnText}>Alinhar limite</Text>
                    </Pressable>
                    <Pressable onPress={() => void loadLines()} disabled={listLoading}>
                      <Text style={styles.linkAction}>
                        {listLoading ? 'Atualizando…' : 'Atualizar'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <MfGlassCard techVariant="surface" padding="none" style={styles.historyCard}>
                  {listError ? (
                    <Text style={styles.errorInline} accessibilityRole="alert">
                      {listError}
                    </Text>
                  ) : null}
                  {listLoading && lines.length === 0 ? (
                    <View style={styles.historyLoading}>
                      <ActivityIndicator color={tokens.accent} />
                      <Text style={styles.muted}>Carregando pacotes…</Text>
                    </View>
                  ) : lines.length === 0 ? (
                    <View style={[mfTechInsetSurface(isDarkMode), styles.emptyHistory]}>
                      <Ionicons name="layers-outline" size={28} color={tokens.accentMuted} />
                      <Text style={styles.emptyTitle}>Nenhum pacote ainda</Text>
                      <Text style={styles.emptySub}>
                        O histórico aparece aqui depois de gerar o link ou incluir na fatura.
                      </Text>
                    </View>
                  ) : (
                    lines.map((row, idx) => (
                      <View
                        key={row.id}
                        style={[
                          styles.historyRow,
                          idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.divider },
                        ]}
                      >
                        <View style={styles.historyRowTop}>
                          <Text style={styles.historyStatus}>{statusLabel(row.status)}</Text>
                          <Text style={styles.historySlots}>{row.mei_slots} vagas</Text>
                          <Text style={styles.historyPrice}>
                            {formatBrl(Number(row.value_numeric) || 0)}
                          </Text>
                        </View>
                        <Text style={styles.historyMeta}>
                          {billingTypeLabel(row.billing_type)} · {formatDateTime(row.created_at)}
                        </Text>
                      </View>
                    ))
                  )}
                </MfGlassCard>
              </View>

              <View style={styles.sectionBlock}>
                <ActivationEyebrow label="NOVO PACOTE" isDarkMode={isDarkMode} style={styles.sectionEyebrow} />
                <Text style={styles.helper}>
                  «Vagas no pacote» é só esta compra — não altera o limite na lista de empresas.
                </Text>

                <View
                  style={[
                    styles.statusBanner,
                    {
                      borderLeftColor: tokens.accent,
                      backgroundColor: tokens.accentSoft,
                    },
                  ]}
                >
                  <Ionicons
                    name={hasActiveSubscription ? 'checkmark-circle-outline' : 'information-circle-outline'}
                    size={18}
                    color={tokens.accent}
                  />
                  <Text style={styles.statusBannerText}>
                    {hasActiveSubscription
                      ? 'Assinatura ativa: novos pacotes entram na próxima fatura.'
                      : 'Sem assinatura ativa: gere o link para o cliente cadastrar o cartão na Stripe.'}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Vagas no pacote</Text>
                <View
                  style={styles.slotGrid}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Tamanho do pacote em vagas MEI"
                >
                  {MEI_SLOT_PACKAGE_OPTIONS.map((n) => {
                    const active = meiSlots === n;
                    const label = `${n}`;
                    const price = resolveMeiPackagePrice(n);
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setMeiSlots(n)}
                        style={({ pressed }) => [
                          styles.slotChip,
                          mfTechInsetSurface(isDarkMode),
                          active && {
                            borderColor: tokens.accent,
                            backgroundColor: tokens.accentSoft,
                          },
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${n} vagas, ${formatBrl(price)} por mês`}
                      >
                        <Text style={[styles.slotChipLabel, active && { color: tokens.accent }]}>
                          {label}
                        </Text>
                        <Text style={[styles.slotChipPrice, active && { color: tokens.accentMuted }]}>
                          {formatBrl(price)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Como cobrar</Text>
                {listLoading ? (
                  <Text style={styles.muted}>A verificar assinatura…</Text>
                ) : (
                  <>
                    <BillingTimingOption
                      title="Link de pagamento"
                      subtitle="Primeira assinatura e cadastro do cartão na Stripe."
                      selected={billingTiming === 'checkout'}
                      disabled={!canUseCheckout}
                      onPress={() => setBillingTiming('checkout')}
                      isDarkMode={isDarkMode}
                      tokens={tokens}
                      theme={theme}
                    />
                    <BillingTimingOption
                      title="Próxima fatura"
                      subtitle="Acrescenta à assinatura ativa; cobrança no próximo ciclo."
                      selected={billingTiming === 'next_cycle'}
                      disabled={!canUseNextCycle}
                      onPress={() => setBillingTiming('next_cycle')}
                      isDarkMode={isDarkMode}
                      tokens={tokens}
                      theme={theme}
                    />
                  </>
                )}

                <View style={styles.summaryBento}>
                  <View style={[mfTechInsetSurface(isDarkMode), styles.summaryCell]}>
                    <Text style={styles.summaryEyebrow}>Plataforma</Text>
                    <View style={styles.summaryMetrics}>
                      <SummaryMetric label="Limite guardado" value={plataformaMeiGuardadoLabel} mono />
                      <SummaryMetric
                        label="Utilizadores MEI"
                        value={meiEmUso !== null && Number.isFinite(meiEmUso) ? String(meiEmUso) : '—'}
                        mono
                      />
                    </View>
                  </View>
                  <View style={[mfTechPanelChrome(isDarkMode, 'surface'), styles.summaryCell, styles.summaryAccent]}>
                    <Text style={[styles.summaryEyebrow, { color: tokens.accent }]}>Assinatura ativa</Text>
                    <View style={styles.summaryMetrics}>
                      <SummaryMetric label="Já contratado" value={String(activeMeiSlotsTotal)} mono accent={tokens.accent} />
                      <SummaryMetric label="Este pacote" value={`+${meiSlots}`} mono accent={tokens.accent} />
                      <SummaryMetric
                        label="Total após incluir"
                        value={String(projectedMeiSlotsTotal)}
                        mono
                        accent={tokens.accent}
                        large
                      />
                    </View>
                  </View>
                </View>

                {lastCheckoutUrl ? (
                  <View style={[styles.checkoutWell, { borderColor: theme.success, backgroundColor: theme.successLight }]}>
                    <ActivationEyebrow label="LINK GERADO" isDarkMode={isDarkMode} style={styles.checkoutEyebrow} />
                    <Text style={styles.urlPreview} numberOfLines={3} selectable>
                      {lastCheckoutUrl}
                    </Text>
                    <View style={styles.checkoutActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.checkoutActionBtn,
                          mfTechInsetSurface(isDarkMode),
                          pressed && styles.pressed,
                        ]}
                        onPress={() => void openCheckoutUrl()}
                      >
                        <Ionicons name="open-outline" size={18} color={tokens.accent} />
                        <Text style={styles.checkoutActionText}>Abrir</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.checkoutActionBtn,
                          mfTechInsetSurface(isDarkMode),
                          pressed && styles.pressed,
                        ]}
                        onPress={() => void copyCheckoutUrl()}
                      >
                        <Ionicons name="copy-outline" size={18} color={tokens.accent} />
                        <Text style={styles.checkoutActionText}>Copiar</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            </MfScrollView>

            <View
              style={[
                styles.footer,
                {
                  paddingBottom: Math.max(insets.bottom, mfSpacing.md),
                  borderTopColor: tokens.divider,
                },
              ]}
            >
              <Text style={styles.footerPrice}>
                Total do pacote{' '}
                <Text style={styles.footerPriceValue}>{formatBrl(pricePreview)}</Text>
                <Text style={styles.footerPricePeriod}>/mês</Text>
              </Text>
              <MeiPrimaryButton
                label={submitLabel}
                onPress={() => void handleSubmit()}
                loading={submitLoading}
                disabled={submitLoading || listLoading}
                variant="block"
              />
            </View>
          </View>
        </SafeAreaView>
      </ActivationPageCanvas>
    </Modal>
  );
}

function BillingTimingOption({
  title,
  subtitle,
  selected,
  disabled,
  onPress,
  isDarkMode,
  tokens,
  theme,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  isDarkMode: boolean;
  tokens: ReturnType<typeof getTechTokens>;
  theme: { text: string; textSecondary: string; textTertiary: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        mfTechInsetSurface(isDarkMode),
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: mfSpacing.sm,
          padding: mfSpacing.md,
          borderRadius: mfRadius.md,
          marginBottom: mfSpacing.sm,
          opacity: disabled ? 0.45 : 1,
          borderWidth: selected ? 1 : StyleSheet.hairlineWidth,
          borderColor: selected ? tokens.accent : tokens.insetBorder,
          backgroundColor: selected ? tokens.accentSoft : undefined,
        },
        pressed && !disabled && { opacity: 0.9 },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={disabled ? theme.textTertiary : tokens.accent}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2, lineHeight: 16 }}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function SummaryMetric({
  label,
  value,
  mono,
  accent,
  large,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
  large?: boolean;
}) {
  const { theme } = useMfTheme();
  return (
    <View style={{ minWidth: 88, flex: 1 }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textTertiary, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontSize: large ? 20 : 16,
          fontWeight: '700',
          color: accent ?? theme.text,
          marginTop: mfSpacing.xs,
          fontVariant: mono ? ['tabular-nums'] : undefined,
          fontFamily: mono ? (Platform.OS === 'web' ? 'ui-monospace, monospace' : undefined) : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function createStyles(
  theme: { text: string; textSecondary: string; textTertiary: string; error: string; success: string; successLight: string },
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    safe: { flex: 1 },
    shell: { flex: 1, minHeight: 0 },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: mfSpacing.md,
      paddingTop: mfSpacing.sm,
      gap: mfSpacing.sm,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIconSpacer: { width: 40 },
    headerTitles: { flex: 1, alignItems: 'center' },
    headerEyebrow: { marginBottom: mfSpacing.xs },
    headerTitle: {
      ...mfTypography.title,
      fontSize: 18,
      color: theme.text,
      textAlign: 'center',
    },
    headerDivider: { height: StyleSheet.hairlineWidth, marginTop: mfSpacing.sm },
    scroll: { flex: 1 },
    scrollContent: {
      padding: mfSpacing.md,
      gap: mfSpacing.lg,
    },
    heroPanel: {
      padding: mfSpacing.lg,
      borderRadius: mfRadius.lg,
    },
    heroName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      lineHeight: 24,
    },
    heroLegal: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: mfSpacing.xs,
    },
    heroMeta: {
      fontSize: 11,
      color: tokens.accentMuted,
      marginTop: mfSpacing.sm,
      fontFamily: Platform.OS === 'web' ? 'ui-monospace, monospace' : undefined,
    },
    sectionBlock: { gap: mfSpacing.sm },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
    sectionEyebrow: { marginBottom: 0 },
    sectionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
    },
    toolBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.xs,
      paddingHorizontal: mfSpacing.sm,
      paddingVertical: mfSpacing.xs,
      borderRadius: mfRadius.sm,
    },
    toolBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.accent,
    },
    linkAction: {
      fontSize: 13,
      fontWeight: '600',
      color: tokens.accent,
    },
    historyCard: { overflow: 'hidden' },
    historyLoading: {
      padding: mfSpacing.xl,
      alignItems: 'center',
      gap: mfSpacing.sm,
    },
    emptyHistory: {
      margin: mfSpacing.md,
      padding: mfSpacing.lg,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      gap: mfSpacing.sm,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    emptySub: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 280,
    },
    historyRow: {
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.sm,
    },
    historyRowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
    historyStatus: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
      flex: 1,
    },
    historySlots: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    historyPrice: {
      fontSize: 13,
      fontWeight: '700',
      color: tokens.accent,
      fontVariant: ['tabular-nums'],
    },
    historyMeta: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: mfSpacing.xs,
    },
    errorInline: {
      color: theme.error,
      fontSize: 13,
      padding: mfSpacing.md,
    },
    helper: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    statusBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: mfSpacing.sm,
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      borderLeftWidth: 3,
    },
    statusBannerText: {
      flex: 1,
      fontSize: 12,
      color: theme.text,
      lineHeight: 17,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      marginTop: mfSpacing.xs,
    },
    muted: { fontSize: 12, color: theme.textSecondary },
    slotGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
      marginTop: mfSpacing.xs,
    },
    slotChip: {
      width: Platform.OS === 'web' ? '23%' : undefined,
      minWidth: 76,
      maxWidth: Platform.OS === 'web' ? 120 : undefined,
      flexGrow: 1,
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.sm,
      borderRadius: mfRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.insetBorder,
      alignItems: 'center',
    },
    slotChipLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
    },
    slotChipPrice: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: mfSpacing.xs,
      fontVariant: ['tabular-nums'],
    },
    summaryBento: {
      flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      gap: mfSpacing.sm,
      marginTop: mfSpacing.sm,
    },
    summaryCell: {
      flex: 1,
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      minWidth: Platform.OS === 'web' ? 0 : undefined,
    },
    summaryAccent: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.panelBorder,
    },
    summaryEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textTertiary,
      letterSpacing: 0.5,
      marginBottom: mfSpacing.sm,
    },
    summaryMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.md,
    },
    checkoutWell: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: mfRadius.md,
      padding: mfSpacing.md,
      marginTop: mfSpacing.sm,
    },
    checkoutEyebrow: { marginBottom: mfSpacing.sm },
    urlPreview: {
      fontSize: 11,
      color: theme.textSecondary,
      lineHeight: 16,
      fontFamily: Platform.OS === 'web' ? 'ui-monospace, monospace' : undefined,
    },
    checkoutActions: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      marginTop: mfSpacing.md,
    },
    checkoutActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: mfSpacing.xs,
      paddingVertical: mfSpacing.sm,
      borderRadius: mfRadius.sm,
    },
    checkoutActionText: {
      fontSize: 14,
      fontWeight: '600',
      color: tokens.accent,
    },
    footer: {
      paddingHorizontal: mfSpacing.md,
      paddingTop: mfSpacing.md,
      gap: mfSpacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: isDarkMode ? '#0a1018' : '#ffffff',
      ...(Platform.OS === 'web'
        ? { boxShadow: isDarkMode ? '0 -8px 24px rgba(0,0,0,0.45)' : '0 -4px 20px rgba(15,23,42,0.1)' }
        : {}),
    },
    footerPrice: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    footerPriceValue: {
      fontWeight: '800',
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    footerPricePeriod: {
      color: theme.textTertiary,
    },
    pressed: { opacity: 0.88 },
  });
}
