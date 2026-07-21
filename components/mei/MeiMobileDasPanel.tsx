import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MfScrollView } from '../ui'
import { useMfTheme } from '../ui/useMfTheme'
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../../lib/techDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { toMeiUserErrorMessage } from '../../utils/meiUserFacingMessage'
import { filterMeiPeriodsForDisplay, isMeiPeriodVencida, type MeiPeriod } from '../../services/guidesMeiService'
import { formatCurrencyBR } from '../../lib/numberFormat'

const MONTH_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type DasStatusFilter = 'todos' | 'a_pagar' | 'pago'

type Props = {
  cnpj: string
  certDocumento: string | null
  downloadLoading: boolean
  validateLoading: boolean
  createGuideLoading: boolean
  normalizedCnpjLen: number
  hasCertificate: boolean
  meiPeriods: MeiPeriod[]
  meiPeriodsLoading?: boolean
  meiPeriodsError?: string | null
  isWide?: boolean
  onCnpjChange: (v: string) => void
  onValidate: () => void
  onCreateGuide: () => void
  onRefreshPeriods?: () => void
  onOpenPgmei: () => void
  portalButtonLabel?: string
  selectedMonth: string
  selectedYear: number
  onSelectPeriod: (period: MeiPeriod) => void
  onDownloadPeriod?: (period: MeiPeriod) => void
}

function statusLabel (status: MeiPeriod['status'], vencida = false): string {
  if (status === 'pago') return 'Pago'
  if (status === 'a_pagar' && vencida) return 'Vencida'
  if (status === 'a_pagar') return 'A pagar'
  if (status === 'erro') return 'Erro'
  if (status === 'indisponivel') return 'Indisponível'
  return 'Aberto'
}

function competenciaToPeriodoApuracao (comp: string): string | null {
  const text = String(comp || '').trim()
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return text.replace(/-/g, '')
  const digits = text.replace(/\D/g, '')
  if (digits.length !== 6) return null
  const month = digits.slice(4, 6)
  if (!/^(0[1-9]|1[0-2])$/.test(month)) return null
  return digits
}

function formatCompetenciaLabel (comp: string): string {
  const text = String(comp || '').trim()
  if (/^\d{2}\/\d{4}$/.test(text)) return text
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    const [y, m] = text.split('-')
    return `${m}/${y}`
  }
  const ap = competenciaToPeriodoApuracao(text)
  if (ap) return `${ap.slice(4, 6)}/${ap.slice(0, 4)}`
  return text
}

function competenciaSortKey (comp: string): number {
  const ap = competenciaToPeriodoApuracao(comp)
  return ap ? Number(ap) : 0
}

function periodMatchesSelection (
  comp: string,
  month: string,
  year: number,
): boolean {
  const ap = competenciaToPeriodoApuracao(comp)
  if (!ap) return false
  return ap === `${year}${month}`
}

export function MeiMobileDasPanel ({
  cnpj,
  certDocumento,
  downloadLoading,
  validateLoading,
  createGuideLoading,
  normalizedCnpjLen,
  hasCertificate,
  meiPeriods,
  meiPeriodsLoading = false,
  meiPeriodsError = null,
  isWide = false,
  onCnpjChange,
  onValidate,
  onCreateGuide,
  onRefreshPeriods,
  onOpenPgmei,
  portalButtonLabel = 'PGMEI',
  selectedMonth,
  selectedYear,
  onSelectPeriod,
  onDownloadPeriod,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens, isDarkMode), [theme, tokens, isDarkMode])
  const panel = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode])
  const rowSurface = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode])

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [statusFilter, setStatusFilter] = useState<DasStatusFilter>('todos')

  const needsCnpj = !certDocumento && normalizedCnpjLen !== 14
  const displayPeriods = useMemo(
    () => filterMeiPeriodsForDisplay(meiPeriods),
    [meiPeriods],
  )
  const aPagarCount = displayPeriods.filter((p) => p.status === 'a_pagar').length
  const pagoCount = displayPeriods.filter((p) => p.status === 'pago').length
  const periodsErrorText = meiPeriodsError ? toMeiUserErrorMessage(meiPeriodsError) : null
  const tudoEmDia = !meiPeriodsLoading && displayPeriods.length > 0 && aPagarCount === 0

  const filteredPeriods = useMemo(() => {
    const sorted = [...displayPeriods].sort(
      (a, b) => competenciaSortKey(b.competencia) - competenciaSortKey(a.competencia),
    )
    if (statusFilter === 'a_pagar') {
      return sorted.filter((p) => p.status === 'a_pagar')
    }
    if (statusFilter === 'pago') {
      return sorted.filter((p) => p.status === 'pago')
    }
    return sorted
  }, [displayPeriods, statusFilter])

  const setupHint = needsCnpj
    ? 'Informe o CNPJ abaixo para consultar as guias.'
    : !hasCertificate
      ? 'Envie o certificado na aba Certificado para baixar PDFs.'
      : null

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      {!certDocumento ? (
        <View style={styles.cnpjBlock}>
          <Text style={styles.cnpjLabel}>CNPJ do MEI</Text>
          <TextInput
            style={styles.input}
            placeholder="00.000.000/0000-00"
            placeholderTextColor={theme.placeholder}
            value={cnpj}
            onChangeText={onCnpjChange}
            keyboardType="numeric"
            maxLength={18}
          />
        </View>
      ) : null}

      {!meiPeriodsLoading && aPagarCount > 0 ? (
        <View style={styles.alertBanner}>
          <View style={styles.alertIconWrap}>
            <Ionicons name="calendar-outline" size={20} color={theme.warning} />
          </View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>
              {aPagarCount === 1 ? '1 guia para pagar' : `${aPagarCount} guias para pagar`}
            </Text>
            <Text style={styles.alertDesc}>
              Guias vencidas são regeneradas na Receita com o valor atualizado ao baixar.
              Toque em Baixar na linha do mês — o PDF será salvo no seu dispositivo.
            </Text>
          </View>
        </View>
      ) : null}

      {tudoEmDia ? (
        <View style={[styles.alertBanner, styles.alertBannerSuccess]}>
          <View style={[styles.alertIconWrap, styles.alertIconWrapSuccess]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.success} />
          </View>
          <View style={styles.alertCopy}>
            <Text style={[styles.alertTitle, { color: theme.success }]}>Tudo em dia</Text>
            <Text style={styles.alertDesc}>Nenhuma guia pendente no momento.</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.ledgerPanel, panel]}>
        <View style={styles.ledgerHeader}>
          <View style={styles.ledgerHeaderCopy}>
            <Text style={styles.ledgerTitle}>Situação por competência</Text>
            {!meiPeriodsLoading && displayPeriods.length > 0 ? (
              <Text style={styles.ledgerSummary}>
                {pagoCount} pago{pagoCount === 1 ? '' : 's'}
                {' · '}
                {aPagarCount} a pagar
              </Text>
            ) : null}
          </View>
          {onRefreshPeriods ? (
            <TouchableOpacity
              style={styles.ledgerRefresh}
              onPress={onRefreshPeriods}
              disabled={meiPeriodsLoading}
              accessibilityRole="button"
              accessibilityLabel="Atualizar situação das guias DAS"
            >
              {meiPeriodsLoading ? (
                <ActivityIndicator size="small" color={tokens.accent} />
              ) : (
                <Ionicons name="refresh" size={18} color={tokens.accent} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {displayPeriods.length > 0 ? (
          <View style={styles.filterRow}>
            {([
              ['todos', 'Todos'],
              ['a_pagar', 'A pagar'],
              ['pago', 'Pagos'],
            ] as const).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setStatusFilter(key)}
                style={[
                  styles.filterChip,
                  statusFilter === key && styles.filterChipActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: statusFilter === key }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === key && styles.filterChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {meiPeriodsLoading && meiPeriods.length === 0 ? (
          <View style={styles.ledgerLoading}>
            <ActivityIndicator size="small" color={tokens.accent} />
            <Text style={styles.ledgerLoadingText}>Consultando meses na Receita…</Text>
          </View>
        ) : filteredPeriods.length === 0 ? (
          <Text style={styles.ledgerEmpty}>
            {setupHint || 'Nenhuma competência neste filtro.'}
          </Text>
        ) : (
          <MfScrollView
            style={[
              styles.ledgerScroll,
              filteredPeriods.length > 6 && styles.ledgerScrollTall,
            ]}
            contentContainerStyle={styles.ledgerScrollContent}
            nestedScrollEnabled={filteredPeriods.length > 6}
            hideLegalFooter
          >
            {filteredPeriods.map((p) => {
              const selected = periodMatchesSelection(
                p.competencia,
                selectedMonth,
                selectedYear,
              )
              const vencida = isMeiPeriodVencida(p)
              // Pago também pode baixar (reimpressão / PDF já quitado na Receita).
              const canDownload =
                (p.status === 'a_pagar' || p.status === 'pago')
                && Boolean(onDownloadPeriod)
              const statusColor =
                p.status === 'pago'
                  ? theme.success
                  : p.status === 'erro'
                    ? theme.error
                    : p.status === 'indisponivel'
                      ? theme.textTertiary
                      : vencida
                        ? theme.error
                        : theme.warning

              return (
                <View
                  key={p.competencia}
                  style={[
                    styles.ledgerRow,
                    rowSurface,
                    selected && styles.ledgerRowSelected,
                  ]}
                >
                  <Pressable
                    onPress={() => onSelectPeriod(p)}
                    style={({ pressed }) => [
                      styles.ledgerRowMain,
                      pressed && styles.ledgerRowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${formatCompetenciaLabel(p.competencia)}, ${statusLabel(p.status, vencida)}${p.valorTotal != null ? `, ${formatCurrencyBR(p.valorTotal)}` : ''}`}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor },
                      ]}
                    />
                    <View style={styles.ledgerRowCopy}>
                      <Text style={[styles.ledgerMonth, selected && styles.ledgerMonthSelected]}>
                        {formatCompetenciaLabel(p.competencia)}
                      </Text>
                      <Text style={[styles.ledgerStatus, { color: statusColor }]}>
                        {statusLabel(p.status, vencida)}
                        {p.valorTotal != null && Number.isFinite(p.valorTotal)
                          ? ` · ${formatCurrencyBR(p.valorTotal)}`
                          : ''}
                        {vencida && p.vencimento ? ` · ${p.vencimento}` : ''}
                      </Text>
                    </View>
                  </Pressable>

                  {canDownload ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.ledgerDownloadPill,
                        pressed && styles.ledgerRowPressed,
                        downloadLoading && selected && styles.ledgerDownloadPillDisabled,
                      ]}
                      onPress={() => onDownloadPeriod?.(p)}
                      disabled={downloadLoading && selected}
                      accessibilityRole="button"
                      accessibilityLabel={
                        vencida && p.status === 'a_pagar'
                          ? `Atualizar valor e baixar PDF de ${formatCompetenciaLabel(p.competencia)}`
                          : `Baixar PDF de ${formatCompetenciaLabel(p.competencia)}`
                      }
                    >
                      {downloadLoading && selected ? (
                        <ActivityIndicator size="small" color={isDarkMode ? '#030508' : '#fff'} />
                      ) : (
                        <>
                          <Ionicons
                            name={vencida && p.status === 'a_pagar' ? 'refresh-outline' : 'download-outline'}
                            size={16}
                            color={isDarkMode ? '#030508' : '#fff'}
                          />
                          <Text style={styles.ledgerDownloadText}>
                            {vencida && p.status === 'a_pagar' ? 'Atualizar' : 'Baixar'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              )
            })}
          </MfScrollView>
        )}
      </View>

      {periodsErrorText && !meiPeriodsLoading ? (
        <Text style={styles.inlineNote}>{periodsErrorText}</Text>
      ) : null}

      {setupHint && displayPeriods.length === 0 && !meiPeriodsLoading ? (
        <Text style={styles.hint}>{setupHint}</Text>
      ) : null}

      <Pressable
        onPress={() => setShowAdvanced((v) => !v)}
        style={styles.advancedToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: showAdvanced }}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? 'Ocultar opções extras' : 'Precisa de outra coisa?'}
        </Text>
        <Ionicons
          name={showAdvanced ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.textTertiary}
        />
      </Pressable>

      {showAdvanced ? (
        <View style={[styles.advancedPanel, panel]}>
          <TouchableOpacity
            style={[styles.advancedBtn, (validateLoading || normalizedCnpjLen !== 14) && styles.advancedBtnDisabled]}
            onPress={onValidate}
            disabled={validateLoading || normalizedCnpjLen !== 14}
          >
            {validateLoading ? (
              <ActivityIndicator size="small" color={tokens.accent} />
            ) : (
              <Text style={styles.advancedBtnText}>Conferir na Receita Federal</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.advancedBtn,
              (createGuideLoading || normalizedCnpjLen !== 14 || !hasCertificate) && styles.advancedBtnDisabled,
            ]}
            onPress={onCreateGuide}
            disabled={createGuideLoading || normalizedCnpjLen !== 14 || !hasCertificate}
          >
            {createGuideLoading ? (
              <ActivityIndicator size="small" color={tokens.accent} />
            ) : (
              <Text style={styles.advancedBtnText}>Gerar guia nova</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.advancedBtn} onPress={onOpenPgmei}>
            <Text style={[styles.advancedBtnText, { color: tokens.accent }]}>
              {`Abrir site ${portalButtonLabel}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}

export function formatMeiPeriodLabel (month: string, year: number): string {
  const idx = Math.max(0, Math.min(11, parseInt(month, 10) - 1))
  return `${MONTH_PT[idx]} de ${year}`
}

export function shiftMeiPeriod (
  month: string,
  year: number,
  delta: number,
): { month: string; year: number } {
  let m = parseInt(month, 10) - 1
  let y = year
  m += delta
  while (m < 0) {
    m += 12
    y -= 1
  }
  while (m > 11) {
    m -= 12
    y += 1
  }
  return { month: String(m + 1).padStart(2, '0'), year: y }
}

function createStyles (
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    root: {
      paddingHorizontal: mfSpacing.md,
      paddingBottom: mfSpacing.lg,
      gap: mfSpacing.md,
    },
    rootWide: {
      alignSelf: 'stretch',
      width: '100%',
      paddingTop: 0,
      paddingHorizontal: 0,
      gap: mfSpacing.lg,
    },
    cnpjBlock: {
      gap: mfSpacing.xs,
    },
    cnpjLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: mfRadius.sm,
      padding: mfSpacing.md,
      fontSize: 17,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
    },
    alertBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: mfSpacing.md,
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(251, 191, 36, 0.28)' : 'rgba(245, 158, 11, 0.35)',
      backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.08)' : 'rgba(255, 251, 235, 0.95)',
    },
    alertBannerSuccess: {
      borderColor: isDarkMode ? 'rgba(52, 211, 153, 0.28)' : 'rgba(16, 185, 129, 0.3)',
      backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.08)' : 'rgba(236, 253, 245, 0.95)',
    },
    alertIconWrap: {
      width: 40,
      height: 40,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.12)' : 'rgba(254, 243, 199, 0.9)',
    },
    alertIconWrapSuccess: {
      backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.12)' : 'rgba(209, 250, 229, 0.9)',
    },
    alertCopy: {
      flex: 1,
      gap: 4,
    },
    alertTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    alertDesc: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.textSecondary,
    },
    hint: {
      fontSize: 13,
      color: theme.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
    },
    inlineNote: {
      fontSize: 13,
      color: theme.warning,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: mfSpacing.sm,
    },
    advancedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: mfSpacing.xs,
    },
    advancedToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textTertiary,
    },
    advancedPanel: {
      padding: mfSpacing.md,
      gap: mfSpacing.xs,
    },
    advancedBtn: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: mfSpacing.md,
    },
    advancedBtnDisabled: { opacity: 0.4 },
    advancedBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    ledgerPanel: {
      padding: mfSpacing.md,
      gap: mfSpacing.sm,
    },
    ledgerHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.sm,
    },
    ledgerHeaderCopy: {
      flex: 1,
      gap: 2,
    },
    ledgerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    ledgerSummary: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    ledgerRefresh: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.divider,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.xs,
    },
    filterChip: {
      paddingHorizontal: mfSpacing.sm,
      paddingVertical: 6,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
      borderColor: tokens.divider,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    },
    filterChipActive: {
      borderColor: tokens.accentMuted,
      backgroundColor: tokens.accentSoft,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    filterChipTextActive: {
      color: tokens.accent,
    },
    ledgerScroll: {},
    ledgerScrollTall: {
      maxHeight: 360,
    },
    ledgerScrollContent: {
      gap: mfSpacing.xs,
      paddingBottom: mfSpacing.xs,
    },
    ledgerLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingVertical: mfSpacing.md,
    },
    ledgerLoadingText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    ledgerEmpty: {
      fontSize: 13,
      color: theme.textTertiary,
      paddingVertical: mfSpacing.sm,
    },
    ledgerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingRight: mfSpacing.xs,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    ledgerRowSelected: {
      borderColor: tokens.accentMuted,
    },
    ledgerRowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.sm,
    },
    ledgerRowPressed: {
      opacity: 0.88,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    ledgerRowCopy: {
      flex: 1,
      gap: 2,
    },
    ledgerMonth: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    ledgerMonthSelected: {
      color: tokens.accent,
    },
    ledgerStatus: {
      fontSize: 12,
      fontWeight: '700',
    },
    ledgerDownloadPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: mfSpacing.sm,
      paddingVertical: 8,
      borderRadius: mfRadius.sm,
      backgroundColor: tokens.accent,
      minWidth: 88,
      justifyContent: 'center',
    },
    ledgerDownloadPillDisabled: {
      opacity: 0.6,
    },
    ledgerDownloadText: {
      fontSize: 13,
      fontWeight: '800',
      color: isDarkMode ? '#030508' : '#fff',
    },
  })
}
