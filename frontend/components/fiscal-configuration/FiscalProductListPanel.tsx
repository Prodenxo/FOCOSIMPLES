import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { FiscalStatusBadge } from '@/components/fiscal-configuration/FiscalStatusBadge'
import { FiscalConfigSelectField } from '@/components/fiscal-configuration/FiscalConfigSelectField'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'
import type { FiscalProductListRow } from '@/lib/fiscalConfiguration/types'
import type { FiscalProductGroup } from '@/lib/fiscalConfiguration/types'

type Props = {
  rows: FiscalProductListRow[]
  onConfigure: (productId: string) => void
  emptyMessage?: string
  selectionEnabled?: boolean
  selectedProductIds?: string[]
  onToggleSelect?: (productId: string) => void
  onToggleSelectAll?: () => void
  bulkGroupId?: string
  onBulkGroupChange?: (groupId: string) => void
  bulkGroupOptions?: readonly { value: string; label: string }[]
  onBulkAssign?: () => void
  bulkAssigning?: boolean
}

export function FiscalProductListPanel({
  rows,
  onConfigure,
  emptyMessage = 'Este cliente ainda não possui produtos cadastrados.',
  selectionEnabled = false,
  selectedProductIds = [],
  onToggleSelect,
  onToggleSelectAll,
  bulkGroupId = '',
  onBulkGroupChange,
  bulkGroupOptions = [],
  onBulkAssign,
  bulkAssigning = false,
}: Props) {
  const { theme } = useMfTheme()
  const { width } = useWindowDimensions()
  const isDesktop = width >= 900
  const allSelected = rows.length > 0 && selectedProductIds.length === rows.length
  const hasSelection = selectedProductIds.length > 0

  const styles = useMemo(
    () =>
      StyleSheet.create({
        empty: {
          padding: mfSpacing.xl,
          borderRadius: mfRadius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        emptyText: { ...mfTypography.body, color: theme.textSecondary, textAlign: 'center' },
        bulkBar: {
          flexDirection: isDesktop ? 'row' : 'column',
          alignItems: isDesktop ? 'center' : 'stretch',
          gap: mfSpacing.md,
          padding: mfSpacing.md,
          borderWidth: 1,
          borderColor: theme.primary,
          borderRadius: mfRadius.lg,
          backgroundColor: `${theme.primary}10`,
          marginBottom: mfSpacing.md,
        },
        bulkMeta: { ...mfTypography.body, color: theme.text, fontWeight: '600', flex: isDesktop ? 1 : undefined },
        bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: mfSpacing.sm, alignItems: 'center' },
        bulkGroupCol: { minWidth: isDesktop ? 220 : undefined, flex: isDesktop ? 1 : undefined },
        applyBtn: {
          backgroundColor: theme.primary,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm,
        },
        applyBtnDisabled: { opacity: 0.5 },
        applyText: { ...mfTypography.body, color: '#fff', fontWeight: '700' },
        table: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.lg,
          overflow: 'hidden',
          backgroundColor: theme.surface,
        },
        headRow: {
          flexDirection: 'row',
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm,
          backgroundColor: theme.backgroundMuted,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          alignItems: 'center',
        },
        headCell: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '700' },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          gap: mfSpacing.sm,
        },
        rowSelected: { backgroundColor: `${theme.primary}08` },
        cell: { ...mfTypography.body, color: theme.text },
        cellMuted: { ...mfTypography.caption, color: theme.textSecondary },
        checkBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
        actionBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: mfSpacing.sm,
          paddingVertical: 6,
          borderRadius: mfRadius.md,
          borderWidth: 1,
          borderColor: theme.border,
        },
        actionText: { ...mfTypography.caption, color: theme.primary, fontWeight: '600' },
        card: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.lg,
          padding: mfSpacing.lg,
          backgroundColor: theme.surface,
          gap: mfSpacing.sm,
        },
        cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: mfSpacing.sm, alignItems: 'flex-start' },
        cardTitle: { ...mfTypography.subtitle, color: theme.text, flex: 1 },
      }),
    [isDesktop, theme],
  )

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    )
  }

  const renderCheckbox = (productId: string, selected: boolean) => {
    if (!selectionEnabled || !onToggleSelect) return null
    return (
      <TouchableOpacity
        style={styles.checkBtn}
        onPress={() => onToggleSelect(productId)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
      >
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={20}
          color={selected ? theme.primary : theme.textSecondary}
        />
      </TouchableOpacity>
    )
  }

  const bulkBar = selectionEnabled && hasSelection ? (
    <View style={styles.bulkBar}>
      <Text style={styles.bulkMeta}>
        {selectedProductIds.length} produto{selectedProductIds.length === 1 ? '' : 's'} selecionado{selectedProductIds.length === 1 ? '' : 's'}
      </Text>
      <View style={styles.bulkActions}>
        <View style={styles.bulkGroupCol}>
          <FiscalConfigSelectField
            label="Atribuir grupo"
            value={bulkGroupId}
            options={bulkGroupOptions}
            onChange={(v) => onBulkGroupChange?.(v)}
          />
        </View>
        <TouchableOpacity
          style={[styles.applyBtn, (!bulkGroupId || bulkAssigning) && styles.applyBtnDisabled]}
          onPress={onBulkAssign}
          disabled={!bulkGroupId || bulkAssigning}
          accessibilityRole="button"
        >
          <Text style={styles.applyText}>{bulkAssigning ? 'Aplicando…' : 'Aplicar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null

  if (!isDesktop) {
    return (
      <View>
        {bulkBar}
        <View style={{ gap: mfSpacing.md }}>
          {rows.map((row) => {
            const selected = selectedProductIds.includes(row.productId)
            return (
              <View key={row.productId} style={[styles.card, selected && styles.rowSelected]}>
                <View style={styles.cardTop}>
                  {renderCheckbox(row.productId, selected)}
                  <Text style={styles.cardTitle}>{row.descricao}</Text>
                  <FiscalStatusBadge status={row.fiscalStatus} />
                </View>
                <Text style={styles.cellMuted}>Código: {row.codigo || '—'}</Text>
                <Text style={styles.cellMuted}>NCM: {row.ncm || '—'}</Text>
                <Text style={styles.cellMuted}>Grupo: {row.grupoFiscalNome ?? '—'}</Text>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onConfigure(row.productId)}
                  accessibilityRole="button"
                >
                  <Ionicons name="create-outline" size={16} color={theme.primary} />
                  <Text style={styles.actionText}>
                    {row.fiscalStatus === 'PENDENTE' ? 'Configurar agora' : 'Editar configuração'}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      </View>
    )
  }

  const col = {
    select: selectionEnabled ? { width: 36 } : { width: 0 },
    produto: { flex: 2.2 },
    codigo: { flex: 1 },
    ncm: { flex: 1 },
    grupo: { flex: 1.2 },
    status: { flex: 1 },
    action: { width: 130 },
  }

  return (
    <View>
      {bulkBar}
      <View style={styles.table}>
        <View style={styles.headRow}>
          {selectionEnabled ? (
            <TouchableOpacity
              style={[styles.checkBtn, col.select]}
              onPress={onToggleSelectAll}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected }}
            >
              <Ionicons
                name={allSelected ? 'checkbox' : 'square-outline'}
                size={20}
                color={allSelected ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.headCell, col.produto]}>Produto</Text>
          <Text style={[styles.headCell, col.codigo]}>Código</Text>
          <Text style={[styles.headCell, col.ncm]}>NCM</Text>
          <Text style={[styles.headCell, col.grupo]}>Grupo fiscal</Text>
          <Text style={[styles.headCell, col.status]}>Status</Text>
          <Text style={[styles.headCell, col.action]} />
        </View>
        <View style={{ maxHeight: Platform.OS === 'web' ? 560 : undefined }}>
          <MfScrollView>
            {rows.map((row) => {
              const selected = selectedProductIds.includes(row.productId)
              return (
                <View key={row.productId} style={[styles.row, selected && styles.rowSelected]}>
                  {renderCheckbox(row.productId, selected)}
                  <Text style={[styles.cell, col.produto]} numberOfLines={2}>{row.descricao}</Text>
                  <Text style={[styles.cellMuted, col.codigo]}>{row.codigo || '—'}</Text>
                  <Text style={[styles.cellMuted, col.ncm]}>{row.ncm || '—'}</Text>
                  <Text style={[styles.cellMuted, col.grupo]} numberOfLines={1}>
                    {row.grupoFiscalNome ?? '—'}
                  </Text>
                  <View style={col.status}>
                    <FiscalStatusBadge status={row.fiscalStatus} />
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, col.action]}
                    onPress={() => onConfigure(row.productId)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionText}>
                      {row.fiscalStatus === 'PENDENTE' ? 'Configurar' : 'Editar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </MfScrollView>
        </View>
      </View>
    </View>
  )
}

export function buildBulkGroupOptions(groups: FiscalProductGroup[]) {
  return groups
    .filter((g) => g.status === 'ACTIVE')
    .map((g) => ({ value: g.id, label: g.name }))
}
