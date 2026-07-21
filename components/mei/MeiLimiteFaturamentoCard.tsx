import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '../ui/useMfTheme'
import { getTechTokens } from '../../lib/techDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { formatCurrencyBR } from '../../lib/numberFormat'
import type { MeiLimiteBandaOuIndeterminado, MeiLimiteProgresso } from '../../lib/meiLimiteFaturamento'
import type { LimiteFaturamentoRegime } from '../../lib/meiLimiteFaturamentoConfig'

export interface MeiLimiteFaturamentoCardProps {
  anoCivil: number
  progresso: MeiLimiteProgresso
  vigenciaLabel: string | null
  loading?: boolean
  onIrParaNotas?: () => void
  /** `mei` (padrão) ou `simples` — altera título, copy e marca do sublimite. */
  variant?: LimiteFaturamentoRegime
}

function labelForBanda(b: MeiLimiteBandaOuIndeterminado): string {
  switch (b) {
    case 'seguro':
      return 'Confortável'
    case 'atencao':
      return 'Atenção'
    case 'critico':
      return 'Crítico'
    default:
      return 'Indeterminado'
  }
}

function messageForBanda(
  b: MeiLimiteBandaOuIndeterminado,
  variant: LimiteFaturamentoRegime,
): string {
  if (variant === 'simples') {
    switch (b) {
      case 'seguro':
        return 'Receita bruta confortável face ao limite anual do Simples Nacional.'
      case 'atencao':
        return 'Você já utilizou grande parte do limite anual de R$ 4,8 milhões.'
      case 'critico':
        return 'Próximo do teto do Simples — planeje o enquadramento e consulte um contador.'
      default:
        return 'Limite de referência ou percentual não disponível para este período.'
    }
  }
  switch (b) {
    case 'seguro':
      return 'Situação confortável face ao limite de referência do ano.'
    case 'atencao':
      return 'Você já utilizou grande parte do limite de referência do ano.'
    case 'critico':
      return 'Próximo do limite de referência — planeje próximos passos e consulte um contador se necessário.'
    default:
      return 'Limite de referência ou percentual não disponível para este período.'
  }
}

function bandaColors(
  b: MeiLimiteBandaOuIndeterminado,
  theme: ReturnType<typeof useMfTheme>['theme'],
): { badgeBg: string; badgeText: string; bar: string } {
  switch (b) {
    case 'seguro':
      return { badgeBg: theme.successLight, badgeText: theme.success, bar: theme.success }
    case 'atencao':
      return { badgeBg: '#FEF3C7', badgeText: theme.warning, bar: theme.warning }
    case 'critico':
      return { badgeBg: theme.errorLight, badgeText: theme.error, bar: theme.error }
    default:
      return { badgeBg: theme.borderLight, badgeText: theme.textSecondary, bar: theme.textTertiary }
  }
}

function formatPercentDisplay(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—'
  return `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`
}

export function MeiLimiteFaturamentoCard({
  anoCivil,
  progresso,
  vigenciaLabel,
  loading = false,
  onIrParaNotas,
  variant = 'mei',
}: MeiLimiteFaturamentoCardProps) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens])
  const [baseOpen, setBaseOpen] = useState(false)

  const regime = progresso.regime ?? variant
  const isSimples = regime === 'simples' || variant === 'simples'
  const colors = bandaColors(progresso.banda, theme)
  const barPercent = progresso.percentualUtilizadoParaBarra
  const showBar =
    progresso.limiteReferenciaReais != null
    && progresso.limiteReferenciaReais > 0
    && barPercent != null

  const sublimite = progresso.sublimiteReais
  const showSublimiteMarker =
    isSimples
    && showBar
    && sublimite != null
    && sublimite > 0
    && progresso.limiteReferenciaReais != null
    && progresso.limiteReferenciaReais > 0
  const sublimiteMarkerLeftPct = showSublimiteMarker
    ? Math.min(100, Math.max(0, (sublimite! / progresso.limiteReferenciaReais!) * 100))
    : null

  const isEmpty =
    !loading
    && progresso.notasConsideradas === 0
    && progresso.totalUtilizadoReais === 0

  const aboveLimit =
    progresso.percentualUtilizado != null
    && progresso.percentualUtilizado > 100
    && progresso.limiteReferenciaReais != null
    && progresso.limiteReferenciaReais > 0

  const title = isSimples
    ? 'Limite de faturamento (Simples)'
    : 'Limite de faturamento (MEI)'
  const a11yLabel = isSimples
    ? `Limite de faturamento Simples Nacional. Ano civil ${anoCivil}.`
    : `Limite de faturamento MEI. Ano civil ${anoCivil}.`

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <Ionicons name="speedometer-outline" size={20} color={theme.primary} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.subtitle}>
            Ano civil {anoCivil}
            {vigenciaLabel ? ` · ${vigenciaLabel}` : ''}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.badgeBg }]}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.badgeText, { color: colors.badgeText }]}>
              {labelForBanda(progresso.banda)}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.loadingText}>Carregando progresso do limite…</Text>
        </View>
      ) : null}

      {!loading ? (
        <>
          {isEmpty ? (
            <Text style={styles.emptyText}>
              {isSimples
                ? 'Ainda não há notas autorizadas neste ano para calcular o progresso. Quando emitir NFS-e, NF-e ou NFC-e, o total aparece aqui.'
                : 'Ainda não há NFS-e autorizadas neste ano para calcular o progresso. Quando emitir, o total aparece aqui.'}
            </Text>
          ) : null}

          {showBar ? (
            <View style={styles.barBlock}>
              <View
                style={styles.barTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(barPercent ?? 0),
                  text: `${formatPercentDisplay(progresso.percentualUtilizado)} utilizado`,
                }}
              >
                <View
                  style={[
                    styles.barFill,
                    { width: `${barPercent}%`, backgroundColor: colors.bar },
                  ]}
                />
                {showSublimiteMarker && sublimiteMarkerLeftPct != null ? (
                  <View
                    style={[
                      styles.sublimiteMarker,
                      { left: `${sublimiteMarkerLeftPct}%`, backgroundColor: theme.warning },
                    ]}
                    accessibilityLabel={`Sublimite ICMS/ISS em ${formatCurrencyBR(sublimite!)}`}
                  />
                ) : null}
              </View>
              <View style={styles.barMeta}>
                <Text style={styles.percentText}>
                  {formatPercentDisplay(progresso.percentualUtilizado)}
                </Text>
                <Text style={styles.amountText}>
                  {formatCurrencyBR(progresso.totalUtilizadoReais)} de{' '}
                  {formatCurrencyBR(progresso.limiteReferenciaReais ?? 0)}
                </Text>
              </View>
              {showSublimiteMarker ? (
                <Text
                  style={[
                    styles.sublimiteHint,
                    progresso.atingiuSublimite && { color: theme.warning, fontWeight: '600' },
                  ]}
                >
                  {progresso.atingiuSublimite
                    ? `Sublimite ICMS/ISS atingido (${formatCurrencyBR(sublimite!)}) — ${formatPercentDisplay(progresso.percentualSublimite)} do sublimite.`
                    : `Marca: sublimite ICMS/ISS ${formatCurrencyBR(sublimite!)} (${formatPercentDisplay(progresso.percentualSublimite)} do sublimite).`}
                </Text>
              ) : null}
              {aboveLimit ? (
                <Text style={styles.aboveLimitText}>
                  Acima do limite de referência — o percentual pode ultrapassar 100%.
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.amountOnly}>
              {formatCurrencyBR(progresso.totalUtilizadoReais)}
            </Text>
          )}

          <Text style={styles.bandaMessage}>{messageForBanda(progresso.banda, isSimples ? 'simples' : 'mei')}</Text>

          <View style={styles.baseSection}>
            <Text style={styles.baseLine}>
              <Text style={styles.baseLabel}>Base (MVP): </Text>
              {isSimples
                ? `soma das NFS-e, NF-e e NFC-e com emissão concluída nesta conta no ano civil ${anoCivil}.`
                : `soma das NFS-e com emissão concluída nesta conta no ano civil ${anoCivil}. NF-e e NFC-e não entram neste total.`}
            </Text>
            <Pressable
              onPress={() => setBaseOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: baseOpen }}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
            >
              <Text style={styles.linkText}>
                {baseOpen ? 'Fechar explicação' : 'Como calculamos'}
              </Text>
            </Pressable>
            {baseOpen ? (
              <View style={styles.basePanel}>
                <Text style={styles.basePanelText}>
                  {isSimples
                    ? 'Total das notas autorizadas (NFS-e, NF-e e NFC-e) por esta conta no ano civil, comparado ao limite anual do Simples Nacional (R$ 4,8 milhões). A marca amarela indica o sublimite de ICMS/ISS (R$ 3,6 milhões).'
                    : 'Total das NFS-e autorizadas por esta conta no ano civil, comparado ao limite de referência configurado. Notas arquivadas entram no total. Só notas em processamento ou canceladas ficam de fora.'}
                </Text>
                <Text style={[styles.basePanelText, styles.basePanelTextSpaced]}>
                  {isSimples
                    ? 'Indicador aproximado a partir das notas emitidas pelo app. Não inclui receitas fora deste sistema nem substitui a apuração do PGDAS-D.'
                    : 'NF-e e NFC-e seguem regras de ICMS/SEFAZ e não são somadas neste indicador.'}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.disclaimer}>
            Indicador informativo. Não substitui contabilidade nem conferência com a Receita Federal.
          </Text>

          {onIrParaNotas ? (
            <Pressable
              onPress={onIrParaNotas}
              style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Ver notas fiscais</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.primary} />
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  )
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: mfRadius.md,
      padding: mfSpacing.lg,
      marginBottom: mfSpacing.md,
      gap: mfSpacing.sm,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.sm,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.xs,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: mfRadius.sm,
      minWidth: 88,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    loadingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingVertical: mfSpacing.sm,
    },
    loadingText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    barBlock: { gap: mfSpacing.xs },
    barTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: tokens.insetFill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      overflow: 'hidden',
      position: 'relative',
    },
    barFill: {
      height: '100%',
      borderRadius: 999,
    },
    sublimiteMarker: {
      position: 'absolute',
      top: -2,
      bottom: -2,
      width: 2,
      marginLeft: -1,
      borderRadius: 1,
      zIndex: 2,
    },
    sublimiteHint: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    barMeta: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: mfSpacing.xs,
    },
    percentText: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
    },
    amountText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    aboveLimitText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.error,
    },
    amountOnly: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    bandaMessage: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    baseSection: {
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
      paddingTop: mfSpacing.sm,
      gap: mfSpacing.xs,
    },
    baseLine: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    baseLabel: {
      fontWeight: '700',
      color: theme.text,
    },
    linkBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    linkBtnPressed: { opacity: 0.8 },
    linkText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.primary,
    },
    basePanel: {
      backgroundColor: tokens.insetFill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      borderRadius: mfRadius.sm,
      padding: mfSpacing.sm,
      gap: mfSpacing.xs,
    },
    basePanelText: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    basePanelTextSpaced: { marginTop: 2 },
    disclaimer: {
      fontSize: 11,
      color: theme.textTertiary,
      lineHeight: 16,
    },
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 6,
    },
    ctaBtnPressed: { opacity: 0.85 },
    ctaText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
    },
  })
}
