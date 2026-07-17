import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { MfGlassCard } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { getGlassFill } from '../../lib/glassStyles';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { createDashboardStyles, type DashboardTheme } from './dashboardStyles';

type DashboardStyles = ReturnType<typeof createDashboardStyles>;

type BudgetBlockItem = {
  categorias_id: number;
  nome: string;
  orcado: number;
  realizado: number;
  percentual: number;
};

type BucketedBudgets = {
  verde: BudgetBlockItem[];
  amarelo: BudgetBlockItem[];
  laranja: BudgetBlockItem[];
  vermelho: BudgetBlockItem[];
};

type Props = {
  budgetTab: 'entrada' | 'saida';
  onBudgetTabChange: (tab: 'entrada' | 'saida') => void;
  bucketedBudgets: BucketedBudgets;
  theme: DashboardTheme;
  styles: DashboardStyles;
  isDesktop?: boolean;
  hasAnyBudget?: boolean;
  onOpenBudgets?: () => void;
};

const statusColors = (theme: DashboardTheme) => ({
  verde: theme.success,
  amarelo: theme.warning,
  laranja: '#F97316',
  vermelho: theme.error,
});

function renderBudgetBlock(
  label: string,
  colorKey: keyof ReturnType<typeof statusColors>,
  items: BudgetBlockItem[],
  theme: DashboardTheme,
  styles: DashboardStyles,
) {
  const colors = statusColors(theme);
  const color = colors[colorKey];
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return (
    <View style={styles.statusBlock}>
      <Text style={[styles.statusLabel, { color }]}>{label}</Text>
      {items.length > 0 ? (
        items.map((item) => (
          <View key={`${item.categorias_id}-${label}`} style={styles.statusItemRow}>
            <View style={styles.statusItemHeader}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={styles.statusItemTitle} numberOfLines={2}>
                {item.nome}
              </Text>
            </View>
            <Text style={styles.statusItemValue}>
              {formatCurrency(item.realizado)} / {formatCurrency(item.orcado)} (
              {item.percentual.toFixed(1)}%)
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.statusPlaceholder}>Nenhuma categoria nesta faixa</Text>
      )}
    </View>
  );
}

function renderDesktopCell(
  label: string,
  colorKey: keyof ReturnType<typeof statusColors>,
  items: BudgetBlockItem[],
  theme: DashboardTheme,
  styles: DashboardStyles,
  cellGlassBg: string,
) {
  const colors = statusColors(theme);
  const color = colors[colorKey];
  return (
    <View key={label} style={[styles.budgetGridCell, { backgroundColor: cellGlassBg }]}>
      <View style={styles.budgetGridCellHeader}>
        <View style={styles.budgetGridCellTitleGroup}>
          <View style={[styles.budgetGridDot, { backgroundColor: color }]} />
          <Text style={[styles.budgetGridCellTitle, { color }]}>{label}</Text>
        </View>
        <Text style={styles.budgetGridCellCount}>
          {items.length > 0
            ? `${items.length} ${items.length === 1 ? 'categoria' : 'categorias'}`
            : '0 categorias'}
        </Text>
      </View>
      <View style={styles.budgetGridList}>
        {items.length > 0 ? (
          items.slice(0, 4).map((item) => {
            const pct = Math.min(100, Math.max(0, item.percentual));
            return (
              <View key={`${item.categorias_id}-${label}`} style={styles.budgetGridItem}>
                <View style={styles.budgetGridItemRow}>
                  <Text style={styles.budgetGridItemName} numberOfLines={1}>
                    {item.nome}
                  </Text>
                  <Text style={styles.budgetGridItemValue}>{pct.toFixed(0)}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.budgetGridEmpty}>Nenhuma categoria nesta faixa</Text>
        )}
      </View>
    </View>
  );
}

export function DashboardBudgetCard({
  budgetTab,
  onBudgetTabChange,
  bucketedBudgets,
  theme,
  styles,
  isDesktop = false,
  hasAnyBudget = true,
  onOpenBudgets,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const cellGlassBg = getGlassFill(theme, isDarkMode, 'subtle');

  const emptyHint = (
    <View style={styles.budgetEmptyBanner}>
      <Text style={styles.budgetEmptyTitle}>
        Nenhum orçamento de {budgetTab === 'entrada' ? 'entrada' : 'saída'} neste mês
      </Text>
      <Text style={styles.budgetEmptySubtitle}>
        Defina valores em Orçamentos para ver OK, Atenção e Alerta aqui.
      </Text>
      {onOpenBudgets ? (
        <Pressable
          onPress={onOpenBudgets}
          style={({ pressed }) => [
            styles.budgetEmptyCta,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Abrir tela de orçamentos"
        >
          <Text style={styles.budgetEmptyCtaText}>Ir para Orçamentos</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const budgetTabs = (
        <View style={styles.budgetTabs}>
          <TouchableOpacity
            style={[styles.budgetTab, styles.budgetTabGap, budgetTab === 'entrada' && styles.budgetTabActive]}
            onPress={() => onBudgetTabChange('entrada')}
          >
            <Text style={[styles.budgetTabText, budgetTab === 'entrada' && styles.budgetTabTextActive]}>
              Entrada
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.budgetTab, budgetTab === 'saida' && styles.budgetTabActive]}
            onPress={() => onBudgetTabChange('saida')}
          >
            <Text style={[styles.budgetTabText, budgetTab === 'saida' && styles.budgetTabTextActive]}>
              Saída
            </Text>
          </TouchableOpacity>
        </View>
  );

  return (
    <MfGlassCard padding="md" intensity="strong" techVariant="surface" style={styles.budgetCardOuter}>
      <DashboardSectionHeader
        eyebrow="Orçamento"
        title={
          isDesktop
            ? 'Categorias por percentual'
            : 'Orçamento por categoria'
        }
        right={budgetTabs}
      />

      {!hasAnyBudget ? (
        emptyHint
      ) : isDesktop ? (
        <View style={styles.budgetGrid}>
          {renderDesktopCell('OK', 'verde', bucketedBudgets.verde, theme, styles, cellGlassBg)}
          {renderDesktopCell('Atenção', 'amarelo', bucketedBudgets.amarelo, theme, styles, cellGlassBg)}
          {renderDesktopCell('Cuidado', 'laranja', bucketedBudgets.laranja, theme, styles, cellGlassBg)}
          {renderDesktopCell('Alerta', 'vermelho', bucketedBudgets.vermelho, theme, styles, cellGlassBg)}
        </View>
      ) : (
        <View style={styles.budgetColumns}>
          <View style={[styles.budgetColumn, styles.budgetColumnLeft]}>
            {renderBudgetBlock('OK', 'verde', bucketedBudgets.verde, theme, styles)}
            {renderBudgetBlock('Cuidado', 'laranja', bucketedBudgets.laranja, theme, styles)}
          </View>
          <View style={styles.budgetColumn}>
            {renderBudgetBlock('Atenção', 'amarelo', bucketedBudgets.amarelo, theme, styles)}
            {renderBudgetBlock('Alerta', 'vermelho', bucketedBudgets.vermelho, theme, styles)}
          </View>
        </View>
      )}
    </MfGlassCard>
  );
}
