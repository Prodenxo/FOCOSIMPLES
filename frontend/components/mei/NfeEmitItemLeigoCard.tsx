import { View, Text, Pressable } from 'react-native'
import type { NfeItemForm } from '../../lib/meiNfseForms'
import { getNfeItemLineTotal } from '../../lib/meiNfseForms'
import { NCM_OBRIGATORIO_HINT } from '../../lib/nfeEmissaoLeigo'
import { nfeItemFormRequiresCest } from '../../lib/stRulesEngine'
import { MeiFormField, MeiLinkButton } from './meiFlowUi'

export type NfeEmitItemLeigoCardProps = {
  item: NfeItemForm
  itemIndex: number
  isActive: boolean
  showRemove: boolean
  isDarkMode: boolean
  theme: {
    primary: string
    border: string
    surface: string
    text: string
    textSecondary: string
    error: string
  }
  mfSpacing: { sm: number; md: number }
  formatCurrencyBR: (value: number) => string
  onSelect: () => void
  onChange: (patch: Partial<NfeItemForm>) => void
  onRemove: () => void
}

export function NfeEmitItemLeigoCard({
  item,
  itemIndex,
  isActive,
  showRemove,
  isDarkMode,
  theme,
  mfSpacing,
  formatCurrencyBR,
  onSelect,
  onChange,
  onRemove,
}: NfeEmitItemLeigoCardProps) {
  const ncmDigits = String(item.ncm || '').replace(/\D/g, '')
  const ncmIncomplete = ncmDigits.length !== 8
  const requiresCest = nfeItemFormRequiresCest(item)
  const lineTotal = getNfeItemLineTotal(item)

  return (
    <View
      style={{
        marginBottom: mfSpacing.md,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: isActive ? theme.primary : theme.border,
        backgroundColor: theme.surface,
        gap: 0,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Pressable onPress={onSelect} accessibilityRole="button">
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
            Produto {itemIndex + 1}
            {isActive ? ' · editando' : ''}
          </Text>
        </Pressable>
        {showRemove ? <MeiLinkButton label="Remover" onPress={onRemove} /> : null}
      </View>

      {ncmIncomplete ? (
        <View
          style={{
            marginBottom: 10,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.primary,
            backgroundColor: isDarkMode ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
          }}
        >
          <Text style={{ fontSize: 12, color: theme.text, lineHeight: 17 }}>
            {NCM_OBRIGATORIO_HINT}
          </Text>
        </View>
      ) : null}

      <MeiFormField
        label="Descrição do produto"
        required
        placeholder="Ex.: Camiseta algodão"
        value={item.descricao}
        onChangeText={(t) => onChange({ descricao: t })}
      />
      <MeiFormField
        label="NCM (8 dígitos)"
        required
        placeholder="Ex.: 61091000"
        hint="Informe o código da mercadoria — o sistema cuida dos impostos."
        value={item.ncm}
        onChangeText={(t) => onChange({ ncm: t.replace(/\D/g, '').slice(0, 8) })}
        keyboardType="numeric"
        maxLength={8}
      />
      <MeiFormField
        label="Quantidade"
        required
        placeholder="1"
        value={item.quantidade}
        onChangeText={(t) => onChange({ quantidade: t })}
        keyboardType="decimal-pad"
      />
      <MeiFormField
        label="Valor unitário (R$)"
        required
        placeholder="0,00"
        value={item.valorUnitario}
        onChangeText={(t) => onChange({ valorUnitario: t })}
        keyboardType="decimal-pad"
      />

      {requiresCest ? (
        <MeiFormField
          label="CEST (7 dígitos)"
          required
          placeholder="Ex.: 0300100"
          hint="Obrigatório — produto com substituição tributária (ST)."
          value={item.cest}
          onChangeText={(t) => onChange({ cest: t.replace(/\D/g, '').slice(0, 7) })}
          keyboardType="numeric"
          maxLength={7}
        />
      ) : null}

      <View style={{ marginBottom: mfSpacing.sm, gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
          Total do item: {lineTotal !== null ? formatCurrencyBR(lineTotal) : '—'}
        </Text>
        <Text style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 16 }}>
          Impostos e enquadramento fiscal calculados automaticamente.
        </Text>
      </View>
    </View>
  )
}

export default NfeEmitItemLeigoCard
