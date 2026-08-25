import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { FiscalConfigSelectField } from '@/components/fiscal-configuration/FiscalConfigSelectField'
import { FiscalFieldInput } from '@/components/fiscal-configuration/fiscalFormFields'
import { useMfTheme } from '@/components/ui/useMfTheme'
import {
  FINAL_CONSUMER_CONDITION_OPTIONS,
  RECIPIENT_TAXPAYER_CONDITION_OPTIONS,
  SCENARIO_APPLIES_OPTIONS,
} from '@/lib/fiscalConfiguration/labels'
import { applyScenarioAppliesPatch } from '@/lib/fiscalConfiguration/scenarioApplicationUi'
import type { ProductFiscalConfigForm } from '@/lib/fiscalConfiguration/types'
import { mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  form: ProductFiscalConfigForm
  onChange: (patch: Partial<ProductFiscalConfigForm>) => void
  readOnly?: boolean
}

export function ScenarioApplicationFields({ form, onChange, readOnly = false }: Props) {
  const { theme } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        hint: { ...mfTypography.caption, color: theme.textSecondary },
        optionalBlock: { gap: mfSpacing.sm, marginTop: mfSpacing.xs },
        optionalTitle: {
          ...mfTypography.caption,
          color: theme.textSecondary,
          fontWeight: '700',
        },
      }),
    [theme],
  )

  const patch = (next: Partial<ProductFiscalConfigForm>) => {
    onChange(applyScenarioAppliesPatch(next, form))
  }

  const recipientConditionValue = form.restrictRecipientTaxpayer
    ? form.recipientTaxpayerStatus
    : 'ANY'

  const consumerConditionValue = form.restrictFinalConsumer
    ? form.recipientFinalConsumer
    : 'ANY'

  return (
    <View style={{ gap: mfSpacing.md }}>
      <Text style={styles.hint}>
        Condições de aplicação do tratamento fiscal — não são dados fixos do produto.
        Na emissão, UF emitente, UF destino e abrangência são derivadas do destinatário e do estabelecimento.
      </Text>

      <FiscalConfigSelectField
        label="Aplica-se em"
        value={form.scenarioApplies ?? 'INTERNAL'}
        options={SCENARIO_APPLIES_OPTIONS}
        onChange={(v) => patch({ scenarioApplies: v as ProductFiscalConfigForm['scenarioApplies'] })}
        disabled={readOnly}
        helpText='Ex.: "Venda interna" corresponde a operationScope=INTERNAL no matcher.'
      />

      {form.scenarioApplies === 'INTERSTATE_UF' ? (
        <FiscalFieldInput
          label="UF destino específica"
          value={form.specificDestinationUf}
          onChangeText={(v) => patch({ specificDestinationUf: v.toUpperCase().slice(0, 2) })}
          disabled={readOnly}
          placeholder="Ex.: SP"
        />
      ) : null}

      <View style={styles.optionalBlock}>
        <Text style={styles.optionalTitle}>Restrições opcionais do destinatário</Text>
        <Text style={styles.hint}>
          Deixe em "Qualquer" para regras genéricas. Contribuinte e consumidor final vêm do destinatário na emissão.
        </Text>
        <FiscalConfigSelectField
          label="Destinatário"
          value={recipientConditionValue}
          options={RECIPIENT_TAXPAYER_CONDITION_OPTIONS}
          onChange={(v) => {
            if (v === 'ANY') {
              onChange({
                restrictRecipientTaxpayer: false,
                recipientTaxpayerStatus: 'UNKNOWN',
              })
              return
            }
            onChange({
              restrictRecipientTaxpayer: true,
              recipientTaxpayerStatus: v,
            })
          }}
          disabled={readOnly}
        />
        <FiscalConfigSelectField
          label="Consumidor"
          value={consumerConditionValue}
          options={FINAL_CONSUMER_CONDITION_OPTIONS}
          onChange={(v) => {
            if (v === 'ANY') {
              onChange({
                restrictFinalConsumer: false,
                recipientFinalConsumer: 'UNKNOWN',
              })
              return
            }
            onChange({
              restrictFinalConsumer: true,
              recipientFinalConsumer: v,
            })
          }}
          disabled={readOnly}
        />
      </View>
    </View>
  )
}
