import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AddFiscalScenarioButton } from '@/components/fiscal-configuration/AddFiscalScenarioButton'
import { FiscalConfigSelectField } from '@/components/fiscal-configuration/FiscalConfigSelectField'
import { FiscalProductGroupSelectField } from '@/components/fiscal-configuration/FiscalProductGroupSelectField'
import { FiscalGroupInheritanceBanner } from '@/components/fiscal-configuration/FiscalGroupInheritanceBanner'
import { FISCAL_GROUP_CREATE_OPTION } from '@/lib/fiscalConfiguration/fiscalGroupUi'
import { FiscalScenarioEditor } from '@/components/fiscal-configuration/FiscalScenarioEditor'
import { FiscalStatusBadge } from '@/components/fiscal-configuration/FiscalStatusBadge'
import { FiscalFormSection, FiscalFieldInput } from '@/components/fiscal-configuration/fiscalFormFields'
import { useMfTheme } from '@/components/ui/useMfTheme'
import {
  ITEM_SOURCE_OPTIONS,
  ORIGEM_MERCADORIA_OPTIONS,
  PRIOR_ST_STATUS_OPTIONS,
} from '@/lib/fiscalConfiguration/labels'
import type { FiscalProductGroup } from '@/lib/fiscalConfiguration/types'
import type { FiscalScenarioDraft } from '@/lib/fiscalConfiguration/scenarioTypes'
import type { ScenarioAppliesKind } from '@/lib/fiscalConfiguration/scenarioApplicationUi'
import type { CommercialProductForm } from '@/hooks/useAccountantFiscalProducts'
import { FiscalEstablishmentSelectField } from '@/components/fiscal-configuration/FiscalEstablishmentSelectField'
import type { AccountantEstablishment } from '@/services/accountantClientsService'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type MerchandiseFacts = {
  origemMercadoria: string
  itemSource: string
  priorStStatus: string
}

type Props = {
  clientLabel: string | null
  establishments: AccountantEstablishment[]
  establishmentId: string | null
  establishmentStatus?: 'OK' | 'NO_FISCAL_ESTABLISHMENT' | null
  onEstablishmentChange: (establishmentId: string) => void
  commercialForm: CommercialProductForm
  onCommercialChange: (patch: Partial<CommercialProductForm>) => void
  merchandiseFacts: MerchandiseFacts
  onMerchandiseChange: (patch: Partial<MerchandiseFacts>) => void
  scenarios: FiscalScenarioDraft[]
  activeScenarioId: string | null
  onSelectScenario: (id: string) => void
  onAddScenario: (scenarioApplies?: ScenarioAppliesKind) => void
  onRemoveScenario: (id: string) => void
  onUpdateScenario: (id: string, patch: Partial<FiscalScenarioDraft['form']>) => void
  groups: FiscalProductGroup[]
  groupProductCounts?: Record<string, number>
  onManageGroups?: () => void
  onCreateGroupRequest?: () => void
  onGroupFieldChange?: (value: string, patch: (v: string) => void) => void
  productId?: string | null
  rules?: import('@/lib/fiscalConfiguration/types').AccountantApprovedRule[]
  canEdit: boolean
  fiscalSectionsEnabled: boolean
  saving?: boolean
  onSaveProduct: () => void
  onSaveScenarioDraft?: () => void
  onCancel: () => void
}

export function ProductFiscalRegistrationPanel({
  clientLabel,
  establishments,
  establishmentId,
  establishmentStatus,
  onEstablishmentChange,
  commercialForm,
  onCommercialChange,
  merchandiseFacts,
  onMerchandiseChange,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onAddScenario,
  onRemoveScenario,
  onUpdateScenario,
  groups,
  groupProductCounts,
  onManageGroups,
  onCreateGroupRequest,
  onGroupFieldChange,
  productId,
  rules = [],
  canEdit,
  fiscalSectionsEnabled,
  saving,
  onSaveProduct,
  onSaveScenarioDraft,
  onCancel,
}: Props) {
  const { theme } = useMfTheme()
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null
  const fiscalLocked = !fiscalSectionsEnabled
  const fiscalContextReady = fiscalSectionsEnabled && Boolean(establishmentId) && establishmentStatus === 'OK'
  const selectedGroupName = groups.find((g) => g.id === commercialForm.fiscalProductGroupId)?.name ?? null

  const handleCommercialGroupChange = (value: string) => {
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: mfSpacing.lg },
        headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: mfSpacing.md },
        title: { ...mfTypography.title, color: theme.text },
        hint: { ...mfTypography.caption, color: theme.textSecondary },
        lockedBanner: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          padding: mfSpacing.md,
          backgroundColor: theme.backgroundMuted,
        },
        lockedText: { ...mfTypography.caption, color: theme.textSecondary },
        scenarioList: { flexDirection: 'row', flexWrap: 'wrap', gap: mfSpacing.sm },
        scenarioChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.xs,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm,
          backgroundColor: theme.surface,
        },
        scenarioChipActive: {
          borderColor: theme.primary,
          backgroundColor: `${theme.primary}14`,
        },
        scenarioChipMain: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.xs,
          flexShrink: 1,
        },
        scenarioRemoveBtn: {
          padding: 2,
        },
        scenarioChipText: { ...mfTypography.caption, color: theme.text, fontWeight: '600', maxWidth: 220 },
        rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: mfSpacing.sm, alignItems: 'center' },
        primaryBtn: {
          backgroundColor: theme.primary,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.xs,
        },
        secondaryBtn: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm,
          backgroundColor: theme.surface,
        },
        ghostBtn: { paddingVertical: mfSpacing.sm, paddingHorizontal: mfSpacing.sm },
        primaryBtnText: { ...mfTypography.body, color: '#fff', fontWeight: '700' },
        secondaryBtnText: { ...mfTypography.body, color: theme.text, fontWeight: '600' },
        ghostBtnText: { ...mfTypography.body, color: theme.textSecondary },
        addScenarioBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.xs,
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: theme.primary,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm,
        },
        addScenarioText: { ...mfTypography.body, color: theme.primary, fontWeight: '600' },
        disabledOverlay: { opacity: fiscalLocked ? 0.55 : 1 },
      }),
    [fiscalLocked, theme],
  )

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cadastro completo do produto</Text>
      </View>
      <Text style={styles.hint}>
        Cliente atual: {clientLabel ?? '—'}. Dados comerciais pertencem ao cliente; cenários fiscais variam por CNPJ.
      </Text>

      <FiscalFormSection title="Dados do produto">
        <FiscalFieldInput
          label="Descrição"
          value={commercialForm.discriminacao}
          onChangeText={(v) => onCommercialChange({ discriminacao: v })}
          disabled={!canEdit}
          placeholder="Ex.: Camisa"
        />
        <FiscalFieldInput
          label="Código/SKU"
          value={commercialForm.codigo}
          onChangeText={(v) => onCommercialChange({ codigo: v })}
          disabled={!canEdit}
        />
        <FiscalFieldInput
          label="Unidade"
          value={commercialForm.unidade}
          onChangeText={(v) => onCommercialChange({ unidade: v })}
          disabled={!canEdit}
        />
        <FiscalFieldInput
          label="NCM"
          value={commercialForm.ncm}
          onChangeText={(v) => onCommercialChange({ ncm: v })}
          disabled={!canEdit}
          keyboardType="numeric"
        />
        <FiscalFieldInput
          label="CEST"
          value={commercialForm.cest}
          onChangeText={(v) => onCommercialChange({ cest: v })}
          disabled={!canEdit}
          keyboardType="numeric"
        />
        <FiscalFieldInput
          label="Preço padrão"
          value={commercialForm.valor_sugerido}
          onChangeText={(v) => onCommercialChange({ valor_sugerido: v })}
          disabled={!canEdit}
          keyboardType="numeric"
          placeholder="0,00"
        />
        <FiscalProductGroupSelectField
          value={commercialForm.fiscalProductGroupId}
          groups={groups}
          groupProductCounts={groupProductCounts}
          onChange={handleCommercialGroupChange}
          disabled={!canEdit}
          onManageGroups={onManageGroups}
          showEmptyHint={groups.filter((g) => g.status === 'ACTIVE').length === 0}
          onCreateFirstGroup={onCreateGroupRequest}
          helpText="Organização lógica do produto. Não define tributação automaticamente."
        />
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onSaveProduct}
            disabled={!canEdit || saving}
            accessibilityRole="button"
          >
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {fiscalSectionsEnabled ? 'Atualizar produto' : 'Salvar produto'}
            </Text>
          </TouchableOpacity>
        </View>
      </FiscalFormSection>

      {fiscalLocked ? (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>
            Salve os dados comerciais do produto para liberar a configuração fiscal abaixo.
          </Text>
        </View>
      ) : null}

      <View style={styles.disabledOverlay} pointerEvents={fiscalLocked ? 'none' : 'auto'}>
        <FiscalFormSection title="Configuração fiscal">
          <FiscalEstablishmentSelectField
            establishments={establishments}
            selectedEstablishmentId={establishmentId}
            onSelectEstablishment={onEstablishmentChange}
            disabled={!canEdit || fiscalLocked}
            establishmentStatus={establishmentStatus}
            clientLabel={clientLabel}
          />
        </FiscalFormSection>

        {!fiscalContextReady ? (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedText}>
              Selecione o estabelecimento fiscal (CNPJ) para configurar fatos fiscais e cenários.
            </Text>
          </View>
        ) : null}

        {productId && fiscalContextReady ? (
          <FiscalGroupInheritanceBanner
            productId={productId}
            fiscalProductGroupId={commercialForm.fiscalProductGroupId || null}
            fiscalProductGroupName={commercialForm.fiscalProductGroupId ? selectedGroupName : null}
            establishmentId={establishmentId}
            rules={rules}
          />
        ) : null}

        <View style={{ opacity: fiscalContextReady ? 1 : 0.55 }} pointerEvents={fiscalContextReady ? 'auto' : 'none'}>
        <FiscalFormSection title="Informações fiscais da mercadoria">
          <FiscalConfigSelectField
            label="Origem da mercadoria"
            value={merchandiseFacts.origemMercadoria}
            options={ORIGEM_MERCADORIA_OPTIONS}
            onChange={(v) => onMerchandiseChange({ origemMercadoria: v })}
            disabled={!canEdit || fiscalLocked}
          />
          <FiscalConfigSelectField
            label="Origem comercial do item"
            value={merchandiseFacts.itemSource}
            options={ITEM_SOURCE_OPTIONS}
            onChange={(v) => onMerchandiseChange({ itemSource: v })}
            disabled={!canEdit || fiscalLocked}
          />
          <FiscalConfigSelectField
            label="Situação ST anterior"
            value={merchandiseFacts.priorStStatus}
            options={PRIOR_ST_STATUS_OPTIONS}
            onChange={(v) => onMerchandiseChange({ priorStStatus: v })}
            disabled={!canEdit || fiscalLocked}
            helpText="Informe conforme evidência fiscal disponível. Se não houver confirmação, mantenha como desconhecido."
          />
        </FiscalFormSection>

        <FiscalFormSection title="Cenários fiscais">
          <Text style={styles.hint}>
            Cada cenário define quando aplicar um tratamento fiscal (ex.: venda interna).
            UF emitente/destino e abrangência são resolvidas na emissão — não cadastre RJ/RJ manualmente.
          </Text>

          <View style={styles.scenarioList}>
            {scenarios.map((scenario) => {
              const active = scenario.id === activeScenarioId
              return (
                <View
                  key={scenario.id}
                  style={[styles.scenarioChip, active ? styles.scenarioChipActive : null]}
                >
                  <TouchableOpacity
                    style={styles.scenarioChipMain}
                    onPress={() => onSelectScenario(scenario.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Selecionar cenário ${scenario.name || 'Sem nome'}`}
                  >
                    <Text style={styles.scenarioChipText} numberOfLines={1}>
                      {scenario.name || 'Sem nome'}
                    </Text>
                    <FiscalStatusBadge status={scenario.uiStatus} />
                  </TouchableOpacity>
                  {canEdit && scenarios.length > 1 ? (
                    <TouchableOpacity
                      style={styles.scenarioRemoveBtn}
                      onPress={() => onRemoveScenario(scenario.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${scenario.name}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )
            })}
          </View>

          <AddFiscalScenarioButton
            disabled={!canEdit || fiscalLocked}
            onAdd={(kind) => onAddScenario(kind)}
          />

          {activeScenario ? (
            <FiscalScenarioEditor
              form={{
                ...activeScenario.form,
                origemMercadoria: merchandiseFacts.origemMercadoria,
                itemSource: merchandiseFacts.itemSource,
                priorStStatus: merchandiseFacts.priorStStatus,
              }}
              onChange={(patch) => {
                if (patch.origemMercadoria || patch.itemSource || patch.priorStStatus) {
                  onMerchandiseChange({
                    origemMercadoria: patch.origemMercadoria ?? merchandiseFacts.origemMercadoria,
                    itemSource: patch.itemSource ?? merchandiseFacts.itemSource,
                    priorStStatus: patch.priorStStatus ?? merchandiseFacts.priorStStatus,
                  })
                }
                onUpdateScenario(activeScenario.id, patch)
              }}
              groups={groups}
              readOnly={!canEdit || fiscalLocked}
              hideGroupField
              scenarioStatus={activeScenario.status}
              ruleId={activeScenario.ruleId}
              showGovernance
              establishmentId={establishmentId}
              establishmentLabel={clientLabel}
              establishmentIssuerUf={establishments.find((e) => e.establishmentId === establishmentId)?.issuerUf ?? null}
              clientLabel={clientLabel}
            />
          ) : (
            <Text style={styles.hint}>Adicione um cenário fiscal para configurar ICMS, ST, PIS e COFINS.</Text>
          )}

          {onSaveScenarioDraft && activeScenario ? (
            <View style={styles.rowActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onSaveScenarioDraft}
                disabled={!canEdit || fiscalLocked || saving}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>
                  Salvar rascunho do cenário
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </FiscalFormSection>
        </View>
      </View>

      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.ghostBtn} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Cancelar cadastro</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
