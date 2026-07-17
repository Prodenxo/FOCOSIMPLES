import React from 'react';
import { View, Text } from 'react-native';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import type { DashboardTheme } from './dashboardStyles';
import { buildBpoMonthInsight } from './bpoChartHelpers';

type Props = {
  monthLabel: string;
  budgeted: number;
  realized: number;
  isIncome: boolean;
  theme: DashboardTheme;
  isDarkMode: boolean;
  formatCurrency: (value: number) => string;
};

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(0).replace('.', ',')} %`;
}

export function BpoMonthInsight({
  monthLabel,
  budgeted,
  realized,
  isIncome,
  theme,
  isDarkMode,
  formatCurrency,
}: Props) {
  const tech = getTechTokens(isDarkMode);
  const insight = buildBpoMonthInsight(budgeted, realized);

  const statusLabel =
    insight.status === 'empty'
      ? 'Sem movimento'
      : insight.status === 'over'
        ? isIncome
          ? 'Acima do orçado'
          : 'Acima do orçado'
        : insight.status === 'under'
          ? isIncome
            ? 'Abaixo do orçado'
            : 'Dentro do orçado'
          : 'No orçado';

  const statusColor =
    insight.status === 'over'
      ? theme.error
      : insight.status === 'under' && isIncome
        ? theme.warning
        : theme.success;

  const rows = [
    { label: 'Realizado', value: formatCurrency(insight.realized), accent: true },
    { label: 'Orçado', value: formatCurrency(insight.budgeted), accent: false },
    {
      label: insight.variacao >= 0 ? 'Variação' : 'Economia',
      value: formatCurrency(Math.abs(insight.variacao)),
      accent: false,
    },
    { label: 'Atingimento', value: formatPct(insight.atingimentoPct), accent: false },
  ];

  return (
    <View
      style={{
        borderRadius: mfRadius.sm,
        borderWidth: 1,
        borderColor: tech.insetBorder,
        backgroundColor: tech.insetFill,
        padding: mfSpacing.sm,
        marginBottom: mfSpacing.sm,
        gap: mfSpacing.xs,
      }}
      accessibilityRole="summary"
      accessibilityLabel={`Detalhes de ${monthLabel}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text, letterSpacing: 0.3 }}>
          {monthLabel}
        </Text>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: mfRadius.pill,
            backgroundColor: `${statusColor}22`,
            borderWidth: 1,
            borderColor: `${statusColor}44`,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: mfSpacing.sm }}>
        {rows.map((row) => (
          <View key={row.label} style={{ minWidth: '46%', flexGrow: 1 }}>
            <Text style={{ fontSize: 10, color: theme.textTertiary, marginBottom: 2 }}>{row.label}</Text>
            <Text
              style={{
                fontSize: row.accent ? 14 : 12,
                fontWeight: row.accent ? '700' : '600',
                color: row.accent ? theme.text : theme.textSecondary,
                fontVariant: ['tabular-nums'],
              }}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
