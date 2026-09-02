import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { FiscalConfigSelectField } from '@/components/fiscal-configuration/FiscalConfigSelectField'
import { CfopAutocompleteField } from '@/components/fiscal-configuration/CfopAutocompleteField'
import { EstablishmentContextBanner } from '@/components/fiscal-configuration/EstablishmentContextBanner'
import { ScenarioApplicationFields } from '@/components/fiscal-configuration/ScenarioApplicationFields'
import { FiscalFormSection, FiscalFieldInput, FiscalComputedField } from '@/components/fiscal-configuration/fiscalFormFields'
import { useMfTheme } from '@/components/ui/useMfTheme'
import {
  CURRENT_OPERATION_ST_OPTIONS,
  PIS_COFINS_MODE_OPTIONS,
  labelRuleStatus,
} from '@/lib/fiscalConfiguration/labels'
import { shouldShowStFields, deriveIcmsGroupFromCsosn, displayIcmsGroupForForm } from '@/lib/fiscalConfiguration/ruleFormMapper'
import type { FiscalProductGroup, ProductFiscalConfigForm } from '@/lib/fiscalConfiguration/types'
import type { FiscalScenarioDraftStatus } from '@/lib/fiscalConfiguration/scenarioTypes'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  form: ProductFiscalConfigForm
  onChange: (patch: Partial<ProductFiscalConfigForm>) => void
  groups: FiscalProductGroup[]
  readOnly?: boolean
  scenarioStatus?: FiscalScenarioDraftStatus | null
  showGovernance?: boolean
  ruleStatus?: string | null
  ruleId?: string | null
  establishmentId?: string | null
  establishmentLabel?: string | null
  establishmentIssuerUf?: string | null
  clientLabel?: string | null
  hideGroupField?: boolean
}

export function FiscalScenarioEditor({
  form,
  onChange,
  groups,
  readOnly = false,
  scenarioStatus,
  showGovernance = true,
  ruleStatus,
  ruleId,
  establishmentId,
  establishmentLabel,
  establishmentIssuerUf,
  clientLabel,
  hideGroupField = false,
}: Props) {
  const { theme } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        subsection: { gap: mfSpacing.md },
        meta: { ...mfTypography.caption, color: theme.textSecondary },
        statusPill: {
          alignSelf: 'flex-start',
          paddingHorizontal: mfSpacing.sm,
          paddingVertical: 2,
          borderRadius: mfRadius.sm,
          backgroundColor: theme.backgroundMuted,
        },
        statusText: { ...mfTypography.caption, color: theme.text, fontWeight: '600' },
      }),
    [theme],
  )

  const groupOptions = [
    { value: '', label: 'Sem grupo fiscal' },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ]

  return (
    <View style={{ gap: mfSpacing.lg }}>
      {scenarioStatus ? (
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>Status do cenário: {scenarioStatus}</Text>
        </View>
      ) : null}

      <EstablishmentContextBanner
        establishmentId={establishmentId}
        establishmentLabel={establishmentLabel}
        issuerUf={establishmentIssuerUf}
        clientLabel={clientLabel}
      />

      <FiscalFormSection title="Condições de aplicação">
        <View style={styles.subsection}>
          <FiscalFieldInput
            label="Nome do cenário"
            value={form.name}
            onChangeText={(v) => onChange({ name: v })}
            disabled={readOnly}
            placeholder="Ex.: Venda interna"
          />
          <ScenarioApplicationFields form={form} onChange={onChange} readOnly={readOnly} />
          {!hideGroupField ? (
            <FiscalConfigSelectField
              label="Grupo fiscal (condição da regra)"
              value={form.fiscalProductGroupId}
              options={groupOptions}
              onChange={(v) => onChange({ fiscalProductGroupId: v })}
              disabled={readOnly}
              helpText="Use apenas em regras que se aplicam a um grupo inteiro."
            />
          ) : null}
        </View>
      </FiscalFormSection>

      <FiscalFormSection title="Tratamento fiscal">
        <CfopAutocompleteField
          value={form.cfop}
          onChange={(code) => onChange({ cfop: code })}
          disabled={readOnly}
          operationScope={form.operationScope}
        />
        <FiscalFieldInput
          label="CSOSN"
          value={form.csosn}
          onChangeText={(v) => onChange({ csosn: v, icmsGroup: deriveIcmsGroupFromCsosn(v) })}
          disabled={readOnly}
          keyboardType="numeric"
        />
        <FiscalComputedField
          label="Grupo ICMS (automático)"
          value={displayIcmsGroupForForm(form)}
          hint="Calculado a partir do CSOSN. Para alterar, edite o CSOSN acima."
        />
      </FiscalFormSection>

      <FiscalFormSection title="Substituição tributária (ST)">
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
        ) : (
          <Text style={styles.meta}>
            Campos adicionais de ST aparecem quando a operação ou CSOSN exigir configuração de ST.
          </Text>
        )}
      </FiscalFormSection>

      <FiscalFormSection title="PIS">
        <FiscalFieldInput
          label="PIS — CST"
          value={form.pisCst}
          onChangeText={(v) => onChange({ pisCst: v })}
          disabled={readOnly}
          keyboardType="numeric"
        />
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
      </FiscalFormSection>

      <FiscalFormSection title="COFINS">
        <FiscalFieldInput
          label="COFINS — CST"
          value={form.cofinsCst}
          onChangeText={(v) => onChange({ cofinsCst: v })}
          disabled={readOnly}
          keyboardType="numeric"
        />
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

      {showGovernance ? (
        <FiscalFormSection title="Governança do cenário">
          {ruleStatus ? (
            <Text style={styles.meta}>Status da regra: {labelRuleStatus(ruleStatus)}</Text>
          ) : ruleId ? (
            <Text style={styles.meta}>Rascunho salvo no backend.</Text>
          ) : (
            <Text style={styles.meta}>Rascunho local — salve para persistir no backend.</Text>
          )}
          <FiscalFieldInput
            label="Referência/observação fiscal"
            value={form.sourceLegalReference}
            onChangeText={(v) => onChange({ sourceLegalReference: v })}
            disabled={readOnly}
          />
        </FiscalFormSection>
      ) : null}
    </View>
  )
}
