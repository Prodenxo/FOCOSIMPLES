import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfTechKpiCard } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { getCategoryIconName } from '../../lib/categoryIcons';
import { formatCurrencyBR } from '../../lib/numberFormat';
import { mfRadius, mfSpacing } from '../../lib/theme';
import type { CategorySpendingRow } from '../../hooks/useCategoryMonthSpending';

type Props = {
  row: CategorySpendingRow;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  hideActions?: boolean;
  dimmed?: boolean;
  barColor: string;
};

function formatTxDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  if (d && m && y) return `${d}/${m}`;
  return iso;
}

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily'];

export function CategoryDashboardRow({
  row,
  total,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  hideActions = false,
  dimmed = false,
  barColor,
}: Props) {
  const { theme } = useMfTheme();
  const pct = total > 0 ? Math.min(100, (row.amount / total) * 100) : 0;
  const iconName = getCategoryIconName(row.nome);
  const styles = useMemo(() => createStyles(theme, dimmed), [theme, dimmed]);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <MfTechKpiCard level="metric" style={styles.card}>
          <View style={styles.top}>
            <TouchableOpacity
              onPress={onToggle}
              hitSlop={8}
              style={styles.chevronBtn}
              accessibilityLabel={expanded ? 'Recolher' : 'Expandir'}
            >
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: `${barColor}18`, borderColor: `${barColor}44` },
              ]}
            >
              <Ionicons name={iconName} size={16} color={barColor} />
            </View>
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {row.nome}
                </Text>
                <Text style={styles.amount}>{formatCurrencyBR(row.amount)}</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]}
                />
              </View>
            </View>
            {!hideActions ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={onEdit}
                  hitSlop={8}
                  style={styles.actionBtn}
                  accessibilityLabel="Editar categoria"
                >
                  <Ionicons name="pencil-outline" size={17} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onDelete}
                  hitSlop={8}
                  style={styles.actionBtn}
                  accessibilityLabel="Excluir categoria"
                >
                  <Ionicons name="trash-outline" size={17} color={theme.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </MfTechKpiCard>
      </TouchableOpacity>

      {expanded && row.transactions.length > 0 ? (
        <View style={styles.children}>
          {row.transactions.map((tx) => (
            <View key={tx.id} style={styles.childRow}>
              <View style={styles.childLine} />
              <View style={styles.childContent}>
                <Text style={styles.childLabel} numberOfLines={1}>
                  {tx.obs?.trim() || formatTxDate(tx.data)}
                </Text>
                <Text style={styles.childAmount}>{formatCurrencyBR(tx.valor)}</Text>
              </View>
              <View style={styles.childTrack}>
                <View
                  style={[
                    styles.childFill,
                    {
                      width:
                        row.amount > 0
                          ? `${Math.min(100, (tx.valor / row.amount) * 100)}%`
                          : '0%',
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : expanded ? (
        <View style={styles.children}>
          <Text style={styles.childEmpty}>Nenhum lançamento neste mês</Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  dimmed: boolean,
) {
  return StyleSheet.create({
    wrap: {
      marginBottom: mfSpacing.sm,
      opacity: dimmed ? 0.78 : 1,
    },
    card: {
      width: '100%',
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
    },
    chevronBtn: {
      width: 20,
      alignItems: 'center',
      flexShrink: 0,
    },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: mfSpacing.sm,
      marginBottom: 8,
    },
    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: dimmed ? theme.textSecondary : theme.text,
      letterSpacing: -0.2,
    },
    amount: {
      fontSize: 14,
      fontWeight: '700',
      color: dimmed ? theme.textSecondary : theme.text,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    track: {
      height: 4,
      borderRadius: mfRadius.pill,
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: mfRadius.pill,
    },
    actions: {
      flexDirection: 'row',
      gap: 2,
      flexShrink: 0,
    },
    actionBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    children: {
      paddingLeft: 44,
      paddingRight: mfSpacing.md,
      paddingTop: mfSpacing.sm,
      paddingBottom: mfSpacing.xs,
    },
    childRow: {
      marginBottom: 10,
    },
    childLine: {
      position: 'absolute',
      left: -16,
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: theme.border,
    },
    childContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
      gap: mfSpacing.sm,
    },
    childLabel: {
      flex: 1,
      fontSize: 13,
      color: theme.textSecondary,
    },
    childAmount: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '600',
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    childTrack: {
      height: 2,
      borderRadius: mfRadius.pill,
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    childFill: {
      height: '100%',
      backgroundColor: theme.textTertiary,
      opacity: 0.7,
      borderRadius: mfRadius.pill,
    },
    childEmpty: {
      fontSize: 12,
      color: theme.textTertiary,
      fontStyle: 'italic',
    },
  });
}
