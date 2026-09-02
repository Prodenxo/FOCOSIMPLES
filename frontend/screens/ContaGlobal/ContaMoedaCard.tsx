import React, { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MoedaFlag } from '../../components/conta-global/MoedaFlag'
import { useMfTheme } from '../../components/ui/useMfTheme'
import { formatBrl, formatMoedaValorAmount } from '../../lib/moedaFormat'
import { getMoedaNomePt } from '../../lib/moedaNomesPt'
import type { ContaMoedaGlobal } from '../../lib/contaMoedaGlobalTypes'
import { mfRadius, mfSpacing } from '../../lib/theme'

type Props = {
  conta: ContaMoedaGlobal
  rate: number | null
  ratesLoading: boolean
  onPress: () => void
  onEdit: () => void
  onDelete: () => void
}

const CARD_WIDTH = 168

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily']

export function ContaMoedaCard({
  conta,
  rate,
  ratesLoading,
  onPress,
  onEdit,
  onDelete,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const brl = rate != null ? conta.valor * rate : null
  const styles = useMemo(() => createStyles(theme, isDarkMode), [theme, isDarkMode])
  const moedaLabel = conta.nome || getMoedaNomePt(conta.moeda)

  return (
    <View style={styles.shell}>
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.identity}>
            <MoedaFlag moeda={conta.moeda} size={36} label={moedaLabel} />
            <Text style={styles.code}>{conta.moeda}</Text>
          </View>
          <TouchableOpacity
            onPress={onEdit}
            style={styles.menuBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Editar moeda"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <TouchableOpacity
              onPress={onDelete}
              style={styles.menuBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Excluir moeda"
            >
              <Ionicons name="trash-outline" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <Pressable
          onPress={onPress}
          onLongPress={Platform.OS !== 'web' ? onDelete : undefined}
          delayLongPress={450}
          style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${conta.moeda}, ${formatMoedaValorAmount(conta.valor, conta.moeda)}`}
        >
          <Text
            style={styles.valor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatMoedaValorAmount(conta.valor, conta.moeda)}
          </Text>

          {ratesLoading && rate == null ? (
            <Text style={styles.meta}>Carregando…</Text>
          ) : rate != null ? (
            <View style={styles.footer}>
              <Text style={styles.meta} numberOfLines={1}>
                ≈ {formatBrl(brl ?? 0)}
              </Text>
              <Text style={styles.rateHint} numberOfLines={1}>
                1 {conta.moeda} = {formatBrl(rate)}
              </Text>
            </View>
          ) : (
            <Text style={styles.meta}>Cotação indisponível</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

export const CONTA_MOEDA_CARD_WIDTH = CARD_WIDTH

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  isDarkMode: boolean,
) {
  const surface = isDarkMode ? 'rgba(30, 41, 59, 0.65)' : 'rgba(241, 245, 249, 0.95)'

  return StyleSheet.create({
    shell: {
      width: CARD_WIDTH,
    },
    card: {
      width: CARD_WIDTH,
      minHeight: 132,
      padding: mfSpacing.md,
      borderRadius: mfRadius.lg,
      backgroundColor: surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.15)',
      gap: mfSpacing.sm,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 2,
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
      marginRight: 4,
    },
    code: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: 0.6,
    },
    menuBtn: {
      padding: 4,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    body: {
      flexGrow: 1,
      gap: 2,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    bodyPressed: {
      opacity: 0.88,
    },
    valor: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.6,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    footer: {
      gap: 2,
      marginTop: 2,
    },
    meta: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    rateHint: {
      fontSize: 10,
      color: theme.textTertiary,
    },
  })
}
