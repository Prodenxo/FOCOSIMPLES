import React from 'react';
import { View, Text } from 'react-native';
import { mfSpacing } from '../../lib/theme';
import type { DashboardTheme } from './dashboardStyles';

type Props = {
  theme: DashboardTheme;
};

export function BpoChartLegend({ theme }: Props) {
  const items = [
    { color: theme.success, label: 'Dentro do orçado' },
    { color: theme.error, label: 'Excesso' },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: mfSpacing.md,
        marginBottom: mfSpacing.sm,
        justifyContent: 'center',
      }}
      accessibilityRole="text"
    >
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: item.color,
            }}
          />
          <Text style={{ fontSize: 11, color: theme.textSecondary }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
