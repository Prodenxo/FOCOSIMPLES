import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import type { DreMatrixCell } from '../../lib/categoryService';
import {
  aggregateBpoMonths,
  bpoMonthHeaderLabel,
  buildBpoMatrixViewModel,
  filterBpoRowsBySearch,
  formatBpoMetricValue,
  type BpoCategory,
  type BpoColumnKey,
  type BpoMatrixRow,
  type BpoMonthMetrics,
  type BpoPendingTxn,
} from '../../lib/bpoMatrix';
import type { createDashboardStyles, DashboardTheme } from './dashboardStyles';

type DashboardStyles = ReturnType<typeof createDashboardStyles>;

const DEFAULT_COLUMNS: BpoColumnKey[] = ['orcado', 'realizado', 'variacao'];
const CATEGORY_COL_WIDTH = 168;
const METRIC_COL_WIDTH = 72;
const MONTH_HEADER_ROW_HEIGHT = 30;
const COLUMN_HEADER_ROW_HEIGHT = 28;
const DATA_ROW_MIN_HEIGHT = 36;

const COLUMN_LABELS: Record<BpoColumnKey, string> = {
  orcado: 'Orçado',
  realizado: 'Realizado',
  variacao: 'Variação',
};

type Props = {
  year: number;
  categories: BpoCategory[];
  cells: DreMatrixCell[];
  transactions: BpoPendingTxn[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  theme: DashboardTheme;
  styles: DashboardStyles;
  isDarkMode: boolean;
};

function toggleColumn(columns: BpoColumnKey[], key: BpoColumnKey): BpoColumnKey[] {
  if (columns.includes(key)) {
    const next = columns.filter((c) => c !== key);
    return next.length === 0 ? columns : next;
  }
  return [...columns, key];
}

function MetricCell({
  metrics,
  column,
  textColor,
  borderColor,
}: {
  metrics: BpoMonthMetrics;
  column: BpoColumnKey;
  textColor: string;
  borderColor: string;
}) {
  return (
    <View
      style={{
        minWidth: 72,
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderLeftWidth: 1,
        borderLeftColor: borderColor,
        alignItems: 'flex-end',
      }}
    >
      <Text style={{ fontSize: 10, color: textColor, fontVariant: ['tabular-nums'] }}>
        {formatBpoMetricValue(column, metrics)}
      </Text>
    </View>
  );
}

function MonthBlock({
  metrics,
  visibleColumns,
  textColor,
  borderColor,
}: {
  metrics: BpoMonthMetrics;
  visibleColumns: BpoColumnKey[];
  textColor: string;
  borderColor: string;
}) {
  return (
    <>
      {visibleColumns.map((col) => (
        <MetricCell
          key={col}
          metrics={metrics}
          column={col}
          textColor={textColor}
          borderColor={borderColor}
        />
      ))}
    </>
  );
}

function monthBlockWidth(visibleColumns: BpoColumnKey[]) {
  return visibleColumns.length * METRIC_COL_WIDTH;
}

function metricsTableWidth(visibleColumns: BpoColumnKey[]) {
  return monthBlockWidth(visibleColumns) * 13;
}

function CategoryLabelCell({
  label,
  labelColor,
  borderColor,
  backgroundColor,
  bold = false,
  minHeight = DATA_ROW_MIN_HEIGHT,
}: {
  label: string;
  labelColor: string;
  borderColor: string;
  backgroundColor: string;
  bold?: boolean;
  minHeight?: number;
}) {
  return (
    <View
      style={{
        width: CATEGORY_COL_WIDTH,
        minHeight,
        paddingVertical: 8,
        paddingHorizontal: 8,
        justifyContent: 'center',
        backgroundColor,
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
        borderRightWidth: 1,
        borderRightColor: borderColor,
      }}
    >
      <Text
        style={{
          fontSize: bold ? 12 : 11,
          fontWeight: bold ? '700' : '500',
          color: labelColor,
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

function MetricsDataRow({
  months,
  annual,
  visibleColumns,
  textColor,
  borderColor,
  backgroundColor,
  bold = false,
}: {
  months: BpoMonthMetrics[];
  annual: BpoMonthMetrics;
  visibleColumns: BpoColumnKey[];
  textColor: string;
  borderColor: string;
  backgroundColor: string;
  bold?: boolean;
}) {
  const blockWidth = monthBlockWidth(visibleColumns);
  return (
    <View
      style={{
        flexDirection: 'row',
        minHeight: DATA_ROW_MIN_HEIGHT,
        backgroundColor,
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
      }}
    >
      {months.map((month, mi) => (
        <View key={mi} style={{ flexDirection: 'row', width: blockWidth }}>
          <MonthBlock
            metrics={month}
            visibleColumns={visibleColumns}
            textColor={textColor}
            borderColor={borderColor}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row', width: blockWidth }}>
        <MonthBlock
          metrics={annual}
          visibleColumns={visibleColumns}
          textColor={bold ? textColor : textColor}
          borderColor={borderColor}
        />
      </View>
    </View>
  );
}

function MetricsTableHeader({
  year,
  visibleColumns,
  labelColor,
  textColor,
  borderColor,
  backgroundColor,
}: {
  year: number;
  visibleColumns: BpoColumnKey[];
  labelColor: string;
  textColor: string;
  borderColor: string;
  backgroundColor: string;
}) {
  const blockWidth = monthBlockWidth(visibleColumns);
  return (
    <View style={{ backgroundColor }}>
      <View style={{ flexDirection: 'row', minHeight: MONTH_HEADER_ROW_HEIGHT }}>
        {Array.from({ length: 12 }, (_, mi) => (
          <View
            key={mi}
            style={{
              width: blockWidth,
              justifyContent: 'center',
              alignItems: 'center',
              borderLeftWidth: 1,
              borderLeftColor: borderColor,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: labelColor }}>
              {bpoMonthHeaderLabel(mi, year)}
            </Text>
          </View>
        ))}
        <View
          style={{
            width: blockWidth,
            justifyContent: 'center',
            alignItems: 'center',
            borderLeftWidth: 1,
            borderLeftColor: borderColor,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: labelColor }}>Total</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', minHeight: COLUMN_HEADER_ROW_HEIGHT }}>
        {Array.from({ length: 13 }, (_, block) => (
          <View key={block} style={{ flexDirection: 'row', width: blockWidth }}>
            {visibleColumns.map((col) => (
              <View
                key={`${block}-${col}`}
                style={{
                  width: METRIC_COL_WIDTH,
                  paddingVertical: 4,
                  alignItems: 'flex-end',
                  paddingRight: 4,
                  borderLeftWidth: 1,
                  borderLeftColor: borderColor,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 9, color: textColor }}>{COLUMN_LABELS[col]}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function FixedCategoryHeader({
  textColor,
  borderColor,
  backgroundColor,
}: {
  textColor: string;
  borderColor: string;
  backgroundColor: string;
}) {
  return (
    <View style={{ backgroundColor }}>
      <View
        style={{
          width: CATEGORY_COL_WIDTH,
          minHeight: MONTH_HEADER_ROW_HEIGHT,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          borderRightWidth: 1,
          borderRightColor: borderColor,
        }}
      />
      <View
        style={{
          width: CATEGORY_COL_WIDTH,
          minHeight: COLUMN_HEADER_ROW_HEIGHT,
          paddingHorizontal: 8,
          justifyContent: 'center',
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          borderRightWidth: 1,
          borderRightColor: borderColor,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '600', color: textColor }}>Categoria</Text>
      </View>
    </View>
  );
}

function CategoryRows({
  rows,
  visibleColumns,
  condensed,
  labelColor,
  borderColor,
  panelBg,
}: {
  rows: BpoMatrixRow[];
  visibleColumns: BpoColumnKey[];
  condensed: boolean;
  labelColor: string;
  borderColor: string;
  panelBg: string;
}) {
  if (condensed) return null;

  return (
    <>
      {rows.map((row) => (
        <CategoryLabelCell
          key={row.categoriasId}
          label={row.nome}
          labelColor={labelColor}
          borderColor={borderColor}
          backgroundColor={panelBg}
        />
      ))}
    </>
  );
}

function CategoryMetricsRows({
  rows,
  visibleColumns,
  condensed,
  textColor,
  borderColor,
  panelBg,
}: {
  rows: BpoMatrixRow[];
  visibleColumns: BpoColumnKey[];
  condensed: boolean;
  textColor: string;
  borderColor: string;
  panelBg: string;
}) {
  if (condensed) return null;

  return (
    <>
      {rows.map((row) => (
        <MetricsDataRow
          key={row.categoriasId}
          months={row.byMonth}
          annual={row.annual}
          visibleColumns={visibleColumns}
          textColor={textColor}
          borderColor={borderColor}
          backgroundColor={panelBg}
        />
      ))}
    </>
  );
}

export function BpoBudgetMatrixPanel({
  year,
  categories,
  cells,
  transactions,
  loading,
  error,
  onRetry,
  theme,
  styles,
  isDarkMode,
}: Props) {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<BpoColumnKey[]>(DEFAULT_COLUMNS);
  const [condensed, setCondensed] = useState(false);
  const [openReceitas, setOpenReceitas] = useState(true);
  const [openDespesas, setOpenDespesas] = useState(true);

  const tech = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const borderColor = tech.insetBorder;
  const textColor = theme.textSecondary;
  const labelColor = theme.text;

  const model = useMemo(
    () => buildBpoMatrixViewModel(categories, cells, transactions, year),
    [categories, cells, transactions, year]
  );

  const receitas = useMemo(
    () => filterBpoRowsBySearch(model.receitas, appliedSearch),
    [model.receitas, appliedSearch]
  );
  const despesas = useMemo(
    () => filterBpoRowsBySearch(model.despesas, appliedSearch),
    [model.despesas, appliedSearch]
  );

  const sumSection = (rows: BpoMatrixRow[]) => {
    if (rows.length === 0) {
      return Array.from({ length: 12 }, () => ({
        orcado: null,
        previsto: 0,
        realizado: 0,
        variacao: null,
      }));
    }
    return rows.reduce(
      (acc, row) =>
        acc.map((m, idx) => ({
          orcado:
            row.byMonth[idx].orcado !== null || m.orcado !== null
              ? (m.orcado ?? 0) + (row.byMonth[idx].orcado ?? 0)
              : null,
          previsto: m.previsto + row.byMonth[idx].previsto,
          realizado: m.realizado + row.byMonth[idx].realizado,
          variacao: null as number | null,
        })),
      Array.from({ length: 12 }, () => ({
        orcado: null as number | null,
        previsto: 0,
        realizado: 0,
        variacao: null as number | null,
      }))
    ).map((m) => ({
      ...m,
      variacao: m.orcado !== null ? m.realizado - m.orcado : null,
    }));
  };

  const receitaSubtotal = useMemo(() => sumSection(receitas), [receitas]);
  const despesaSubtotal = useMemo(() => sumSection(despesas), [despesas]);

  const resultadoFiltrado = useMemo(
    () =>
      receitaSubtotal.map((r, idx) => {
        const d = despesaSubtotal[idx];
        const orcado =
          r.orcado !== null || d.orcado !== null ? (r.orcado ?? 0) - (d.orcado ?? 0) : null;
        return {
          orcado,
          previsto: r.previsto - d.previsto,
          realizado: r.realizado - d.realizado,
          variacao: orcado !== null ? r.realizado - d.realizado - orcado : null,
        };
      }),
    [receitaSubtotal, despesaSubtotal]
  );

  const resultadoAnual = useMemo(
    () => aggregateBpoMonths(resultadoFiltrado),
    [resultadoFiltrado]
  );

  const isEmpty = receitas.length === 0 && despesas.length === 0;
  const metricsWidth = metricsTableWidth(visibleColumns);
  const panelBg = isDarkMode ? '#0f172a' : '#ffffff';
  const headerBg = tech.insetFill;

  const receitaBg = isDarkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)';
  const despesaBg = tech.insetFill;
  const resultadoBg = isDarkMode ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.08)';

  const TOGGLE_ROW_HEIGHT = 38;

  const renderSectionToggleLeft = (
    label: string,
    open: boolean,
    onToggle: () => void,
    accentColor: string,
    bg: string,
  ) => (
    <Pressable
      onPress={onToggle}
      style={{
        width: CATEGORY_COL_WIDTH,
        minHeight: TOGGLE_ROW_HEIGHT,
        paddingHorizontal: 8,
        justifyContent: 'center',
        backgroundColor: bg,
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
        borderRightWidth: 1,
        borderRightColor: borderColor,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: accentColor }}>
        {open ? '▼' : '▶'} {label}
      </Text>
    </Pressable>
  );

  if (error) {
    return (
      <View style={[styles.emptyCategoryContainer, { gap: mfSpacing.sm }]}>
        <Text style={styles.emptyCategoryText}>{error}</Text>
        <Pressable onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && categories.length === 0) {
    return (
      <View style={[styles.loadingContainer, { minHeight: 160, paddingVertical: 32 }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Carregando matriz BPO...</Text>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.emptyCategoryContainer}>
        <Text style={styles.emptyCategoryText}>
          Sem dados para {year}. Defina orçamentos ou registe movimentos.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: mfSpacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: mfSpacing.sm, alignItems: 'center' }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Categoria..."
          placeholderTextColor={theme.textSecondary}
          onSubmitEditing={() => setAppliedSearch(search.trim())}
          style={{
            flexGrow: 1,
            minWidth: 140,
            borderWidth: 1,
            borderColor: tech.insetBorder,
            borderRadius: mfRadius.sm,
            paddingHorizontal: 10,
            paddingVertical: 8,
            fontSize: 13,
            color: labelColor,
            backgroundColor: tech.insetFill,
          }}
        />
        <Pressable
          onPress={() => setAppliedSearch(search.trim())}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: mfRadius.sm,
            borderWidth: 1,
            borderColor: tech.insetBorder,
            backgroundColor: tech.insetFill,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: labelColor }}>Aplicar</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 6 }}>
        {DEFAULT_COLUMNS.map((col) => {
          const active = visibleColumns.includes(col);
          return (
            <Pressable
              key={col}
              onPress={() => setVisibleColumns((prev) => toggleColumn(prev, col))}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: mfRadius.sm,
                borderWidth: 1,
                borderColor: active ? tech.accent : tech.insetBorder,
                backgroundColor: active ? tech.accentSoft : tech.insetFill,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: active ? tech.accent : textColor,
                }}
              >
                {COLUMN_LABELS[col]}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setCondensed((v) => !v)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: mfRadius.sm,
            borderWidth: 1,
            borderColor: tech.insetBorder,
            backgroundColor: tech.insetFill,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: labelColor }}>
            {condensed ? 'Expandir' : 'Condensar'}
          </Text>
        </Pressable>
      </ScrollView>

      <View
        style={{
          borderWidth: 1,
          borderColor,
          borderRadius: mfRadius.md,
          backgroundColor: panelBg,
        }}
      >
        {loading ? (
          <View style={{ padding: mfSpacing.md, alignItems: 'center' }}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View>
            <FixedCategoryHeader
              textColor={textColor}
              borderColor={borderColor}
              backgroundColor={headerBg}
            />
            {renderSectionToggleLeft(
              '(+) Receitas',
              openReceitas,
              () => setOpenReceitas((v) => !v),
              isDarkMode ? '#6ee7b7' : '#047857',
              isDarkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
            )}
            {openReceitas ? (
              <>
                <CategoryRows
                  rows={receitas}
                  visibleColumns={visibleColumns}
                  condensed={condensed}
                  labelColor={labelColor}
                  borderColor={borderColor}
                  panelBg={panelBg}
                />
                {!condensed ? (
                  <CategoryLabelCell
                    label="Subtotal receitas"
                    labelColor={labelColor}
                    borderColor={borderColor}
                    backgroundColor={receitaBg}
                    bold
                  />
                ) : null}
              </>
            ) : null}
            {renderSectionToggleLeft(
              '(−) Despesas',
              openDespesas,
              () => setOpenDespesas((v) => !v),
              labelColor,
              tech.insetFill,
            )}
            {openDespesas ? (
              <>
                <CategoryRows
                  rows={despesas}
                  visibleColumns={visibleColumns}
                  condensed={condensed}
                  labelColor={labelColor}
                  borderColor={borderColor}
                  panelBg={panelBg}
                />
                {!condensed ? (
                  <CategoryLabelCell
                    label="Subtotal despesas"
                    labelColor={labelColor}
                    borderColor={borderColor}
                    backgroundColor={despesaBg}
                    bold
                  />
                ) : null}
              </>
            ) : null}
            <CategoryLabelCell
              label="(=) Resultado"
              labelColor={labelColor}
              borderColor={borderColor}
              backgroundColor={resultadoBg}
              bold
              minHeight={40}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View style={{ width: metricsWidth }}>
              <MetricsTableHeader
                year={year}
                visibleColumns={visibleColumns}
                labelColor={labelColor}
                textColor={textColor}
                borderColor={borderColor}
                backgroundColor={headerBg}
              />
              <View
                style={{
                  minHeight: TOGGLE_ROW_HEIGHT,
                  backgroundColor: isDarkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                }}
              />
              {openReceitas ? (
                <>
                  <CategoryMetricsRows
                    rows={receitas}
                    visibleColumns={visibleColumns}
                    condensed={condensed}
                    textColor={textColor}
                    borderColor={borderColor}
                    panelBg={panelBg}
                  />
                  {!condensed ? (
                    <MetricsDataRow
                      months={receitaSubtotal}
                      annual={aggregateBpoMonths(receitaSubtotal)}
                      visibleColumns={visibleColumns}
                      textColor={labelColor}
                      borderColor={borderColor}
                      backgroundColor={receitaBg}
                      bold
                    />
                  ) : null}
                </>
              ) : null}
              <View
                style={{
                  minHeight: TOGGLE_ROW_HEIGHT,
                  backgroundColor: tech.insetFill,
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                }}
              />
              {openDespesas ? (
                <>
                  <CategoryMetricsRows
                    rows={despesas}
                    visibleColumns={visibleColumns}
                    condensed={condensed}
                    textColor={textColor}
                    borderColor={borderColor}
                    panelBg={panelBg}
                  />
                  {!condensed ? (
                    <MetricsDataRow
                      months={despesaSubtotal}
                      annual={aggregateBpoMonths(despesaSubtotal)}
                      visibleColumns={visibleColumns}
                      textColor={labelColor}
                      borderColor={borderColor}
                      backgroundColor={despesaBg}
                      bold
                    />
                  ) : null}
                </>
              ) : null}
              <MetricsDataRow
                months={resultadoFiltrado}
                annual={resultadoAnual}
                visibleColumns={visibleColumns}
                textColor={labelColor}
                borderColor={borderColor}
                backgroundColor={resultadoBg}
                bold
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
