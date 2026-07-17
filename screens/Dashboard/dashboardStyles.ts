import { StyleSheet, type ViewStyle } from 'react-native';
import { getTheme, mfCardElevation, mfSpacing } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';

export type DashboardTheme = ReturnType<typeof getTheme>;

export const DESKTOP_MAX_WIDTH = 1280;
export const DESKTOP_PADDING_H = 24;
export const DASHBOARD_PAGE_MAX_WIDTH = 1320;

type DashboardStyleOptions = {
  isDesktop?: boolean;
  isDarkMode?: boolean;
  /** Conteúdo dentro de MfContentPanel — sem margens laterais extras */
  insidePanel?: boolean;
  /** Fundo canvas do shell (web) */
  shellCanvas?: boolean;
};

export function createDashboardStyles(
  theme: DashboardTheme,
  isDesktop: boolean = false,
  options: DashboardStyleOptions = {}
) {
  const { isDarkMode = false, insidePanel = false, shellCanvas = false } = options;
  const edgeMargin = insidePanel ? 0 : isDesktop ? 0 : 20;
  const cardShadow = mfCardElevation(theme, isDarkMode) as ViewStyle;
  const tech = getTechTokens(isDarkMode);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: shellCanvas ? theme.backgroundMuted : theme.background,
    },
    scrollView: { flex: 1 },
    contaChipsBelowHeader: {
      paddingHorizontal: insidePanel ? mfSpacing.md : 20,
      paddingTop: mfSpacing.sm,
      paddingBottom: mfSpacing.xs,
    },
    /** Filtro de contas no canvas, entre a navbar e o card principal (web shell). */
    contaChipsOnCanvas: {
      width: '100%',
      maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
      alignSelf: 'center',
      paddingHorizontal: isDesktop ? DESKTOP_PADDING_H : insidePanel ? mfSpacing.md : 20,
      marginBottom: mfSpacing.md,
    },
    scrollContent: isDesktop
      ? {
          maxWidth: DASHBOARD_PAGE_MAX_WIDTH,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: DESKTOP_PADDING_H,
          paddingBottom: 40,
          paddingTop: shellCanvas ? mfSpacing.lg : mfSpacing.md,
        }
      : {
          paddingBottom: 24,
          paddingHorizontal: mfSpacing.md,
          paddingTop: mfSpacing.sm,
        },
    techPage: {
      width: '100%',
      gap: 0,
    },
    techChipsStrip: {
      width: '100%',
      marginBottom: mfSpacing.lg,
      paddingHorizontal: isDesktop ? 0 : 0,
    },
    techMainGrid: isDesktop
      ? {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: mfSpacing.lg,
          width: '100%',
          marginBottom: mfSpacing.lg,
        }
      : {},
    techGridPrimary: isDesktop ? { flex: 1.55, minWidth: 0 } : { width: '100%', marginBottom: mfSpacing.lg },
    techGridSecondary: isDesktop ? { flex: 1, minWidth: 280, maxWidth: 420 } : { width: '100%' },
    techFullRow: {
      width: '100%',
      marginBottom: mfSpacing.lg,
    },
    bento: {
      gap: mfSpacing.lg,
      width: '100%',
    },
    bentoRow: isDesktop
      ? {
          flexDirection: 'row',
          gap: mfSpacing.md,
          alignItems: 'flex-start',
        }
      : {},
    bentoColMain: isDesktop ? { flex: 1.25, minWidth: 0 } : {},
    bentoColSide: isDesktop ? { flex: 0.85, minWidth: 0 } : {},
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, fontSize: 16, color: theme.textSecondary },

    // ===== Desktop Hero (MfCard elevado) =====
    heroCard: {
      marginTop: insidePanel ? 0 : 16,
      marginBottom: 0,
      overflow: 'hidden',
    },
    heroMonthBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)',
    },
    heroMonthPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    heroMonthPillBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroMonthPillLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      minWidth: 110,
      textAlign: 'center',
    },
    heroQuickLabel: {
      fontSize: 11,
      color: theme.textTertiary,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    heroKpis: {
      flexDirection: 'row',
    },
    heroKpi: {
      flex: 1,
      padding: 20,
      gap: 6,
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    heroKpiFirst: {
      flex: 1.4,
    },
    heroKpiLast: {
      borderRightWidth: 0,
    },
    heroKpiLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    heroKpiLabelIncome: {
      color: theme.success,
    },
    heroKpiLabelExpense: {
      color: theme.error,
    },
    heroKpiValue: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.5,
    },
    heroKpiValueIncome: {
      color: theme.success,
    },
    heroKpiValueExpense: {
      color: theme.error,
    },
    heroKpiDelta: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    heroKpiBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      marginTop: 4,
    },
    heroKpiBadgeNeutral: {
      backgroundColor: theme.background,
    },
    heroKpiBadgeIncome: {
      backgroundColor: theme.successLight,
    },
    heroKpiBadgeExpense: {
      backgroundColor: theme.errorLight,
    },
    heroKpiBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },

    // ===== Mobile cards (legado, preservado) =====
    cardsContainer: {
      padding: insidePanel ? 0 : 20,
      paddingTop: insidePanel ? 0 : 10,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      marginBottom: 12,
    },
    cardLabel: { fontSize: 14, color: theme.textSecondary, marginBottom: 8 },
    cardValue: { fontSize: 28, fontWeight: 'bold', color: theme.text },
    incomeValue: { color: theme.success },
    expenseValue: { color: theme.error },
    badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
    badgeIncome: { backgroundColor: theme.successLight },
    badgeExpense: { backgroundColor: theme.errorLight },
    badgeText: { fontSize: 12, fontWeight: '600', color: theme.text },

    // ===== Grid principal desktop =====
    gridMain: {},
    gridMainLeft: {},
    gridMainRight: {},

    // ===== Budget card (glass wrapper externo) =====
    budgetCardOuter: {
      marginHorizontal: 0,
      marginBottom: 0,
      width: '100%',
    },
    budgetCard: {},
    budgetCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    budgetCardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.text, marginRight: 12, letterSpacing: -0.2 },
    budgetTabs: {
      flexDirection: 'row',
      backgroundColor: tech.insetFill,
      borderRadius: 8,
      padding: 3,
      borderWidth: 1,
      borderColor: tech.insetBorder,
    },
    budgetTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
    budgetTabGap: { marginRight: 2 },
    budgetTabActive: {
      backgroundColor: tech.accentSoft,
      borderWidth: 1,
      borderColor: tech.panelBorder,
    },
    budgetEmptyBanner: {
      paddingVertical: 20,
      paddingHorizontal: 12,
      alignItems: 'center',
      gap: 8,
    },
    budgetEmptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    budgetEmptySubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    budgetEmptyCta: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: theme.primary,
    },
    budgetEmptyCtaText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    budgetTabText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
    budgetTabTextActive: { color: theme.text },

    // Mobile columns (preservado)
    budgetColumns: { flexDirection: 'row' },
    budgetColumn: { flex: 1 },
    budgetColumnLeft: { marginRight: 16 },
    statusBlock: { marginBottom: 16 },
    statusLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
    statusItemRow: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12 },
    statusItemHeader: { flexDirection: 'row', alignItems: 'center' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusItemTitle: { fontSize: 13, fontWeight: '500', color: theme.text, flexShrink: 1 },
    statusItemValue: { fontSize: 12, color: theme.textSecondary, marginLeft: 16, marginTop: 4 },
    statusPlaceholder: { fontSize: 12, color: theme.textTertiary },

    // Desktop budget grid 2x2
    budgetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    budgetGridCell: {
      width: '48.5%',
      borderWidth: 1,
      borderColor: tech.insetBorder,
      borderRadius: 8,
      padding: 14,
      minHeight: 130,
      backgroundColor: tech.insetFill,
    },
    budgetGridCellHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    budgetGridCellTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    budgetGridCellTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    budgetGridCellCount: {
      fontSize: 11,
      color: theme.textTertiary,
      fontWeight: '600',
    },
    budgetGridDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    budgetGridList: {
      gap: 10,
    },
    budgetGridItem: {
      gap: 4,
    },
    budgetGridItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    budgetGridItemName: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.text,
      flex: 1,
      marginRight: 8,
    },
    budgetGridItemValue: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    progressTrack: {
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    budgetGridEmpty: {
      fontSize: 12,
      color: theme.textTertiary,
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 8,
    },

    // ===== Chart / expense glass wrappers =====
    chartCardOuter: {
      marginHorizontal: 0,
      marginBottom: 0,
      width: '100%',
      flex: 1,
    },
    expenseCardOuter: {
      marginHorizontal: 0,
      marginBottom: 0,
      width: '100%',
      flex: 1,
    },
    chartContainer: {
      padding: 0,
      marginHorizontal: 0,
      marginBottom: 0,
      marginTop: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    chartTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 16 },
    chart: { marginVertical: 8, borderRadius: 16 },

    // ===== Saldo chart (SVG custom) =====
    saldoChartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    saldoChartMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    saldoChartMetaLabel: {
      fontSize: 10,
      color: theme.textTertiary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    saldoChartMetaValue: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    saldoChartPressable: {
      position: 'relative',
      marginVertical: 4,
    },
    saldoChartTooltip: {
      position: 'absolute',
      backgroundColor: theme.text,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      minWidth: 110,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 4,
    },
    saldoChartTooltipLabel: {
      fontSize: 11,
      color: theme.card,
      fontWeight: '600',
      opacity: 0.75,
      marginBottom: 2,
    },
    saldoChartTooltipValue: {
      fontSize: 14,
      color: theme.card,
      fontWeight: '700',
    },
    dailyFlowTooltip: {
      position: 'absolute',
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      minWidth: 108,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 3,
    },
    dailyFlowTooltipLabel: {
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    dailyFlowTooltipValue: {
      fontSize: 12,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },

    // Mobile expense tabs (preservado)
    expenseTabs: { flexDirection: 'row', marginBottom: 16, backgroundColor: theme.background, borderRadius: 8, padding: 4 },
    expenseTab: { flex: 1, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' },
    expenseTabActive: {
      backgroundColor: theme.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    expenseTabText: { fontSize: 14, fontWeight: '500', color: theme.textSecondary },
    expenseTabTextActive: { color: theme.text, fontWeight: '600' },
    expenseSubtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 12 },
    totalExpenseText: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 16 },
    categoryList: { marginTop: 8 },
    categoryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    categoryName: { fontSize: 14, color: theme.text, fontWeight: '500' },
    categoryAmount: { fontSize: 14, fontWeight: '600', color: theme.error },
    emptyCategoryContainer: { paddingVertical: 40, alignItems: 'center' },
    emptyCategoryText: { fontSize: 14, color: theme.textTertiary },

    // Desktop expense split
    expenseHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    expenseTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    expenseSplitRow: {
      flexDirection: 'row',
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: tech.insetBorder,
    },
    expenseSplitCol: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: tech.insetFill,
    },
    expenseSplitColDivider: {
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    expenseSplitHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 8,
      marginBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    expenseSplitTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    expenseSplitTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    expenseSplitTotal: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    expenseSplitItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 7,
      paddingLeft: 9,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    expenseSplitItemLast: {
      borderBottomWidth: 0,
    },
    expenseSplitItemName: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
      flex: 1,
      marginRight: 8,
    },
    expenseSplitItemValue: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.error,
    },
    expenseSplitEmpty: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    expenseSplitEmptyText: {
      fontSize: 13,
      color: theme.textTertiary,
      fontStyle: 'italic',
    },

    // ===== BPO (preservado integralmente) =====
    bpoSection: { marginBottom: 20 },
    bpoSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: insidePanel ? 0 : isDesktop ? 0 : 20,
      marginBottom: 12,
    },
    bpoSectionTitleGroup: { flexDirection: 'row', alignItems: 'center' },
    bpoSectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginRight: 10 },
    bpoSectionCount: { fontSize: 12, color: theme.textSecondary },
    bpoSectionChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    bpoSectionChipIncome: { backgroundColor: theme.successLight },
    bpoSectionChipExpense: { backgroundColor: theme.errorLight },
    bpoSectionChipText: { fontSize: 11, fontWeight: '600' },
    bpoSectionChipTextIncome: { color: theme.success },
    bpoSectionChipTextExpense: { color: theme.error },
    bpoCategoryCard: {
      padding: mfSpacing.md,
      marginHorizontal: insidePanel ? 0 : isDesktop ? 0 : 20,
      marginBottom: mfSpacing.md,
      overflow: 'hidden',
      maxWidth: '100%',
    },
    bpoChartEmpty: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      gap: 8,
    },
    bpoChartEmptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    bpoChartEmptyHint: {
      fontSize: 12,
      color: theme.textTertiary,
      textAlign: 'center',
    },
    bpoCategoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    bpoCategoryHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    bpoCategoryTitle: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1, marginRight: 12 },
    bpoCategoryChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
    bpoCategoryChipIncome: { backgroundColor: theme.successLight },
    bpoCategoryChipExpense: { backgroundColor: theme.errorLight },
    bpoCategoryChipText: { fontSize: 11, fontWeight: '600' },
    bpoCategoryChipTextIncome: { color: theme.success },
    bpoCategoryChipTextExpense: { color: theme.error },
    bpoCategoryValue: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
    bpoCategoryChart: { marginVertical: 4, borderRadius: 12, paddingRight: 0, paddingLeft: 0, maxWidth: '100%' },
    bpoChartCarousel: { marginTop: 4, width: '100%', maxWidth: '100%', overflow: 'hidden' },
    bpoChartCarouselContent: { alignItems: 'center' },
    bpoQuarterNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
    },
    bpoQuarterNavBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.backgroundMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bpoQuarterNavBtnDisabled: { opacity: 0.35 },
    bpoQuarterNavCenter: { flex: 1, alignItems: 'center' },
    bpoQuarterNavTitle: { fontSize: 13, fontWeight: '600', color: theme.text },
    bpoQuarterNavMeta: { fontSize: 11, color: theme.textTertiary, marginTop: 2 },
    bpoQuarterSlide: { alignItems: 'center', width: '100%', maxWidth: '100%' },
    bpoQuarterLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 },
    bpoChartSurface: {
      width: '100%',
      maxWidth: '100%',
      paddingHorizontal: mfSpacing.sm,
      paddingVertical: mfSpacing.sm,
      overflow: 'hidden',
    },
    bpoChartRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      position: 'relative',
      width: '100%',
      maxWidth: '100%',
    },
    bpoChartPlotArea: { flex: 1, minWidth: 0, position: 'relative', zIndex: 1, overflow: 'hidden' },
    bpoChartPlotInner: { position: 'relative', paddingBottom: 0, overflow: 'hidden', maxWidth: '100%' },
    bpoYAxis: {
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingLeft: 0,
      paddingRight: 4,
      zIndex: 2,
      flexShrink: 0,
    },
    bpoYAxisLabel: {
      fontSize: 10,
      color: theme.textSecondary,
      textAlign: 'right',
      width: '100%',
    },
    bpoChartOverlayRow: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' },
    bpoChartLabelsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      height: 18,
      width: '100%',
      maxWidth: '100%',
    },
    bpoChartLabelsSpacer: { height: 1, flexShrink: 0 },
    bpoChartLabelsContent: { flex: 1, minWidth: 0, flexDirection: 'row', position: 'relative', height: 18 },
    bpoChartLabelCell: { position: 'absolute', alignItems: 'center', top: 0 },
    bpoChartLabelText: { fontSize: 12, color: theme.textSecondary },
    bpoChartOverlayCell: { flex: 1 },
    bpoTooltip: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
    },
    bpoTooltipTitle: { color: theme.text, fontWeight: '700', marginBottom: 4 },
    bpoTooltipText: { color: theme.textSecondary, fontSize: 12, marginBottom: 2 },
  });
}
