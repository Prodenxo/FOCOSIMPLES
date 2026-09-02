import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MfConfirmDialog } from '@/components/ui/MfConfirmDialog'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { FiscalConfigSelectField } from '@/components/fiscal-configuration/FiscalConfigSelectField'
import { FiscalProductGroupSelectField } from '@/components/fiscal-configuration/FiscalProductGroupSelectField'
import { FiscalGroupInheritanceBanner } from '@/components/fiscal-configuration/FiscalGroupInheritanceBanner'
import { FISCAL_GROUP_CREATE_OPTION } from '@/lib/fiscalConfiguration/fiscalGroupUi'
import { CfopAutocompleteField } from '@/components/fiscal-configuration/CfopAutocompleteField'
import { EstablishmentContextBanner } from '@/components/fiscal-configuration/EstablishmentContextBanner'
import { ScenarioApplicationFields } from '@/components/fiscal-configuration/ScenarioApplicationFields'
import { FiscalEstablishmentSelectField } from '@/components/fiscal-configuration/FiscalEstablishmentSelectField'
import { FiscalStatusBadge } from '@/components/fiscal-configuration/FiscalStatusBadge'
import { FiscalFieldInput, FiscalFormSection, FiscalComputedField } from '@/components/fiscal-configuration/fiscalFormFields'
import {
  CURRENT_OPERATION_ST_OPTIONS,
  ITEM_SOURCE_OPTIONS,
  ORIGEM_MERCADORIA_OPTIONS,
  PIS_COFINS_MODE_OPTIONS,
  PRIOR_ST_STATUS_OPTIONS,
  formatCapabilityMessage,
  labelRuleStatus,
} from '@/lib/fiscalConfiguration/labels'
import { shouldShowStFields, deriveIcmsGroupFromCsosn, displayIcmsGroupForForm } from '@/lib/fiscalConfiguration/ruleFormMapper'
import type {
  AccountantApprovedRule,
  FiscalProductGroup,
  ProductFiscalConfigForm,
  ProductFiscalUiStatus,
  RulePreviewResult,
} from '@/lib/fiscalConfiguration/types'
import type { CommercialProductForm } from '@/hooks/useAccountantFiscalProducts'
import type { AccountantEstablishment } from '@/services/accountantClientsService'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type DrawerTab = 'produto' | 'fiscal'

type Props = {
  visible: boolean
  productLabel: string
  clientLabel?: string | null
  establishments?: AccountantEstablishment[]
  establishmentId?: string | null
  establishmentStatus?: 'OK' | 'NO_FISCAL_ESTABLISHMENT' | null
  onEstablishmentChange?: (establishmentId: string) => void
  catalogCodigo: string
  catalogNcm: string
  catalogCest: string
  catalogUnidade: string
  fiscalStatus: ProductFiscalUiStatus
  form: ProductFiscalConfigForm
  onChange: (patch: Partial<ProductFiscalConfigForm>) => void
  rule: AccountantApprovedRule | null
  preview: RulePreviewResult | null
  groups: FiscalProductGroup[]
  groupProductCounts?: Record<string, number>
  onManageGroups?: () => void
  onCreateGroupRequest?: () => void
  onGroupFieldChange?: (value: string, patch: (v: string) => void) => void
  productId?: string | null
  rules?: AccountantApprovedRule[]
  canEdit: boolean
  canApprove: boolean
  saving: boolean
  loading: boolean
  onClose: () => void
  onSaveDraft: () => void
  onApprove: (justification?: string) => void
  onNewVersion: () => void
  commercialForm?: CommercialProductForm
  onCommercialChange?: (patch: Partial<CommercialProductForm>) => void
  onSaveCommercial?: () => void
}

function MetaChip({ label, value }: { label: string; value: string }) {
  const { theme, isDarkMode } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: mfSpacing.sm,
          paddingVertical: 4,
          borderRadius: mfRadius.pill,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.borderLight,
        },
        label: { ...mfTypography.caption, color: theme.textTertiary, fontWeight: '600' },
        value: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
      }),
    [isDarkMode, theme],
  )
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

function DrawerTabBar({
  active,
  onChange,
  fiscalDisabled,
  compact = false,
}: {
  active: DrawerTab
  onChange: (tab: DrawerTab) => void
  fiscalDisabled?: boolean
  compact?: boolean
}) {
  const { theme, isDarkMode } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: 'row',
          gap: mfSpacing.sm,
          padding: 5,
          borderRadius: mfRadius.lg,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : theme.backgroundMuted,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.borderLight,
        },
        tab: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mfSpacing.xs,
          paddingVertical: mfSpacing.sm + 2,
          paddingHorizontal: mfSpacing.md,
          borderRadius: mfRadius.md,
          borderWidth: 1,
          borderColor: 'transparent',
          minHeight: 40,
        },
        tabActive: {
          backgroundColor: isDarkMode ? theme.card : theme.surface,
          borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.35)' : 'rgba(14, 116, 144, 0.18)',
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: isDarkMode
                  ? '0 4px 14px rgba(0,0,0,0.28)'
                  : '0 4px 12px rgba(15, 23, 42, 0.08)',
              } as Record<string, string>)
            : {}),
        },
        tabIdle: {
          backgroundColor: 'transparent',
        },
        tabDisabled: { opacity: 0.45 },
        text: { ...mfTypography.caption, fontWeight: '700', color: theme.textSecondary },
        textActive: { color: theme.primary },
      }),
    [isDarkMode, theme],
  )

  const tabs: { id: DrawerTab; label: string; shortLabel: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'produto', label: 'Produto', shortLabel: 'Produto', icon: 'cube-outline' },
    { id: 'fiscal', label: 'Configuração fiscal', shortLabel: 'Fiscal', icon: 'document-text-outline' },
  ]

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        const disabled = tab.id === 'fiscal' && fiscalDisabled
        const label = compact ? tab.shortLabel : tab.label
        return (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              isActive ? styles.tabActive : styles.tabIdle,
              disabled ? styles.tabDisabled : null,
            ]}
            onPress={() => !disabled && onChange(tab.id)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive, disabled }}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={isActive ? theme.primary : theme.textSecondary}
            />
            <Text style={[styles.text, isActive ? styles.textActive : null]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export function FiscalProductConfigDrawer({
  visible,
  productLabel,
  clientLabel,
  establishments = [],
  establishmentId,
  establishmentStatus,
  onEstablishmentChange,
  catalogCodigo,
  catalogNcm,
  catalogCest,
  catalogUnidade,
  fiscalStatus,
  form,
  onChange,
  rule,
  preview,
  groups,
  groupProductCounts,
  onManageGroups,
  onCreateGroupRequest,
  onGroupFieldChange,
  productId,
  rules = [],
  canEdit,
  canApprove,
  saving,
  loading,
  onClose,
  onSaveDraft,
  onApprove,
  onNewVersion,
  commercialForm,
  onCommercialChange,
  onSaveCommercial,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const { width, height } = useWindowDimensions()
  const isDesktop = width >= 900
  const modalWidth = Math.min(isDesktop ? 720 : 680, width - (isDesktop ? 48 : 20))
  const modalMaxHeight = Math.min(isDesktop ? 860 : height - 32, height * 0.9)
  const compactTabs = width < 560
  const [approveOpen, setApproveOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DrawerTab>('produto')

  const isApproved = rule?.status === 'APPROVED'
  const readOnly = isApproved || !canEdit
  const capabilityBlocked = preview?.capability?.executable === false
  const capabilityMessage = formatCapabilityMessage(preview?.capability ?? null)
  const fiscalContextReady = Boolean(establishmentId) && establishmentStatus === 'OK'
  const hasPersistedDraft = Boolean(rule?.id && rule?.status === 'DRAFT')
  const approveDisabled = saving || loading || !hasPersistedDraft
  const hasCommercialEditor = Boolean(commercialForm && onCommercialChange)

  useEffect(() => {
    if (visible) setActiveTab('produto')
  }, [visible, productLabel])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: isDesktop ? mfSpacing.lg : mfSpacing.sm,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.62)' : 'rgba(15, 23, 42, 0.38)',
          ...(Platform.OS === 'web'
            ? ({ backdropFilter: 'blur(8px)' } as Record<string, string>)
            : {}),
        },
        panel: {
          width: modalWidth,
          maxHeight: modalMaxHeight,
          flexDirection: 'column',
          backgroundColor: theme.background,
          borderRadius: mfRadius.xl,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : theme.border,
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: isDarkMode
                  ? '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)'
                  : '0 24px 64px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.06)',
              } as Record<string, string>)
            : {}),
        },
        header: {
          paddingTop: mfSpacing.lg,
          paddingHorizontal: mfSpacing.lg,
          paddingBottom: mfSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          backgroundColor: isDarkMode ? theme.card : theme.surface,
          gap: mfSpacing.md,
        },
        headerTop: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: mfSpacing.md,
        },
        headerContent: { flex: 1, gap: mfSpacing.sm, paddingRight: mfSpacing.sm },
        closeBtn: {
          width: 36,
          height: 36,
          borderRadius: mfRadius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : theme.backgroundMuted,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.borderLight,
          marginTop: 2,
        },
        headerMain: { gap: mfSpacing.sm },
        eyebrow: {
          ...mfTypography.caption,
          color: theme.textTertiary,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        },
        title: { ...mfTypography.title, color: theme.text, letterSpacing: -0.3 },
        headerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: mfSpacing.xs },
        body: {
          paddingHorizontal: mfSpacing.lg,
          paddingTop: mfSpacing.md,
          paddingBottom: mfSpacing.xl,
          gap: mfSpacing.lg,
        },
        scrollArea: {
          flexGrow: 1,
          flexShrink: 1,
          maxHeight: Math.max(240, modalMaxHeight - 240),
        },
        fieldGrid: {
          flexDirection: isDesktop ? 'row' : 'column',
          gap: mfSpacing.md,
        },
        fieldGridCol: { flex: 1, gap: mfSpacing.md },
        footer: {
          paddingHorizontal: mfSpacing.lg,
          paddingTop: mfSpacing.md,
          paddingBottom: Platform.OS === 'ios' ? mfSpacing.xl : mfSpacing.lg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          backgroundColor: isDarkMode ? theme.card : theme.surface,
          gap: mfSpacing.sm,
        },
        footerHint: {
          ...mfTypography.caption,
          color: theme.textTertiary,
          lineHeight: 16,
          textAlign: 'center',
        },
        footerActions: {
          flexDirection: isDesktop ? 'row' : 'column-reverse',
          gap: mfSpacing.sm,
        },
        btn: {
          borderRadius: mfRadius.md,
          paddingVertical: mfSpacing.sm + 4,
          paddingHorizontal: mfSpacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          flex: isDesktop ? 1 : undefined,
        },
        btnPrimary: { backgroundColor: theme.primary },
        btnGhost: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : theme.border,
        },
        btnSecondary: {
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : theme.backgroundMuted,
          borderWidth: 1,
          borderColor: theme.borderLight,
        },
        btnTextPrimary: { ...mfTypography.bodyStrong, color: '#fff' },
        btnTextGhost: { ...mfTypography.bodyStrong, color: theme.textSecondary },
        btnTextSecondary: { ...mfTypography.bodyStrong, color: theme.text },
        meta: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 18 },
        alert: {
          borderWidth: 1,
          borderColor: theme.error,
          backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : theme.errorLight,
          borderRadius: mfRadius.md,
          padding: mfSpacing.md,
          flexDirection: 'row',
          gap: mfSpacing.sm,
          alignItems: 'flex-start',
        },
        alertText: { ...mfTypography.caption, color: theme.error, flex: 1, lineHeight: 18 },
        loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: mfSpacing.xl },
        emptyFiscal: {
          alignItems: 'center',
          paddingVertical: mfSpacing.xl,
          paddingHorizontal: mfSpacing.lg,
          gap: mfSpacing.sm,
          borderRadius: mfRadius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          borderStyle: 'dashed',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : theme.backgroundMuted,
        },
        emptyIcon: {
          width: 48,
          height: 48,
          borderRadius: mfRadius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : theme.surface,
        },
        emptyTitle: { ...mfTypography.bodyStrong, color: theme.text, textAlign: 'center' },
        emptyText: { ...mfTypography.caption, color: theme.textSecondary, textAlign: 'center', lineHeight: 18 },
      }),
    [isDarkMode, isDesktop, modalMaxHeight, modalWidth, theme, width],
  )

  const groupOptions = [
    { value: '', label: 'Sem grupo fiscal' },
    ...groups.filter((g) => g.status === 'ACTIVE').map((g) => ({ value: g.id, label: g.name })),
  ]
  const selectedGroupName = groupOptions.find(
    (g) => g.value === (commercialForm?.fiscalProductGroupId ?? ''),
  )?.label ?? null

  const handleCommercialGroupChange = (value: string) => {
    if (!onCommercialChange) return
    if (value === FISCAL_GROUP_CREATE_OPTION) {
      onCreateGroupRequest?.()
      return
    }
    if (onGroupFieldChange) {
      onGroupFieldChange(value, (v) => onCommercialChange({ fiscalProductGroupId: v }))
      return
    }
    onCommercialChange({ fiscalProductGroupId: value })
  }

  const approveSummary = [
    `CFOP ${form.cfop || '—'}`,
    `CSOSN ${form.csosn || '—'}`,
    `PIS CST ${form.pisCst}`,
    `COFINS CST ${form.cofinsCst}`,
  ].join(' · ')

  const displayCodigo = commercialForm?.codigo || catalogCodigo || '—'
  const displayNcm = commercialForm?.ncm || catalogNcm || '—'
  const displayUnidade = commercialForm?.unidade || catalogUnidade || 'UN'

  const renderCommercialTab = () => {
    if (hasCommercialEditor) {
      return (
        <FiscalFormSection title="Dados comerciais">
          <FiscalFieldInput
            label="Descrição"
            value={commercialForm!.discriminacao}
            onChangeText={(v) => onCommercialChange!({ discriminacao: v })}
            disabled={!canEdit}
            placeholder="Nome do produto na NF-e"
          />
          <View style={styles.fieldGrid}>
            <View style={styles.fieldGridCol}>
              <FiscalFieldInput
                label="Código / SKU"
                value={commercialForm!.codigo}
                onChangeText={(v) => onCommercialChange!({ codigo: v })}
                disabled={!canEdit}
                placeholder="Ex.: CAM-001"
              />
            </View>
            <View style={styles.fieldGridCol}>
              <FiscalFieldInput
                label="Unidade"
                value={commercialForm!.unidade}
                onChangeText={(v) => onCommercialChange!({ unidade: v })}
                disabled={!canEdit}
                placeholder="UN"
              />
            </View>
          </View>
          <View style={styles.fieldGrid}>
            <View style={styles.fieldGridCol}>
              <FiscalFieldInput
                label="NCM"
                value={commercialForm!.ncm}
                onChangeText={(v) => onCommercialChange!({ ncm: v })}
                disabled={!canEdit}
                keyboardType="numeric"
                placeholder="8 dígitos"
              />
            </View>
            <View style={styles.fieldGridCol}>
              <FiscalFieldInput
                label="CEST"
                value={commercialForm!.cest}
                onChangeText={(v) => onCommercialChange!({ cest: v })}
                disabled={!canEdit}
                keyboardType="numeric"
                placeholder="Opcional"
              />
            </View>
          </View>
          <FiscalFieldInput
            label="Preço padrão"
            value={commercialForm!.valor_sugerido}
            onChangeText={(v) => onCommercialChange!({ valor_sugerido: v })}
            disabled={!canEdit}
            keyboardType="numeric"
            placeholder="0,00"
          />
          <FiscalProductGroupSelectField
            value={commercialForm!.fiscalProductGroupId}
            groups={groups}
            groupProductCounts={groupProductCounts}
            onChange={handleCommercialGroupChange}
            disabled={!canEdit}
            onManageGroups={onManageGroups}
            showEmptyHint={groups.filter((g) => g.status === 'ACTIVE').length === 0}
            onCreateFirstGroup={onCreateGroupRequest}
            helpText="Organização lógica do produto. Não define tributação automaticamente."
          />
        </FiscalFormSection>
      )
    }

    return (
      <FiscalFormSection title="Dados comerciais">
        <Text style={styles.meta}>Descrição: {productLabel}</Text>
        <View style={styles.headerMeta}>
          <MetaChip label="Código" value={displayCodigo} />
          <MetaChip label="NCM" value={displayNcm} />
          <MetaChip label="Un." value={displayUnidade} />
          {catalogCest ? <MetaChip label="CEST" value={catalogCest} /> : null}
        </View>
      </FiscalFormSection>
    )
  }

  const renderFiscalTab = () => {
    if (!fiscalContextReady) {
      return (
        <View style={styles.emptyFiscal}>
          <View style={styles.emptyIcon}>
            <Ionicons name="business-outline" size={22} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Selecione o estabelecimento fiscal</Text>
          <Text style={styles.emptyText}>
            Escolha o CNPJ emissor para configurar ICMS, ST, PIS e COFINS deste produto.
          </Text>
          {onEstablishmentChange ? (
            <View style={{ width: '100%', marginTop: mfSpacing.sm }}>
              <FiscalEstablishmentSelectField
                establishments={establishments}
                selectedEstablishmentId={establishmentId ?? null}
                onSelectEstablishment={onEstablishmentChange}
                disabled={!canEdit}
                establishmentStatus={establishmentStatus}
                clientLabel={clientLabel}
              />
            </View>
          ) : null}
        </View>
      )
    }

    return (
      <>
        {productId ? (
          <FiscalGroupInheritanceBanner
            productId={productId}
            fiscalProductGroupId={commercialForm?.fiscalProductGroupId || null}
            fiscalProductGroupName={
              commercialForm?.fiscalProductGroupId ? selectedGroupName : null
            }
            establishmentId={establishmentId ?? null}
            rules={rules}
          />
        ) : null}

        <EstablishmentContextBanner
          establishmentId={establishmentId}
          establishmentLabel={clientLabel}
          issuerUf={establishments.find((e) => e.establishmentId === establishmentId)?.issuerUf ?? form.issuerUf}
          clientLabel={clientLabel}
        />

        <FiscalFormSection title="Mercadoria">
          <FiscalConfigSelectField
            label="Origem da mercadoria"
            value={form.origemMercadoria}
            options={ORIGEM_MERCADORIA_OPTIONS}
            onChange={(v) => onChange({ origemMercadoria: v })}
            disabled={readOnly}
          />
          <FiscalConfigSelectField
            label="Origem comercial do item"
            value={form.itemSource}
            options={ITEM_SOURCE_OPTIONS}
            onChange={(v) => onChange({ itemSource: v })}
            disabled={readOnly}
          />
          <FiscalConfigSelectField
            label="Situação ST anterior"
            value={form.priorStStatus}
            options={PRIOR_ST_STATUS_OPTIONS}
            onChange={(v) => onChange({ priorStStatus: v })}
            disabled={readOnly}
            helpText="Informe conforme evidência fiscal disponível."
          />
        </FiscalFormSection>

        <FiscalFormSection title="Condições de aplicação">
          <ScenarioApplicationFields form={form} onChange={onChange} readOnly={readOnly} />
        </FiscalFormSection>

        <FiscalFormSection title="Tratamento fiscal">
          <CfopAutocompleteField
            value={form.cfop}
            onChange={(code) => onChange({ cfop: code })}
            disabled={readOnly}
            operationScope={form.operationScope}
          />
          <View style={styles.fieldGrid}>
            <View style={styles.fieldGridCol}>
              <FiscalFieldInput
                label="CSOSN"
                value={form.csosn}
                onChangeText={(v) => onChange({ csosn: v, icmsGroup: deriveIcmsGroupFromCsosn(v) })}
                disabled={readOnly}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.fieldGridCol}>
              <FiscalComputedField
                label="Grupo ICMS (automático)"
                value={displayIcmsGroupForForm(form)}
                hint="Calculado a partir do CSOSN."
              />
            </View>
          </View>
          <Text style={styles.meta}>
            Para mudar o grupo ICMS, altere o CSOSN e clique em Salvar rascunho fiscal antes de aprovar.
          </Text>
          <FiscalConfigSelectField
            label="ST nesta operação"
            value={form.currentOperationSt}
            options={CURRENT_OPERATION_ST_OPTIONS}
            onChange={(v) => onChange({ currentOperationSt: v })}
            disabled={readOnly}
          />
          {shouldShowStFields(form) ? (
            <Text style={styles.meta}>
              Parâmetros de ST: configure conforme orientação contábil quando CSOSN ou evidência exigir ST.
            </Text>
          ) : null}
          <View style={styles.fieldGrid}>
            <View style={styles.fieldGridCol}>
              <FiscalFieldInput
                label="PIS — CST"
                value={form.pisCst}
                onChangeText={(v) => onChange({ pisCst: v })}
                disabled={readOnly}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.fieldGridCol}>
              <FiscalFieldInput
                label="COFINS — CST"
                value={form.cofinsCst}
                onChangeText={(v) => onChange({ cofinsCst: v })}
                disabled={readOnly}
                keyboardType="numeric"
              />
            </View>
          </View>
          <FiscalConfigSelectField
            label="PIS — modo de cálculo"
            value={form.pisCalculationMode}
            options={PIS_COFINS_MODE_OPTIONS}
            onChange={(v) => onChange({ pisCalculationMode: v as ProductFiscalConfigForm['pisCalculationMode'] })}
            disabled={readOnly}
          />
          {form.pisCalculationMode === 'ALIQ_PERCENT' ? (
            <FiscalFieldInput
              label="PIS — percentual"
              value={form.pisPercentual}
              onChangeText={(v) => onChange({ pisPercentual: v })}
              disabled={readOnly}
              keyboardType="numeric"
            />
          ) : null}
          <FiscalConfigSelectField
            label="COFINS — modo de cálculo"
            value={form.cofinsCalculationMode}
            options={PIS_COFINS_MODE_OPTIONS}
            onChange={(v) => onChange({ cofinsCalculationMode: v as ProductFiscalConfigForm['cofinsCalculationMode'] })}
            disabled={readOnly}
          />
          {form.cofinsCalculationMode === 'ALIQ_PERCENT' ? (
            <FiscalFieldInput
              label="COFINS — percentual"
              value={form.cofinsPercentual}
              onChangeText={(v) => onChange({ cofinsPercentual: v })}
              disabled={readOnly}
              keyboardType="numeric"
            />
          ) : null}
        </FiscalFormSection>

        <FiscalFormSection title="Governança">
          <Text style={styles.meta}>Status da regra: {labelRuleStatus(rule?.status ?? null)}</Text>
          {isApproved ? (
            <>
              <Text style={styles.meta}>Versão: {rule?.version ?? '—'}</Text>
              <Text style={styles.meta}>
                Aprovado em: {rule?.approvedAt ? new Date(rule.approvedAt).toLocaleString('pt-BR') : '—'}
              </Text>
              <Text style={styles.meta}>
                Referência: {rule?.sourceLegalReference || rule?.justification || '—'}
              </Text>
            </>
          ) : (
            <>
              <FiscalFieldInput
                label="Nome interno (opcional)"
                value={form.name}
                onChangeText={(v) => onChange({ name: v })}
                disabled={readOnly}
              />
              <FiscalFieldInput
                label="Referência / observação fiscal"
                value={form.sourceLegalReference}
                onChangeText={(v) => onChange({ sourceLegalReference: v })}
                disabled={readOnly}
              />
            </>
          )}
        </FiscalFormSection>
      </>
    )
  }

  const renderFooterPrimary = () => {
    if (isApproved) {
      if (!canEdit) return null
      return (
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onNewVersion} disabled={saving}>
          <Text style={styles.btnTextPrimary}>Criar nova versão</Text>
        </TouchableOpacity>
      )
    }

    if (activeTab === 'produto' && canEdit && onSaveCommercial) {
      return (
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onSaveCommercial} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnTextPrimary}>Salvar produto</Text>
          )}
        </TouchableOpacity>
      )
    }

    if (activeTab === 'fiscal' && canEdit && fiscalContextReady) {
      return (
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onSaveDraft} disabled={saving || loading}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnTextPrimary}>Salvar rascunho fiscal</Text>
          )}
        </TouchableOpacity>
      )
    }

    return null
  }

  const renderFooterSecondary = () => {
    if (isApproved) return null

    if (activeTab === 'fiscal' && canApprove && hasPersistedDraft && fiscalContextReady) {
      return (
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary, approveDisabled ? { opacity: 0.5 } : null]}
          onPress={() => setApproveOpen(true)}
          disabled={approveDisabled}
          accessibilityRole="button"
        >
          <Text style={styles.btnTextSecondary}>Aprovar</Text>
        </TouchableOpacity>
      )
    }

    return null
  }

  const footerHint = (() => {
    if (isApproved) return null
    if (activeTab === 'fiscal' && canApprove && fiscalContextReady && !hasPersistedDraft) {
      return 'Salve o rascunho fiscal antes de aprovar a configuração.'
    }
    if (activeTab === 'fiscal' && canApprove && hasPersistedDraft && capabilityBlocked && capabilityMessage) {
      return capabilityMessage
    }
    if (activeTab === 'produto') {
      return 'Depois de salvar, configure tributação na aba Configuração fiscal.'
    }
    return null
  })()

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar modal">
        <Pressable style={styles.panel} onPress={() => undefined}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerContent}>
                <Text style={styles.eyebrow}>Configuração de produto</Text>
                <Text style={styles.title} numberOfLines={2}>
                  {productLabel}
                </Text>
                <View style={styles.headerMeta}>
                  <MetaChip label="Código" value={displayCodigo} />
                  <MetaChip label="NCM" value={displayNcm} />
                  <FiscalStatusBadge status={fiscalStatus} />
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <DrawerTabBar
              active={activeTab}
              onChange={setActiveTab}
              fiscalDisabled={false}
              compact={compactTabs}
            />
          </View>

          {loading ? (
            <View style={[styles.loadingWrap, { minHeight: 220 }]}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <MfScrollView style={styles.scrollArea} contentContainerStyle={styles.body}>
              {capabilityBlocked && capabilityMessage && activeTab === 'fiscal' ? (
                <View style={styles.alert}>
                  <Ionicons name="warning-outline" size={18} color={theme.error} />
                  <Text style={styles.alertText}>{capabilityMessage}</Text>
                </View>
              ) : null}

              {activeTab === 'produto' ? renderCommercialTab() : renderFiscalTab()}
            </MfScrollView>
          )}

          <View style={styles.footer}>
            {footerHint ? <Text style={styles.footerHint}>{footerHint}</Text> : null}
            <View style={styles.footerActions}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
                <Text style={styles.btnTextGhost}>Fechar</Text>
              </TouchableOpacity>
              {renderFooterSecondary()}
              {renderFooterPrimary()}
            </View>
          </View>
        </Pressable>
      </Pressable>

      <MfConfirmDialog
        visible={approveOpen}
        variant="confirm"
        confirmIntent="primary"
        title="Aprovar configuração fiscal"
        message={
          capabilityBlocked && capabilityMessage
            ? `${capabilityMessage} Confirme mesmo assim se o tratamento fiscal estiver correto para este produto.`
            : 'Confirme o tratamento fiscal antes de liberar emissão para este produto.'
        }
        detail={[
          approveSummary,
          capabilityBlocked && capabilityMessage ? `Atenção: ${capabilityMessage}` : null,
        ].filter(Boolean).join('\n\n')}
        confirmLabel="Aprovar"
        cancelLabel="Voltar"
        loading={saving}
        onCancel={() => setApproveOpen(false)}
        onConfirm={() => {
          setApproveOpen(false)
          onApprove(form.sourceLegalReference || undefined)
        }}
      />
    </Modal>
  )
}
