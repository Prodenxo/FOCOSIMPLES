import React, { useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ActivationPageCanvas } from '../activation/ActivationPageCanvas'
import { ActivationEyebrow } from '../activation/activationUi'
import { MfGlassCard } from '../ui/MfGlassCard'
import { MfScrollView } from '../ui/MfScrollView'
import { useMfTheme } from '../ui/useMfTheme'
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../../lib/techDesign'
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme'
import { getWebScrollViewProps, WEB_SCROLL_Y_CLASS } from '../../lib/webScrollbar'

export type MeiDocType = 'NFSE' | 'NFE' | 'NFCE'

export type MeiCatalogDocFilter = 'ALL' | MeiDocType

const CATALOG_DOC_FILTER_LABELS: Record<MeiCatalogDocFilter, string> = {
  ALL: 'Todos',
  NFSE: 'NFS-e',
  NFE: 'NF-e',
  NFCE: 'NFC-e',
}

const DOC_LABELS: Record<MeiDocType, string> = {
  NFSE: 'NFSe',
  NFE: 'NFe',
  NFCE: 'NFC-e',
}

const MEI_FORM_MODAL_MAX_WIDTH = 480
const MEI_CONFIRM_MODAL_MAX_WIDTH = 400
const MEI_MODAL_WEB_Z_FORM = 11000
const MEI_MODAL_WEB_Z_CONFIRM = 12000

export function useMeiFlowStyles () {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  return useMemo(
    () => createFlowStyles(theme, isDarkMode, tokens),
    [theme, isDarkMode, tokens],
  )
}

type MeiFlowModalShellProps = {
  visible: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: React.ReactNode
  /** Segmentos NFSe / NFe / NFC-e */
  tabs?: {
    value: MeiDocType
    onChange: (v: MeiDocType) => void
    /** Se omitido, mostra os três tipos. */
    allowedTypes?: MeiDocType[]
  }
  footer?: React.ReactNode
  closeIcon?: 'close' | 'arrow-back'
  headerRight?: React.ReactNode
  /** Lista com FlatList — sem ScrollView pai (evita scroll aninhado). */
  flatListBody?: boolean
}

/** Modal full-screen com canvas tech (emissão, catálogos). */
export function MeiFlowModalShell ({
  visible,
  onClose,
  title,
  eyebrow,
  children,
  tabs,
  footer,
  closeIcon = 'arrow-back',
  headerRight,
  flatListBody = false,
}: MeiFlowModalShellProps) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <ActivationPageCanvas isDarkMode={isDarkMode} maxWidth={720}>
        <SafeAreaView style={flow.safe} edges={['top', 'bottom']}>
          <View style={flow.shellHeaderWrap}>
            <View style={flow.shellHeaderBar}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  flow.shellHeaderIcon,
                  mfTechInsetSurface(isDarkMode),
                  pressed && flow.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
              >
                <Ionicons
                  name={closeIcon === 'close' ? 'close' : 'arrow-back'}
                  size={20}
                  color={theme.text}
                />
              </Pressable>
              <Text style={[flow.headerTitle, { color: theme.text }]} numberOfLines={1}>
                {title}
              </Text>
              {headerRight ?? <View style={flow.shellHeaderIconSpacer} />}
            </View>
            <View style={[flow.shellDivider, { backgroundColor: tokens.divider }]} />
          </View>

          {tabs ? (
            <MeiSegmentTabs
              value={tabs.value}
              onChange={tabs.onChange}
              allowedTypes={tabs.allowedTypes}
              style={flow.tabsBar}
            />
          ) : null}

          {flatListBody ? (
            <View style={flow.listBody}>
              {eyebrow ? (
                <View style={[mfTechPanelChrome(isDarkMode, 'accent'), flow.hero, { margin: mfSpacing.md }]}>
                  <ActivationEyebrow label={eyebrow} isDarkMode={isDarkMode} />
                </View>
              ) : null}
              {children}
            </View>
          ) : (
            <MfScrollView
              style={flow.scroll}
              contentContainerStyle={flow.scrollContent}
              keyboardShouldPersistTaps="handled"
              hideLegalFooter
              {...(Platform.OS === 'web'
                ? { className: WEB_SCROLL_Y_CLASS, ...getWebScrollViewProps(theme) }
                : {})}
            >
              {eyebrow ? (
                <View style={[mfTechPanelChrome(isDarkMode, 'accent'), flow.hero]}>
                  <ActivationEyebrow label={eyebrow} isDarkMode={isDarkMode} />
                </View>
              ) : null}
              {children}
            </MfScrollView>
          )}

          {footer ? <View style={flow.footer}>{footer}</View> : null}
        </SafeAreaView>
      </ActivationPageCanvas>
    </Modal>
  )
}

type MeiSegmentTabsProps = {
  value: MeiDocType
  onChange: (v: MeiDocType) => void
  style?: ViewStyle
  allowedTypes?: MeiDocType[]
}

export function MeiSegmentTabs ({ value, onChange, style, allowedTypes }: MeiSegmentTabsProps) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()
  const visibleTypes = (allowedTypes?.length ? allowedTypes : (['NFSE', 'NFE', 'NFCE'] as MeiDocType[]))

  if (visibleTypes.length <= 1) return null

  return (
    <View style={[flow.segmentRow, style]}>
      {visibleTypes.map((t) => {
        const active = value === t
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={({ pressed }) => [
              flow.segment,
              active && { backgroundColor: tokens.accent, borderColor: tokens.accent },
              !active && mfTechInsetSurface(isDarkMode),
              pressed && flow.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                flow.segmentText,
                { color: active ? (isDarkMode ? '#030508' : '#fff') : theme.textSecondary },
              ]}
            >
              {DOC_LABELS[t]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

type MeiFormFieldProps = TextInputProps & {
  label: string
  required?: boolean
  hint?: string
}

export function MeiFormSectionLabel ({ children }: { children: string }) {
  const { theme } = useMfTheme()
  const flow = useMeiFlowStyles()

  return (
    <Text style={[flow.formSectionLabel, { color: theme.text }]}>
      {children}
    </Text>
  )
}

export function MeiFormField ({ label, required, hint, style, ...inputProps }: MeiFormFieldProps) {
  const { theme } = useMfTheme()
  const flow = useMeiFlowStyles()

  return (
    <View style={flow.field}>
      <Text style={[flow.label, { color: theme.text }]}>
        {label}
        {required ? <Text style={{ color: theme.error }}> *</Text> : null}
      </Text>
      {hint ? (
        <Text style={[flow.hint, { color: theme.textSecondary, marginBottom: 6 }]}>{hint}</Text>
      ) : null}
      <TextInput
        style={[flow.input, style]}
        placeholderTextColor={theme.placeholder}
        {...inputProps}
      />
    </View>
  )
}

export function MeiFormBanner ({ children }: { children: React.ReactNode }) {
  const { theme, isDarkMode } = useMfTheme()
  const flow = useMeiFlowStyles()

  return (
    <View
      style={[
        flow.banner,
        {
          borderLeftColor: theme.warning,
          backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.12)',
        },
      ]}
    >
      <Text style={[flow.bannerText, { color: theme.text }]}>{children}</Text>
    </View>
  )
}

export function MeiLinkButton ({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  const flow = useMeiFlowStyles()
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        mfTechInsetSurface(isDarkMode),
        flow.linkBtn,
        pressed && flow.pressed,
      ]}
      accessibilityRole="button"
    >
      <Ionicons name="albums-outline" size={18} color={tokens.accent} />
      <Text style={[flow.linkBtnText, { color: theme.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </Pressable>
  )
}

export function MeiPrimaryButton ({
  label,
  onPress,
  loading,
  disabled,
  variant = 'block',
}: {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  /** `footer`: par na base do modal (flex 1, altura fixa). `block`: CTA largura total. */
  variant?: 'block' | 'footer'
}) {
  const { isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        flow.primaryBtn,
        variant === 'footer' && flow.primaryBtnFooter,
        { backgroundColor: tokens.accent, opacity: pressed || disabled ? 0.88 : 1 },
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={isDarkMode ? '#030508' : '#fff'} />
      ) : (
        <Text style={[flow.primaryBtnText, { color: isDarkMode ? '#030508' : '#fff' }]}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export function MeiSecondaryButton ({
  label,
  onPress,
  variant = 'inline',
}: {
  label: string
  onPress: () => void
  variant?: 'inline' | 'footer'
}) {
  const { theme, isDarkMode } = useMfTheme()
  const flow = useMeiFlowStyles()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        flow.secondaryBtn,
        variant === 'footer' && [
          flow.secondaryBtnFooter,
          {
            borderColor: theme.border,
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : theme.backgroundMuted,
          },
        ],
        pressed && flow.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text
        style={[
          flow.secondaryBtnText,
          { color: variant === 'footer' ? theme.text : theme.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/** Rodapé do MeiConfirmDialog — Cancelar + ação destrutiva (excluir). */
export function MeiConfirmDialogActions ({
  onCancel,
  onConfirm,
  cancelLabel = 'Cancelar',
  confirmLabel = 'Excluir',
  loading,
}: {
  onCancel: () => void
  onConfirm: () => void
  cancelLabel?: string
  confirmLabel?: string
  loading?: boolean
}) {
  const { theme, isDarkMode } = useMfTheme()
  const flow = useMeiFlowStyles()

  return (
    <View style={flow.formModalActionRow}>
      <Pressable
        onPress={onCancel}
        disabled={loading}
        style={({ pressed }) => [
          flow.modalActionBtn,
          mfTechInsetSurface(isDarkMode),
          pressed && flow.pressed,
          loading && { opacity: 0.65 },
        ]}
        accessibilityRole="button"
      >
        <Text style={[flow.modalActionBtnText, { color: theme.text }]}>{cancelLabel}</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={loading}
        style={({ pressed }) => [
          flow.modalActionBtn,
          {
            backgroundColor: theme.error,
            borderColor: 'rgba(239, 68, 68, 0.45)',
          },
          pressed && { opacity: 0.9 },
          loading && { opacity: 0.65 },
        ]}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={[flow.modalActionBtnText, { color: '#fff' }]}>{confirmLabel}</Text>
        )}
      </Pressable>
    </View>
  )
}

/** Modal centrado de confirmação (exclusão em catálogos MEI). */
export function MeiConfirmDialog ({
  visible,
  title,
  message,
  detail,
  onCancel,
  onConfirm,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  loading,
}: {
  visible: boolean
  title: string
  message: string
  detail?: string
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
}) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()
  const { width: windowWidth } = useWindowDimensions()
  const dialogWidth = Math.min(MEI_CONFIRM_MODAL_MAX_WIDTH, windowWidth - mfSpacing.lg * 2)
  const errorSoft = 'rgba(239, 68, 68, 0.14)'
  const errorRing = 'rgba(239, 68, 68, 0.35)'

  const handleBackdrop = () => {
    if (!loading) onCancel()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleBackdrop}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          flow.formModalOverlay,
          Platform.OS === 'web'
            ? ({
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: MEI_MODAL_WEB_Z_CONFIRM,
              } as ViewStyle)
            : null,
        ]}
      >
        <Pressable
          style={[
            flow.formModalBackdrop,
            { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.5)' },
          ]}
          onPress={handleBackdrop}
          accessibilityLabel="Fechar"
        />
        <View style={[flow.formModalShell, { width: dialogWidth }]} pointerEvents="box-none">
          <MfGlassCard
            padding="none"
            intensity="strong"
            techVariant="surface"
            style={[
              flow.formModalCard,
              mfTechPanelChrome(isDarkMode, 'surface'),
              Platform.OS === 'web'
                ? ({ boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)' } as ViewStyle)
                : null,
            ]}
          >
            <View style={flow.confirmModalBody}>
              <View
                style={[
                  flow.confirmIconRing,
                  { borderColor: errorRing, backgroundColor: errorSoft },
                ]}
              >
                <Ionicons name="trash-outline" size={28} color={theme.error} />
              </View>
              <Text style={[flow.confirmTitle, { color: theme.text }]}>{title}</Text>
              <Text style={[flow.confirmMessage, { color: theme.textSecondary }]}>{message}</Text>
              {detail ? (
                <Text
                  style={[flow.confirmDetail, { color: theme.text }]}
                  numberOfLines={3}
                >
                  {detail}
                </Text>
              ) : null}
              <Text style={[flow.confirmHint, { color: theme.textTertiary }]}>
                Esta ação não pode ser desfeita.
              </Text>
            </View>

            <View style={[flow.shellDivider, { backgroundColor: tokens.divider }]} />
            <View style={flow.formModalFooterBar}>
              <MeiConfirmDialogActions
                onCancel={onCancel}
                onConfirm={onConfirm}
                cancelLabel={cancelLabel}
                confirmLabel={confirmLabel}
                loading={loading}
              />
            </View>
          </MfGlassCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** Rodapé padrão do MeiFormSheet — Cancelar + ação principal, mesma altura. */
export function MeiFormSheetActions ({
  onCancel,
  onConfirm,
  cancelLabel = 'Cancelar',
  confirmLabel = 'Salvar',
  loading,
  disabled,
}: {
  onCancel: () => void
  onConfirm: () => void
  cancelLabel?: string
  confirmLabel?: string
  loading?: boolean
  disabled?: boolean
}) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()

  return (
    <View style={flow.formModalActionRow}>
      <Pressable
        onPress={onCancel}
        disabled={loading}
        style={({ pressed }) => [
          flow.modalActionBtn,
          mfTechInsetSurface(isDarkMode),
          pressed && flow.pressed,
          loading && { opacity: 0.65 },
        ]}
        accessibilityRole="button"
      >
        <Text style={[flow.modalActionBtnText, { color: theme.text }]}>{cancelLabel}</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={disabled || loading}
        style={({ pressed }) => [
          flow.modalActionBtn,
          { backgroundColor: tokens.accent },
          pressed && { opacity: 0.9 },
          (disabled || loading) && { opacity: 0.65 },
        ]}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={isDarkMode ? '#030508' : '#fff'} size="small" />
        ) : (
          <Text style={[flow.modalActionBtnText, { color: isDarkMode ? '#030508' : '#fff' }]}>
            {confirmLabel}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

export function MeiSearchBar ({
  value,
  onChangeText,
  onSearch,
  placeholder = 'Buscar',
}: {
  value: string
  onChangeText: (t: string) => void
  onSearch: () => void
  placeholder?: string
}) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()

  return (
    <View style={flow.searchRow}>
      <TextInput
        style={[flow.searchInput, mfTechInsetSurface(isDarkMode)]}
        placeholder={placeholder}
        placeholderTextColor={theme.placeholder}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSearch}
        returnKeyType="search"
      />
      <Pressable
        onPress={onSearch}
        style={({ pressed }) => [
          flow.searchBtn,
          { backgroundColor: tokens.accent },
          pressed && flow.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Buscar"
      >
        <Ionicons name="search" size={18} color={isDarkMode ? '#030508' : '#fff'} />
      </Pressable>
    </View>
  )
}

function MeiCatalogIconAction ({
  icon,
  color,
  label,
  onPress,
  isDarkMode,
  destructive = false,
}: {
  icon: 'pencil-outline' | 'trash-outline'
  color: string
  label: string
  onPress: () => void
  isDarkMode: boolean
  destructive?: boolean
}) {
  return (
    <Pressable
      onPress={(event) => {
        if (Platform.OS === 'web') {
          event?.stopPropagation?.()
        }
        onPress()
      }}
      style={({ pressed }) => [
        catalogActionBtn,
        mfTechInsetSurface(isDarkMode),
        destructive && { borderColor: 'rgba(239, 68, 68, 0.35)' },
        pressed && { opacity: 0.88 },
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  )
}

export function MeiCatalogListCard ({
  title,
  meta,
  onPress,
  onEdit,
  onDelete,
}: {
  title: string
  meta?: string
  /** Modo seleção (picker): card inteiro clicável, sem ações. */
  onPress?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()
  const isPicker = Boolean(onPress)

  const inner = (
    <MfGlassCard padding="md" intensity="medium" techVariant="surface" style={{ marginBottom: mfSpacing.sm }}>
      <View style={catalogCardRow} pointerEvents="box-none">
        <View style={{ flex: 1, minWidth: 0 }} pointerEvents="none">
          <Text style={{ ...mfTypography.bodyStrong, color: theme.text }} numberOfLines={2}>
            {title}
          </Text>
          {meta ? (
            <Text style={{ ...mfTypography.caption, color: tokens.accent, marginTop: 4 }}>
              {meta}
            </Text>
          ) : null}
        </View>
        {isPicker ? (
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        ) : (
          <View style={catalogActionsWrap} pointerEvents="box-none">
            {onEdit ? (
              <MeiCatalogIconAction
                icon="pencil-outline"
                color={tokens.accent}
                label="Editar"
                onPress={onEdit}
                isDarkMode={isDarkMode}
              />
            ) : null}
            {onDelete ? (
              <MeiCatalogIconAction
                icon="trash-outline"
                color={theme.error}
                label="Excluir"
                onPress={onDelete}
                isDarkMode={isDarkMode}
                destructive
              />
            ) : null}
          </View>
        )}
      </View>
    </MfGlassCard>
  )

  if (isPicker && onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          pressed && flow.pressed,
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
        ]}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    )
  }

  return inner
}

const catalogCardRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: mfSpacing.sm,
}

const catalogActionsWrap = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: mfSpacing.xs,
  zIndex: 2,
}

const catalogActionBtn = {
  width: 40,
  height: 40,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  borderRadius: mfRadius.md,
  borderWidth: 1,
}

/** Modal centrado para formulário (novo/editar cliente, serviço, etc.). */
export function MeiFormSheet ({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const dialogWidth = Math.min(MEI_FORM_MODAL_MAX_WIDTH, windowWidth - mfSpacing.lg * 2)
  const maxDialogHeight = Math.floor(
    Math.min(windowHeight * 0.88, windowHeight - mfSpacing.lg * 2),
  )

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          flow.formModalOverlay,
          Platform.OS === 'web'
            ? ({
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: MEI_MODAL_WEB_Z_FORM,
              } as ViewStyle)
            : null,
        ]}
      >
        <Pressable
          style={[
            flow.formModalBackdrop,
            { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.5)' },
          ]}
          onPress={onClose}
          accessibilityLabel="Fechar"
        />
        <View style={[flow.formModalShell, { width: dialogWidth }]} pointerEvents="box-none">
          <MfGlassCard
            padding="none"
            intensity="strong"
            techVariant="surface"
            style={[
              flow.formModalCard,
              mfTechPanelChrome(isDarkMode, 'surface'),
              {
                maxHeight: maxDialogHeight,
                flexDirection: 'column',
                overflow: 'hidden',
              },
              Platform.OS === 'web'
                ? ({ boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)' } as ViewStyle)
                : null,
            ]}
          >
            <View style={flow.formModalHeaderBar}>
              <View style={flow.formModalHeaderText}>
                <Text style={[flow.formModalTitle, { color: theme.text }]} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  flow.shellHeaderIcon,
                  mfTechInsetSurface(isDarkMode),
                  pressed && flow.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={[flow.shellDivider, { backgroundColor: tokens.divider }]} />

            <MfScrollView
              style={flow.formModalScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              hideLegalFooter
              contentContainerStyle={flow.formModalBody}
              {...(Platform.OS === 'web'
                ? { className: WEB_SCROLL_Y_CLASS, ...getWebScrollViewProps(theme) }
                : {})}
            >
              {children}
            </MfScrollView>

            <View style={[flow.shellDivider, { backgroundColor: tokens.divider }]} />
            <View style={[flow.formModalFooterBar, flow.formModalFooterPinned]}>{footer}</View>
          </MfGlassCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export function MeiCatalogDocTypeFilterChips ({
  value,
  onChange,
  allowedTypes,
}: {
  value: MeiCatalogDocFilter
  onChange: (v: MeiCatalogDocFilter) => void
  allowedTypes?: MeiDocType[]
}) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()
  const visibleFilters = useMemo(() => {
    const docTypes = allowedTypes?.length
      ? allowedTypes
      : (['NFSE', 'NFE', 'NFCE'] as MeiDocType[])
    const filters: MeiCatalogDocFilter[] = ['ALL']
    for (const dt of docTypes) {
      if (!filters.includes(dt)) filters.push(dt)
    }
    return filters.length > 1 ? filters : docTypes
  }, [allowedTypes])

  return (
    <View
      style={[flow.chipRow, { marginTop: 0, paddingHorizontal: mfSpacing.md }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Filtrar por tipo de documento"
    >
      {visibleFilters.map((dt) => {
        const active = value === dt
        return (
          <Pressable
            key={dt}
            onPress={() => onChange(dt)}
            style={[
              flow.chip,
              active
                ? { borderColor: tokens.accent, backgroundColor: tokens.accentSoft }
                : mfTechInsetSurface(isDarkMode),
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={CATALOG_DOC_FILTER_LABELS[dt]}
          >
            <Text
              style={[
                flow.chipText,
                { color: active ? tokens.accent : theme.textSecondary },
              ]}
            >
              {CATALOG_DOC_FILTER_LABELS[dt]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function MeiTypeChips ({
  value,
  onChange,
  allowedTypes,
}: {
  value: MeiDocType
  onChange: (v: MeiDocType) => void
  allowedTypes?: MeiDocType[]
}) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()
  const visibleTypes = allowedTypes?.length
    ? allowedTypes
    : (['NFSE', 'NFE', 'NFCE'] as MeiDocType[])

  return (
    <View style={flow.chipRow}>
      {visibleTypes.map((dt) => {
        const active = value === dt
        return (
          <Pressable
            key={dt}
            onPress={() => onChange(dt)}
            style={[
              flow.chip,
              active
                ? { borderColor: tokens.accent, backgroundColor: tokens.accentSoft }
                : mfTechInsetSurface(isDarkMode),
            ]}
          >
            <Text
              style={[
                flow.chipText,
                { color: active ? tokens.accent : theme.textSecondary },
              ]}
            >
              {dt}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Multi-select de tipos fiscais (ex.: NFSe + NFe no mesmo cliente). */
export function MeiTypeMultiChips ({
  value,
  onChange,
  allowedTypes,
}: {
  value: MeiDocType[]
  onChange: (v: MeiDocType[]) => void
  allowedTypes?: MeiDocType[]
}) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const flow = useMeiFlowStyles()
  const visibleTypes = allowedTypes?.length
    ? allowedTypes
    : (['NFSE', 'NFE', 'NFCE'] as MeiDocType[])
  const selected = new Set(value)

  return (
    <View style={flow.chipRow}>
      {visibleTypes.map((dt) => {
        const active = selected.has(dt)
        return (
          <Pressable
            key={dt}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`Tipo ${dt}`}
            onPress={() => {
              if (active) {
                onChange(value.filter((t) => t !== dt))
              } else {
                onChange([...value, dt])
              }
            }}
            style={[
              flow.chip,
              active
                ? { borderColor: tokens.accent, backgroundColor: tokens.accentSoft }
                : mfTechInsetSurface(isDarkMode),
            ]}
          >
            <Text
              style={[
                flow.chipText,
                { color: active ? tokens.accent : theme.textSecondary },
              ]}
            >
              {dt}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function createFlowStyles (
  theme: ReturnType<typeof useMfTheme>['theme'],
  isDarkMode: boolean,
  tokens: ReturnType<typeof getTechTokens>,
) {
  return StyleSheet.create({
    safe: { flex: 1, minHeight: 0 },
    shellHeaderWrap: {
      paddingTop: mfSpacing.sm,
    },
    shellHeaderBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: mfSpacing.md,
      paddingBottom: mfSpacing.md,
      minHeight: 52,
      gap: mfSpacing.sm,
    },
    shellHeaderIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: mfRadius.md,
      flexShrink: 0,
    },
    shellHeaderIconSpacer: {
      width: 40,
      height: 40,
      flexShrink: 0,
    },
    shellDivider: {
      height: StyleSheet.hairlineWidth,
      minHeight: 1,
      alignSelf: 'stretch',
    },
    headerTitle: {
      flex: 1,
      ...mfTypography.subtitle,
      textAlign: 'center',
      minWidth: 0,
    },
    pressed: { opacity: 0.88 },
    tabsBar: { marginHorizontal: mfSpacing.md, marginTop: mfSpacing.sm },
    segmentRow: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.sm,
    },
    segment: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    segmentText: { ...mfTypography.caption, fontWeight: '700' },
    scroll: { flex: 1 },
    scrollContent: {
      padding: mfSpacing.md,
      paddingBottom: mfSpacing.xxl,
      gap: mfSpacing.md,
    },
    hero: {
      padding: mfSpacing.md,
      borderRadius: mfRadius.lg,
      marginBottom: mfSpacing.sm,
    },
    heroTitle: { ...mfTypography.titleLarge },
    footer: {
      padding: mfSpacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: isDarkMode ? 'rgba(3,5,8,0.85)' : 'rgba(255,255,255,0.92)',
    },
    field: { marginBottom: 0 },
    label: { ...mfTypography.caption, fontWeight: '600', marginBottom: 6 },
    input: {
      ...mfTypography.body,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: mfRadius.md,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: 12,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
    },
    banner: {
      borderLeftWidth: 3,
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      marginBottom: mfSpacing.sm,
    },
    bannerText: { ...mfTypography.caption, lineHeight: 18 },
    linkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      marginBottom: mfSpacing.sm,
    },
    linkBtnText: { ...mfTypography.bodyStrong, flex: 1 },
    primaryBtn: {
      paddingVertical: 12,
      paddingHorizontal: mfSpacing.lg,
      borderRadius: mfRadius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    primaryBtnFooter: {
      flex: 1,
      minWidth: 0,
      maxHeight: 44,
      paddingVertical: 0,
    },
    primaryBtnText: { ...mfTypography.bodyStrong, fontWeight: '700' },
    secondaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: mfSpacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryBtnFooter: {
      flex: 1,
      minWidth: 0,
      maxHeight: 44,
      paddingVertical: 0,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
    },
    secondaryBtnText: { ...mfTypography.bodyStrong },
    searchRow: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.sm,
      alignItems: 'center',
    },
    searchInput: {
      flex: 1,
      height: 44,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: 0,
      borderRadius: mfRadius.md,
      color: theme.inputText,
      fontSize: 15,
    },
    searchBtn: {
      width: 44,
      height: 44,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    formModalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: mfSpacing.lg,
      paddingVertical: mfSpacing.xl,
    },
    formModalBackdrop: { ...StyleSheet.absoluteFillObject },
    formModalShell: {
      zIndex: 1,
      maxHeight: '92%',
    },
    formModalCard: {
      width: '100%',
      borderRadius: mfRadius.xl,
      overflow: 'hidden',
    },
    formModalHeaderBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.lg,
      paddingBottom: mfSpacing.md,
    },
    formModalHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    formModalTitle: {
      ...mfTypography.subtitle,
      fontSize: 18,
    },
    formModalScroll: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
    },
    formModalBody: {
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.lg,
      paddingBottom: mfSpacing.xl,
      gap: mfSpacing.md,
    },
    formModalFooterBar: {
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.lg,
    },
    formModalFooterPinned: {
      flexShrink: 0,
    },
    confirmModalBody: {
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.lg,
      paddingBottom: mfSpacing.md,
      alignItems: 'center',
    },
    confirmIconRing: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: mfSpacing.md,
    },
    confirmTitle: {
      ...mfTypography.subtitle,
      fontSize: 18,
      textAlign: 'center',
      marginBottom: mfSpacing.sm,
    },
    confirmMessage: {
      ...mfTypography.body,
      textAlign: 'center',
      marginBottom: mfSpacing.sm,
    },
    confirmDetail: {
      ...mfTypography.caption,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: mfSpacing.sm,
      paddingHorizontal: mfSpacing.xs,
    },
    confirmHint: {
      ...mfTypography.caption,
      textAlign: 'center',
    },
    formModalActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      width: '100%',
    },
    modalActionBtn: {
      flex: 1,
      height: 44,
      minWidth: 0,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    modalActionBtnText: {
      ...mfTypography.bodyStrong,
      fontWeight: '700',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
      marginTop: mfSpacing.sm,
      marginBottom: mfSpacing.xs,
    },
    formSectionLabel: {
      ...mfTypography.caption,
      fontWeight: '600',
      marginTop: mfSpacing.xs,
      marginBottom: mfSpacing.xs,
    },
    chip: {
      paddingHorizontal: mfSpacing.md,
      paddingVertical: 8,
      borderRadius: mfRadius.md,
      borderWidth: 1,
    },
    chipText: { fontSize: 13, fontWeight: '700' },
    listBody: { flex: 1, minHeight: 0 },
    listPad: { flex: 1, paddingHorizontal: mfSpacing.md },
    hint: {
      ...mfTypography.caption,
      color: theme.textTertiary,
      textAlign: 'center',
      padding: mfSpacing.md,
    },
    empty: {
      ...mfTypography.body,
      color: theme.textSecondary,
      textAlign: 'center',
      padding: mfSpacing.xl,
    },
    headerAdd: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: mfRadius.md,
      backgroundColor: tokens.accentSoft,
      borderWidth: 1,
      borderColor: tokens.accentMuted,
    },
  })
}
