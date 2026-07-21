import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
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
import {
  buildParcelaLedgerRows,
  filterParcelaLedgerRows,
  isParcelamentoEmAberto,
  parcelaLedgerStatusLabel,
  parcelaRowPermiteDownload,
  parcelamentoNumeroKey,
  type ParcelaLedgerRow,
  type ParcelaStatusFilter,
} from '../../lib/meiParcelamentosDisplay'
import type {
  ParcelamentoItem,
  ParcelamentoParcelaOption,
} from '../../services/guidesMeiService'

type Props = {
  normalizedCnpjLen: number
  hasCertificate: boolean
  parcelamentos: ParcelamentoItem[]
  parcelamentosLoading: boolean
  parcelasPorNumero: Record<string, ParcelamentoParcelaOption[]>
  parcelasLoading: boolean
  downloadRowKey: string | null
  bulkDownloadLoading: boolean
  isWide?: boolean
  onRefresh: () => void
  onDownloadRow: (row: ParcelaLedgerRow) => void
  onDownloadAll: () => void
}

export function MeiParcelamentosPanel ({
  normalizedCnpjLen,
  hasCertificate,
  parcelamentos,
  parcelamentosLoading,
  parcelasPorNumero,
  parcelasLoading,
  downloadRowKey,
  bulkDownloadLoading,
  isWide = false,
  onRefresh,
  onDownloadRow,
  onDownloadAll,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens, isDarkMode), [theme, tokens, isDarkMode])
  const panel = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode])
  const rowSurface = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode])

  const [statusFilter, setStatusFilter] = useState<ParcelaStatusFilter>('todos')

  const pedidosAtivos = useMemo(
    () => parcelamentos.filter((p) => isParcelamentoEmAberto(p.situacao)),
    [parcelamentos],
  )

  const pedidoAtivo = pedidosAtivos.length === 1 ? pedidosAtivos[0] : null

  const ledgerRows = useMemo(
    () => buildParcelaLedgerRows(parcelamentos, parcelasPorNumero),
    [parcelamentos, parcelasPorNumero],
  )

  const filteredRows = useMemo(
    () => filterParcelaLedgerRows(ledgerRows, statusFilter),
    [ledgerRows, statusFilter],
  )

  const aPagarCount = ledgerRows.filter(
    (row) => row.status === 'a_pagar' || row.status === 'liberada',
  ).length
  const pagoCount = ledgerRows.filter((row) => row.status === 'pago').length
  const baixaveisCount = ledgerRows.filter((row) => parcelaRowPermiteDownload(row)).length
  const tudoEmDia = !parcelamentosLoading && !parcelasLoading && ledgerRows.length > 0 && aPagarCount === 0
  const loading = parcelamentosLoading || parcelasLoading
  const needsSetup = normalizedCnpjLen !== 14 || !hasCertificate

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      {!loading && aPagarCount > 0 ? (
        <View style={styles.alertBanner}>
          <View style={styles.alertIconWrap}>
            <Ionicons name="layers-outline" size={20} color={theme.warning} />
          </View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>
              {aPagarCount === 1 ? '1 parcela em aberto' : `${aPagarCount} parcelas em aberto`}
            </Text>
            <Text style={styles.alertDesc}>
              Toque em Baixar na linha do mês — o PDF do DAS parcelado será salvo no seu dispositivo.
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
            <Text style={[styles.alertTitle, { color: theme.success }]}>Parcelas em dia</Text>
            <Text style={styles.alertDesc}>Nenhuma parcela pendente no momento.</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.ledgerPanel, panel]}>
        <View style={styles.ledgerHeader}>
          <View style={styles.ledgerHeaderCopy}>
            <Text style={styles.ledgerTitle}>Parcelas do parcelamento</Text>
            {!loading && ledgerRows.length > 0 ? (
              <Text style={styles.ledgerSummary}>
                {pagoCount} pago{pagoCount === 1 ? '' : 's'}
                {' · '}
                {aPagarCount} em aberto
              </Text>
            ) : pedidoAtivo ? (
              <Text style={styles.ledgerSummary}>
                Pedido nº {pedidoAtivo.numero}
                {pedidoAtivo.modalidade ? ` · ${pedidoAtivo.modalidade}` : ''}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.ledgerRefresh}
            onPress={onRefresh}
            disabled={loading || bulkDownloadLoading}
            accessibilityRole="button"
            accessibilityLabel="Atualizar parcelamentos"
          >
            {loading ? (
              <ActivityIndicator size="small" color={tokens.accent} />
            ) : (
              <Ionicons name="refresh" size={18} color={tokens.accent} />
            )}
          </TouchableOpacity>
        </View>

        {ledgerRows.length > 0 ? (
          <>
            <View style={styles.filterRow}>
              {([
                ['todos', 'Todos'],
                ['a_pagar', 'Em aberto'],
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

            {baixaveisCount > 1 ? (
              <TouchableOpacity
                style={[
                  styles.bulkBtn,
                  (bulkDownloadLoading || baixaveisCount === 0) && styles.bulkBtnDisabled,
                ]}
                onPress={onDownloadAll}
                disabled={bulkDownloadLoading || baixaveisCount === 0}
                accessibilityRole="button"
                accessibilityLabel="Baixar todas as parcelas em aberto"
              >
                {bulkDownloadLoading ? (
                  <ActivityIndicator size="small" color={isDarkMode ? '#030508' : '#fff'} />
                ) : (
                  <>
                    <Ionicons
                      name="download-outline"
                      size={16}
                      color={isDarkMode ? '#030508' : '#fff'}
                    />
                    <Text style={styles.bulkBtnText}>
                      Baixar todas ({baixaveisCount})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        {loading && ledgerRows.length === 0 ? (
          <View style={styles.ledgerLoading}>
            <ActivityIndicator size="small" color={tokens.accent} />
            <Text style={styles.ledgerLoadingText}>Consultando parcelas na Receita…</Text>
          </View>
        ) : needsSetup ? (
          <Text style={styles.ledgerEmpty}>
            {normalizedCnpjLen !== 14
              ? 'Informe o CNPJ na aba Certificado.'
              : 'Configure o certificado na aba Certificado.'}
          </Text>
        ) : pedidosAtivos.length === 0 && !parcelamentosLoading ? (
          <Text style={styles.ledgerEmpty}>
            Nenhum parcelamento ativo. Pedidos encerrados não aparecem aqui.
          </Text>
        ) : filteredRows.length === 0 ? (
          <Text style={styles.ledgerEmpty}>
            {pedidoAtivo
              ? 'Pedido encontrado, mas nenhuma parcela veio da Receita ainda. Toque em atualizar.'
              : 'Nenhuma parcela neste filtro.'}
          </Text>
        ) : (
          <MfScrollView
            style={[
              styles.ledgerScroll,
              filteredRows.length > 6 && styles.ledgerScrollTall,
            ]}
            contentContainerStyle={styles.ledgerScrollContent}
            nestedScrollEnabled={filteredRows.length > 6}
            hideLegalFooter
          >
            {filteredRows.map((row) => {
              const canDownload = parcelaRowPermiteDownload(row)
              const downloading = downloadRowKey === row.id
              const statusColor =
                row.status === 'pago'
                  ? theme.success
                  : row.status === 'liberada'
                    ? tokens.accent
                    : theme.warning
              const showPedido = pedidosAtivos.length > 1

              return (
                <View key={row.id} style={[styles.ledgerRow, rowSurface]}>
                  <View style={styles.ledgerRowMain}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <View style={styles.ledgerRowCopy}>
                      <Text style={styles.ledgerMonth}>{row.label}</Text>
                      <Text style={[styles.ledgerStatus, { color: statusColor }]}>
                        {parcelaLedgerStatusLabel(row.status)}
                      </Text>
                      {showPedido ? (
                        <Text style={styles.ledgerPedido}>Pedido nº {row.pedidoNumero}</Text>
                      ) : null}
                    </View>
                  </View>

                  {canDownload ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.ledgerDownloadPill,
                        pressed && styles.ledgerRowPressed,
                        downloading && styles.ledgerDownloadPillDisabled,
                      ]}
                      onPress={() => onDownloadRow(row)}
                      disabled={downloading || bulkDownloadLoading}
                      accessibilityRole="button"
                      accessibilityLabel={`Baixar DAS de ${row.label}`}
                    >
                      {downloading ? (
                        <ActivityIndicator size="small" color={isDarkMode ? '#030508' : '#fff'} />
                      ) : (
                        <>
                          <Ionicons
                            name="download-outline"
                            size={16}
                            color={isDarkMode ? '#030508' : '#fff'}
                          />
                          <Text style={styles.ledgerDownloadText}>Baixar</Text>
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
    </View>
  )
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
    alertCopy: { flex: 1, gap: 4 },
    alertTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    alertDesc: { fontSize: 13, lineHeight: 18, color: theme.textSecondary },
    ledgerPanel: { padding: mfSpacing.md, gap: mfSpacing.sm },
    ledgerHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.sm,
    },
    ledgerHeaderCopy: { flex: 1, gap: 2 },
    ledgerTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    ledgerSummary: { fontSize: 13, color: theme.textSecondary },
    ledgerRefresh: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.divider,
    },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: mfSpacing.xs },
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
    filterChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
    filterChipTextActive: { color: tokens.accent },
    bulkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: mfRadius.sm,
      backgroundColor: tokens.accent,
    },
    bulkBtnDisabled: { opacity: 0.5 },
    bulkBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: isDarkMode ? '#030508' : '#fff',
    },
    ledgerScroll: {},
    ledgerScrollTall: { maxHeight: 360 },
    ledgerScrollContent: { gap: mfSpacing.xs, paddingBottom: mfSpacing.xs },
    ledgerLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingVertical: mfSpacing.md,
    },
    ledgerLoadingText: { fontSize: 13, color: theme.textSecondary },
    ledgerEmpty: {
      fontSize: 13,
      color: theme.textTertiary,
      paddingVertical: mfSpacing.sm,
      lineHeight: 18,
    },
    ledgerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingRight: mfSpacing.xs,
      borderRadius: mfRadius.sm,
      overflow: 'hidden',
    },
    ledgerRowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.sm,
    },
    ledgerRowPressed: { opacity: 0.88 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    ledgerRowCopy: { flex: 1, gap: 2 },
    ledgerMonth: { fontSize: 15, fontWeight: '600', color: theme.text },
    ledgerStatus: { fontSize: 12, fontWeight: '700' },
    ledgerPedido: { fontSize: 11, color: theme.textTertiary },
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
    ledgerDownloadPillDisabled: { opacity: 0.6 },
    ledgerDownloadText: {
      fontSize: 13,
      fontWeight: '800',
      color: isDarkMode ? '#030508' : '#fff',
    },
  })
}
