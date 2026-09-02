import React from 'react';
import { View, Text, TouchableOpacity, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { MfGlassCard } from '../../components/ui';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { createDashboardStyles, type DashboardTheme } from './dashboardStyles';

type DashboardStyles = ReturnType<typeof createDashboardStyles>;

type Props = {
  expenseTab: 'pagos' | 'a_pagar';
  onExpenseTabChange: (tab: 'pagos' | 'a_pagar') => void;
  expensesByCategory: Record<string, number>;
  categoriasMap: Record<string, string>;
  totalFiltrado: number;
  styles: DashboardStyles;
  isDesktop?: boolean;
  theme?: DashboardTheme;
  expensesPagos?: Record<string, number>;
  expensesAPagar?: Record<string, number>;
  totalPagos?: number;
  totalAPagar?: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Evita nós de texto acidentais no RN Web (espaços entre filhos de View). */
function RowView({ style, children }: { style?: ViewStyle | ViewStyle[]; children: React.ReactNode[] }) {
  return <View style={style}>{children}</View>;
}

function ExpenseSplitItem({
  catId,
  amount,
  isLast,
  categoriasMap,
  styles,
  theme,
  isPagos,
  isDarkMode,
}: {
  catId: string;
  amount: number;
  isLast: boolean;
  categoriasMap: Record<string, string>;
  styles: DashboardStyles;
  theme: DashboardTheme;
  isPagos: boolean;
  isDarkMode: boolean;
}) {
  const tokens = getTechTokens(isDarkMode);
  const hoverFill = isDarkMode ? 'rgba(34, 211, 238, 0.06)' : 'rgba(29, 78, 216, 0.05)';
  const valueColor = isPagos ? theme.success : theme.error;

  return (
    <Pressable accessibilityRole="button">
      {({ hovered, pressed }) => (
        <RowView
          style={[
            styles.expenseSplitItem,
            isLast && styles.expenseSplitItemLast,
            (hovered || pressed) && { backgroundColor: hoverFill },
            (hovered || pressed) && { borderLeftWidth: 3, borderLeftColor: tokens.accent },
          ]}
        >
          {[
            <Text key="n" style={styles.expenseSplitItemName} numberOfLines={1}>
              {categoriasMap[catId] || catId}
            </Text>,
            <Text key="v" style={[styles.expenseSplitItemValue, { color: valueColor }]}>
              {formatCurrency(amount)}
            </Text>,
          ]}
        </RowView>
      )}
    </Pressable>
  );
}

function renderSplitColumn(
  columnKey: string,
  title: string,
  total: number,
  expenses: Record<string, number>,
  categoriasMap: Record<string, string>,
  styles: DashboardStyles,
  theme: DashboardTheme,
  isPagos: boolean,
  divider: boolean,
  isDarkMode: boolean,
) {
  const entries = Object.entries(expenses).sort((a, b) => b[1] - a[1]);
  const dotColor = isPagos ? theme.success : theme.error;
  const totalStyle: TextStyle[] = [styles.expenseSplitTotal];
  if (isPagos) totalStyle.push({ color: theme.success });

  const header = (
    <RowView key={`${columnKey}-header`} style={styles.expenseSplitHeader}>
      {[
        <RowView key={`${columnKey}-title-group`} style={styles.expenseSplitTitleGroup}>
          {[
            <View key={`${columnKey}-dot`} style={[styles.budgetGridDot, { backgroundColor: dotColor }]} />,
            <Text key={`${columnKey}-title`} style={styles.expenseSplitTitle}>{title}</Text>,
          ]}
        </RowView>,
        <Text key={`${columnKey}-total`} style={totalStyle}>{formatCurrency(total)}</Text>,
      ]}
    </RowView>
  );

  const body =
    entries.length > 0
      ? entries.map(([catId, amount], index) => (
          <ExpenseSplitItem
            key={`${columnKey}-${catId}-${index}`}
            catId={catId}
            amount={amount}
            isLast={index === entries.length - 1}
            categoriasMap={categoriasMap}
            styles={styles}
            theme={theme}
            isPagos={isPagos}
            isDarkMode={isDarkMode}
          />
        ))
      : [
          <View key={`${columnKey}-empty`} style={styles.expenseSplitEmpty}>
            <Text style={styles.expenseSplitEmptyText}>
              {isPagos ? 'Nenhuma despesa paga' : 'Nenhuma despesa pendente'}
            </Text>
          </View>,
        ];

  return (
    <View key={columnKey} style={[styles.expenseSplitCol, divider ? styles.expenseSplitColDivider : null]}>
      {[header, ...body]}
    </View>
  );
}

function CategoryRow({
  catId,
  amount,
  categoriasMap,
  styles,
}: {
  catId: string;
  amount: number;
  categoriasMap: Record<string, string>;
  styles: DashboardStyles;
}) {
  return (
    <RowView style={styles.categoryItem}>
      {[
        <Text key="n" style={styles.categoryName}>{categoriasMap[catId] || catId}</Text>,
        <Text key="v" style={styles.categoryAmount}>{formatCurrency(amount)}</Text>,
      ]}
    </RowView>
  );
}

export function DashboardExpenseSection({
  expenseTab,
  onExpenseTabChange,
  expensesByCategory,
  categoriasMap,
  totalFiltrado,
  styles,
  isDesktop = false,
  theme,
  expensesPagos,
  expensesAPagar,
  totalPagos = 0,
  totalAPagar = 0,
}: Props) {
  const { isDarkMode } = useMfTheme();

  if (isDesktop && theme && expensesPagos && expensesAPagar) {
    const pagosCol = renderSplitColumn(
      'pagos-col', 'Pagos', totalPagos, expensesPagos, categoriasMap, styles, theme, true, true, isDarkMode,
    );
    const aPagarCol = renderSplitColumn(
      'a-pagar-col', 'A Pagar', totalAPagar, expensesAPagar, categoriasMap, styles, theme, false, false, isDarkMode,
    );

    return (
      <MfGlassCard padding="md" intensity="strong" techVariant="surface" style={styles.expenseCardOuter}>
        {[
          <DashboardSectionHeader key="hdr" eyebrow="Fluxo" title="Movimentações do mês" />,
          <RowView key="cols" style={styles.expenseSplitRow}>{[pagosCol, aPagarCol]}</RowView>,
        ]}
      </MfGlassCard>
    );
  }

  const sortedCategories = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <MfGlassCard padding="md" intensity="strong" tech style={styles.expenseCardOuter}>
      {[
        <DashboardSectionHeader key="hdr" eyebrow="Fluxo" title="Movimentações do mês" />,
        <RowView key="tabs" style={styles.expenseTabs}>
          {[
            <TouchableOpacity
              key="pagos"
              style={[styles.expenseTab, expenseTab === 'pagos' ? styles.expenseTabActive : null]}
              onPress={() => onExpenseTabChange('pagos')}
            >
              <Text style={[styles.expenseTabText, expenseTab === 'pagos' ? styles.expenseTabTextActive : null]}>
                Pagos
              </Text>
            </TouchableOpacity>,
            <TouchableOpacity
              key="apagar"
              style={[styles.expenseTab, expenseTab === 'a_pagar' ? styles.expenseTabActive : null]}
              onPress={() => onExpenseTabChange('a_pagar')}
            >
              <Text style={[styles.expenseTabText, expenseTab === 'a_pagar' ? styles.expenseTabTextActive : null]}>
                A Pagar
              </Text>
            </TouchableOpacity>,
          ]}
        </RowView>,
        <Text key="sub" style={styles.expenseSubtitle}>Detalhes por categoria</Text>,
        <Text key="tot" style={styles.totalExpenseText}>
          {`Total ${expenseTab === 'pagos' ? 'pago' : 'a pagar'}: ${formatCurrency(totalFiltrado)}`}
        </Text>,
        sortedCategories.length > 0 ? (
          <View key="list" style={styles.categoryList}>
            {sortedCategories.map(([catId, amount], index) => (
              <CategoryRow
                key={`${catId}-${index}`}
                catId={catId}
                amount={amount}
                categoriasMap={categoriasMap}
                styles={styles}
              />
            ))}
          </View>
        ) : (
          <View key="empty" style={styles.emptyCategoryContainer}>
            <Text style={styles.emptyCategoryText}>
              {`Nenhuma despesa ${expenseTab === 'pagos' ? 'paga' : 'a pagar'} neste mês`}
            </Text>
          </View>
        ),
      ]}
    </MfGlassCard>
  );
}
