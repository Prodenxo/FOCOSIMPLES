import React, { useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '../../components/ui/useMfTheme'
import type { ContaMoedaGlobal } from '../../lib/contaMoedaGlobalTypes'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { getTechTokens } from '../../lib/techDesign'
import { ContaMoedaCard, CONTA_MOEDA_CARD_WIDTH } from './ContaMoedaCard'

type Props = {
  contas: ContaMoedaGlobal[]
  rates: Record<string, number>
  ratesLoading: boolean
  onPressConta: (conta: ContaMoedaGlobal) => void
  onEditConta: (conta: ContaMoedaGlobal) => void
  onDeleteConta: (conta: ContaMoedaGlobal) => void
  onAddMoeda: () => void
}

const ADD_CARD_WIDTH = CONTA_MOEDA_CARD_WIDTH

export function ContaMoedaCarousel({
  contas,
  rates,
  ratesLoading,
  onPressConta,
  onEditConta,
  onDeleteConta,
  onAddMoeda,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens, isDarkMode), [theme, tokens, isDarkMode])

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>Suas moedas</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        decelerationRate="fast"
        snapToInterval={CONTA_MOEDA_CARD_WIDTH + mfSpacing.md}
        snapToAlignment="start"
      >
        {contas.map((conta) => (
          <ContaMoedaCard
            key={conta.id}
            conta={conta}
            rate={rates[conta.moeda] ?? null}
            ratesLoading={ratesLoading}
            onPress={() => onPressConta(conta)}
            onEdit={() => onEditConta(conta)}
            onDelete={() => onDeleteConta(conta)}
          />
        ))}

        <TouchableOpacity
          style={styles.addCard}
          onPress={onAddMoeda}
          accessibilityRole="button"
          accessibilityLabel="Adicionar nova moeda"
        >
          <View style={[styles.addIcon, { borderColor: tokens.accent }]}>
            <Ionicons name="add" size={22} color={tokens.accent} />
          </View>
          <Text style={styles.addLabel}>Nova moeda</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    root: {
      width: '100%',
      marginBottom: mfSpacing.sm,
      gap: mfSpacing.sm,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
      paddingHorizontal: 2,
    },
    track: {
      flexDirection: 'row',
      gap: mfSpacing.md,
      paddingVertical: 4,
      paddingRight: mfSpacing.md,
    },
    addCard: {
      width: ADD_CARD_WIDTH,
      minHeight: 132,
      borderRadius: mfRadius.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: mfSpacing.sm,
      padding: mfSpacing.md,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    addIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
  })
}
