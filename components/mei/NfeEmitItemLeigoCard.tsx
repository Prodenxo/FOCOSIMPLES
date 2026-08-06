import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import type { NfeItemForm } from '../../lib/meiNfseForms'
import { getNfeItemLineTotal } from '../../lib/meiNfseForms'
import { NCM_OBRIGATORIO_HINT } from '../../lib/nfeEmissaoLeigo'
import { MeiFormField, MeiLinkButton } from './meiFlowUi'

export type NfeEmitItemLeigoCardProps = {
  item: NfeItemForm
  itemIndex: number
  isActive: boolean
  cfopAuto: string | null
  showRemove: boolean
  isFocoSimplesUi: boolean
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
  cfopAuto,
  showRemove,
  isFocoSimplesUi,
  isDarkMode,
  theme,
  mfSpacing,
  formatCurrencyBR,
  onSelect,
  onChange,
  onRemove,
}: NfeEmitItemLeigoCardProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const ncmDigits = String(item.ncm || '').replace(/\D/g, '')
  const ncmIncomplete = ncmDigits.length !== 8
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
        hint="Código da mercadoria — obrigatório na NF-e."
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

      <View style={{ marginBottom: mfSpacing.sm, gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
          Total do item: {lineTotal !== null ? formatCurrencyBR(lineTotal) : '—'}
        </Text>
        {cfopAuto ? (
          <Text style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 16 }}>
            CFOP {cfopAuto} — definido automaticamente pela UF do cliente.
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => setAdvancedOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={advancedOpen ? 'Ocultar configurações avançadas' : 'Mostrar configurações avançadas'}
        style={{ marginBottom: advancedOpen ? 8 : 0 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.primary }}>
          {advancedOpen ? '▾ Ocultar configurações avançadas' : '▸ Configurações avançadas (contador)'}
        </Text>
      </Pressable>

      {advancedOpen ? (
        <>
          <MeiFormField
            label="Código interno"
            placeholder="SKU"
            value={item.codigo}
            onChangeText={(t) => onChange({ codigo: t })}
          />
          <MeiFormField
            label="CEST (opcional)"
            placeholder="0000000"
            value={item.cest}
            onChangeText={(t) => onChange({ cest: t.replace(/\D/g, '').slice(0, 7) })}
            keyboardType="numeric"
            maxLength={7}
          />
          <MeiFormField
            label="CFOP"
            required
            placeholder={cfopAuto ?? '5102'}
            hint="Normalmente preenchido automaticamente. Altere só se seu contador orientar."
            value={item.cfop}
            onChangeText={(t) => onChange({ cfop: t.replace(/\D/g, '').slice(0, 4) })}
            keyboardType="numeric"
            maxLength={4}
          />
          <MeiFormField
            label="Unidade"
            placeholder="UN"
            value={item.unidade}
            onChangeText={(t) => onChange({ unidade: t })}
          />
          <MeiFormField
            label={isFocoSimplesUi ? 'CSOSN ICMS (Simples)' : 'CSOSN ICMS (MEI)'}
            placeholder="102"
            value={item.tributos.icms.csosn}
            onChangeText={(t) => {
              const csosn = t.replace(/\D/g, '').slice(0, 3)
              onChange({
                tributos: {
                  ...item.tributos,
                  icms: { ...item.tributos.icms, csosn, cst: '' },
                },
              })
            }}
            keyboardType="numeric"
            maxLength={3}
          />
          <MeiFormField
            label="CST PIS"
            placeholder="49"
            value={item.tributos.pis.cst}
            onChangeText={(t) =>
              onChange({
                tributos: {
                  ...item.tributos,
                  pis: { ...item.tributos.pis, cst: t.replace(/\D/g, '').slice(0, 2) },
                },
              })
            }
            keyboardType="numeric"
            maxLength={2}
          />
          <MeiFormField
            label="CST COFINS"
            placeholder="49"
            value={item.tributos.cofins.cst}
            onChangeText={(t) =>
              onChange({
                tributos: {
                  ...item.tributos,
                  cofins: { ...item.tributos.cofins, cst: t.replace(/\D/g, '').slice(0, 2) },
                },
              })
            }
            keyboardType="numeric"
            maxLength={2}
          />
        </>
      ) : null}
    </View>
  )
}

export default NfeEmitItemLeigoCard
