/**
 * Snippet de referência — MF Luxury (MfCard + MfMetricTile).
 * Não está ligado ao navigator; use para validar tokens ou Storybook futuro.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFinanceSemanticColor, mfSpacing } from '../../../lib/theme';
import { MfCard, MfMetricTile, MfPage, useMfTheme } from '../index';

export function MfLuxurySnippet() {
  const { theme } = useMfTheme();

  return (
    <MfPage scroll>
      <MfCard variant="elevated" padding="lg">
        <View style={styles.grid}>
          <MfMetricTile
            label="Em aberto"
            value="R$ 18.600,00"
            semantic="open"
            icon={
              <Ionicons name="time-outline" size={16} color={getFinanceSemanticColor(theme, 'open')} />
            }
          />
          <MfMetricTile
            label="Recebido"
            value="R$ 42.980,00"
            semantic="received"
            icon={
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={getFinanceSemanticColor(theme, 'received')}
              />
            }
          />
          <MfMetricTile
            label="Em atraso"
            value="R$ 4.250,00"
            semantic="overdue"
            icon={
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={getFinanceSemanticColor(theme, 'overdue')}
              />
            }
          />
          <MfMetricTile
            label="Total previsto"
            value="R$ 65.830,00"
            semantic="forecast"
            icon={
              <Ionicons
                name="trending-up-outline"
                size={16}
                color={getFinanceSemanticColor(theme, 'forecast')}
              />
            }
          />
        </View>
      </MfCard>
    </MfPage>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mfSpacing.md,
  },
});

export default MfLuxurySnippet;
