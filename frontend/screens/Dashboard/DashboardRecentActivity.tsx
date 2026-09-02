import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { mfSpacing } from '../../lib/theme';
import { getCategorySliceColorForId } from '../../lib/categoryColors';
import { getCategoryIconName } from '../../lib/categoryIcons';
import { getTechTokens, mfTechPanelChrome } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';
import type { RecentActivityItem } from './dashboardInsights';

type Props = {
  items: RecentActivityItem[];
};

export function DashboardRecentActivity({ items }: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const router = useRouter();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const chrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.panel, chrome]}>
        <View style={styles.header}>
          <View>
            <View style={styles.eyebrowRow}>
              <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
              <Text style={[styles.eyebrow, { color: tokens.accent }]}>Feed</Text>
            </View>
            <Text style={styles.title}>Últimas movimentações</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/transacoes' as never)}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.linkText, { color: tokens.accent }]}>Ver todas</Text>
            <Ionicons name="arrow-forward" size={14} color={tokens.accent} />
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>Nenhuma movimentação neste período.</Text>
        ) : (
          <View style={styles.list}>
            {items.map((item, index) => {
              const isIncome = item.tipo === 'entrada';
              const amountColor = isIncome ? theme.success : theme.error;
              const categoryAccent = getCategorySliceColorForId(item.categoryId, isDarkMode);
              const categoryIcon = getCategoryIconName(item.title);
              const hoverFill = isDarkMode ? 'rgba(34, 211, 238, 0.06)' : 'rgba(29, 78, 216, 0.05)';
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => router.push('/(app)/transacoes' as never)}
                >
                  {({ hovered, pressed }) => (
                    <View
                      style={[
                        styles.row,
                        index < items.length - 1 && styles.rowBorder,
                        (hovered || pressed) && { backgroundColor: hoverFill },
                        (hovered || pressed) && { borderLeftWidth: 3, borderLeftColor: tokens.accent },
                      ]}
                    >
                      {[
                        <View
                          key="icon"
                          style={[
                            styles.rowIcon,
                            {
                              backgroundColor: `${categoryAccent}18`,
                              borderColor: `${categoryAccent}44`,
                            },
                          ]}
                        >
                          <Ionicons name={categoryIcon} size={16} color={categoryAccent} />
                        </View>,
                        <View key="body" style={styles.rowBody}>
                          {[
                            <Text key="title" style={styles.rowTitle} numberOfLines={1}>
                              {item.title}
                            </Text>,
                            <Text key="meta" style={styles.rowMeta}>
                              {`${item.dateLabel}${item.status === 'a_pagar' ? ' · A pagar' : item.status === 'pago' ? ' · Pago' : ''}`}
                            </Text>,
                          ]}
                        </View>,
                        <Text key="amount" style={[styles.rowAmount, { color: amountColor }]}>
                          {item.amount}
                        </Text>,
                      ]}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
) {
  const mono = Platform.select({
    web: 'ui-monospace, Menlo, Consolas, monospace',
    ios: 'Menlo',
    android: 'monospace',
    default: undefined,
  });

  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginTop: mfSpacing.md,
    },
    panel: {
      padding: mfSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: mfSpacing.md,
      gap: mfSpacing.sm,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    linkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingTop: 4,
    },
    linkText: {
      fontSize: 12,
      fontWeight: '700',
    },
    empty: {
      fontSize: 13,
      color: theme.textTertiary,
      textAlign: 'center',
      paddingVertical: mfSpacing.lg,
    },
    list: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      overflow: 'hidden',
      backgroundColor: tokens.insetFill,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: mfSpacing.md,
      paddingLeft: mfSpacing.md - 3,
      gap: mfSpacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: tokens.divider,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    rowMeta: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 2,
    },
    rowAmount: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: mono,
      fontVariant: ['tabular-nums'],
    },
  });
}
