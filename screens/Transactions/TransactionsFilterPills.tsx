import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../../lib/theme';
import type { ContaFinanceira } from '../../lib/contaFinanceiraTypes';
import type { ContaFilterValue } from '../../lib/contaFinanceiraIntegration';
import { WEB_HIDE_X_SCROLL_CLASS } from '../../lib/webScrollbar';

type PillStyles = {
  filterGroup: object;
  filterGroupLabel: object;
  pillsScrollView: object;
  pillsRowContent: object;
  pill: object;
  pillActive: object;
  pillActiveEntrada: object;
  pillActiveSaida: object;
  pillActivePago: object;
  pillActivePendente: object;
  pillText: object;
  pillTextActive: object;
  pillTextActiveEntrada: object;
  pillTextActiveSaida: object;
  pillTextActivePago: object;
  pillTextActivePendente: object;
};

type Props = {
  theme: Theme;
  styles: PillStyles;
  typeFilter: 'all' | 'entrada' | 'saida';
  statusFilter: 'all' | 'pago' | 'pendente';
  contaFilter: ContaFilterValue;
  contasAtivas: ContaFinanceira[];
  onTypeChange: (v: 'all' | 'entrada' | 'saida') => void;
  onStatusChange: (v: 'all' | 'pago' | 'pendente') => void;
  onContaChange: (v: ContaFilterValue) => void;
  iconSize?: number;
};

function FilterGroup({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: PillStyles;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function TransactionsFilterPills({
  theme,
  styles,
  typeFilter,
  statusFilter,
  contaFilter,
  contasAtivas,
  onTypeChange,
  onStatusChange,
  onContaChange,
  iconSize = Platform.OS === 'web' ? 13 : 16,
}: Props) {
  return (
    <>
      <FilterGroup label="Tipo" styles={styles}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.pillsScrollView}
          contentContainerStyle={styles.pillsRowContent}
          {...(Platform.OS === 'web' ? { className: WEB_HIDE_X_SCROLL_CLASS } : {})}
        >
          {(
            [
              { key: 'all', label: 'Todos', icon: 'apps-outline' as const },
              { key: 'entrada', label: 'Entradas', icon: 'arrow-down-outline' as const },
              { key: 'saida', label: 'Saídas', icon: 'arrow-up-outline' as const },
            ] as const
          ).map((opt) => {
            const active = typeFilter === opt.key;
            const typePill =
              !active
                ? { box: undefined as object | undefined, label: undefined as object | undefined, icon: theme.textSecondary }
                : opt.key === 'entrada'
                  ? { box: styles.pillActiveEntrada, label: styles.pillTextActiveEntrada, icon: theme.success }
                  : opt.key === 'saida'
                    ? { box: styles.pillActiveSaida, label: styles.pillTextActiveSaida, icon: theme.error }
                    : { box: styles.pillActive, label: styles.pillTextActive, icon: theme.primary };
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => onTypeChange(opt.key)}
                style={[styles.pill, typePill.box]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={opt.icon} size={iconSize} color={typePill.icon} />
                <Text style={[styles.pillText, typePill.label]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </FilterGroup>

      <FilterGroup label="Status" styles={styles}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.pillsScrollView}
          contentContainerStyle={styles.pillsRowContent}
          {...(Platform.OS === 'web' ? { className: WEB_HIDE_X_SCROLL_CLASS } : {})}
        >
          {(
            [
              { key: 'all', label: 'Todos status', icon: 'ellipse-outline' as const },
              { key: 'pago', label: 'Pagas', icon: 'checkmark-circle-outline' as const },
              { key: 'pendente', label: 'Pendentes', icon: 'time-outline' as const },
            ] as const
          ).map((opt) => {
            const active = statusFilter === opt.key;
            const statusPill =
              !active
                ? { box: undefined as object | undefined, label: undefined as object | undefined, icon: theme.textSecondary }
                : opt.key === 'pago'
                  ? { box: styles.pillActivePago, label: styles.pillTextActivePago, icon: theme.success }
                  : opt.key === 'pendente'
                    ? { box: styles.pillActivePendente, label: styles.pillTextActivePendente, icon: theme.warning }
                    : { box: styles.pillActive, label: styles.pillTextActive, icon: theme.primary };
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => onStatusChange(opt.key)}
                style={[styles.pill, statusPill.box]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={opt.icon} size={iconSize} color={statusPill.icon} />
                <Text style={[styles.pillText, statusPill.label]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </FilterGroup>

      {contasAtivas.length > 0 ? (
        <FilterGroup label="Conta" styles={styles}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.pillsScrollView}
            contentContainerStyle={styles.pillsRowContent}
            {...(Platform.OS === 'web' ? { className: WEB_HIDE_X_SCROLL_CLASS } : {})}
          >
            {(
              [
                { key: 'all' as ContaFilterValue, label: 'Todas contas', icon: 'wallet-outline' as const },
                ...contasAtivas.map((c) => ({
                  key: c.id as ContaFilterValue,
                  label: c.nome,
                  icon: 'card-outline' as const,
                })),
                { key: 'unassigned' as ContaFilterValue, label: 'Meu financeiro', icon: 'wallet-outline' as const },
              ]
            ).map((opt) => {
              const active = contaFilter === opt.key;
              const pillStyle = active
                ? { box: styles.pillActive, label: styles.pillTextActive, icon: theme.primary }
                : { box: undefined as object | undefined, label: undefined as object | undefined, icon: theme.textSecondary };
              return (
                <TouchableOpacity
                  key={`conta-${opt.key}`}
                  onPress={() => onContaChange(opt.key)}
                  style={[styles.pill, pillStyle.box]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={opt.icon} size={iconSize} color={pillStyle.icon} />
                  <Text style={[styles.pillText, pillStyle.label]} numberOfLines={1}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </FilterGroup>
      ) : null}
    </>
  );
}
