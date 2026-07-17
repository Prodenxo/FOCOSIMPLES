import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { buildProdutoCatalogLabel } from '../lib/meiFormatters'
import {
  buildProdutoCatalogPayload,
  CNAE_HINT,
  CNAE_LABEL,
  CODIGO_CNAE_INTRO,
  CODIGO_SERVICO_HINT,
  CODIGO_SERVICO_LABEL,
  normalizeCnaeInput,
} from '../lib/meiCatalogoProdutoForm'
import {
  emptyNfeCatalogProdutoFormFields,
  isNfeLikeCatalogDocumentType,
  nfeCatalogProdutoFormFieldsFromMetadata,
  type NfeCatalogProdutoFormFields,
} from '../lib/nfeCatalogProdutoMetadata'
import { parseDecimalInput } from '../lib/meiNfseForms'
import type { DocumentType, NfseCatalogProduto } from '../services/meiNotasService'
import {
  atualizarCatalogoNfseProduto,
  criarCatalogoNfseProduto,
  excluirCatalogoNfseProduto,
  listarCatalogoNfseProdutos,
} from '../services/meiNotasService'
import {
  MeiFlowModalShell,
  MeiFormField,
  MeiFormSheet,
  MeiCatalogListCard,
  MeiSearchBar,
  MeiConfirmDialog,
  MeiFormSheetActions,
  MeiFormBanner,
  MeiFormSectionLabel,
  MeiTypeChips,
  MeiCatalogDocTypeFilterChips,
  useMeiFlowStyles,
  type MeiDocType,
  type MeiCatalogDocFilter,
} from '../components/mei/meiFlowUi'
import { useMfTheme } from '../components/ui/useMfTheme'
import { alertDialog } from '../lib/confirmDialog'
import { useAppToastStore } from '../store/appToastStore'

const PAGE_SIZE = 50

export type MeiCatalogoProdutosModalProps = {
  visible: boolean
  onClose: () => void
  onCatalogChanged?: () => void
  /** Tipos liberados pelo admin; omitido = todos. */
  allowedDocumentTypes?: MeiDocType[]
}

type FormState = {
  codigo: string
  cnae: string
  discriminacao: string
  aliquota: string
  valorSugerido: string
  documentType: DocumentType
  nfe: NfeCatalogProdutoFormFields
}

const emptyForm = (): FormState => ({
  codigo: '',
  cnae: '',
  discriminacao: '',
  aliquota: '',
  valorSugerido: '',
  documentType: 'NFSE',
  nfe: emptyNfeCatalogProdutoFormFields(),
})

const catalogDocTypeLabel = (documentType?: string | null): string | undefined => {
  if (documentType === 'NFSE') return 'NFS-e'
  if (documentType === 'NFE') return 'NF-e'
  if (documentType === 'NFCE') return 'NFC-e'
  return documentType?.trim() || undefined
}

export default function MeiCatalogoProdutosModal ({
  visible,
  onClose,
  onCatalogChanged,
  allowedDocumentTypes,
}: MeiCatalogoProdutosModalProps) {
  const { theme } = useMfTheme()
  const flow = useMeiFlowStyles()
  const showToast = useAppToastStore((s) => s.show)

  const [items, setItems] = useState<NfseCatalogProduto[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<MeiCatalogDocFilter>('ALL')
  const nextOffsetRef = useRef(0)
  const searchQRef = useRef(searchQ)
  const typeFilterRef = useRef(typeFilter)
  const hasMoreRef = useRef(hasMore)
  const loadingMoreRef = useRef(loadingMore)
  const refreshingRef = useRef(refreshing)
  const fetchGenRef = useRef(0)

  searchQRef.current = searchQ
  typeFilterRef.current = typeFilter
  hasMoreRef.current = hasMore
  loadingMoreRef.current = loadingMore
  refreshingRef.current = refreshing

  const [formVisible, setFormVisible] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<NfseCatalogProduto | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const allowedDocTypes = useMemo(
    () => (allowedDocumentTypes?.length ? allowedDocumentTypes : (['NFSE', 'NFE', 'NFCE'] as MeiDocType[])),
    [allowedDocumentTypes],
  )

  const resetList = useCallback(() => {
    setItems([])
    nextOffsetRef.current = 0
    setHasMore(true)
  }, [])

  const fetchPage = useCallback(
    async (opts: { append: boolean; q?: string; reset?: boolean }) => {
      const q = opts.q !== undefined ? opts.q : searchQRef.current
      const startOffset = opts.reset ? 0 : opts.append ? nextOffsetRef.current : 0
      if (opts.append && (!hasMoreRef.current || loadingMoreRef.current)) return

      const gen = ++fetchGenRef.current
      if (opts.append) setLoadingMore(true)
      else if (!opts.append && !refreshingRef.current) setLoading(true)

      try {
        const docType = typeFilterRef.current
        const page = await listarCatalogoNfseProdutos({
          q: q.trim() || undefined,
          limit: PAGE_SIZE,
          offset: startOffset > 0 ? startOffset : undefined,
          ...(docType !== 'ALL' ? { documentType: docType } : {}),
        })
        if (gen !== fetchGenRef.current) return

        const list = Array.isArray(page) ? page : []
        if (opts.append) {
          setItems((prev) => [...prev, ...list])
        } else {
          setItems(list)
        }
        setHasMore(list.length >= PAGE_SIZE)
        nextOffsetRef.current = startOffset + list.length
      } catch (e: unknown) {
        if (gen !== fetchGenRef.current) return
        const msg = e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.'
        if (!opts.append) {
          alertDialog('Erro', msg)
          setItems([])
        }
      } finally {
        if (gen !== fetchGenRef.current) return
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!visible) return
    resetList()
    void fetchPage({ append: false, reset: true })
  }, [visible, typeFilter, resetList, fetchPage])

  useEffect(() => {
    if (typeFilter !== 'ALL' && !allowedDocTypes.includes(typeFilter)) {
      setTypeFilter('ALL')
    }
  }, [allowedDocTypes, typeFilter])

  const onTypeFilterChange = (next: MeiCatalogDocFilter) => {
    setTypeFilter(next)
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    resetList()
    void fetchPage({ append: false, reset: true, q: searchQ })
  }, [fetchPage, resetList, searchQ])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return
    void fetchPage({ append: true })
  }, [fetchPage, hasMore, loading, loadingMore])

  const notifyChanged = useCallback(() => {
    onCatalogChanged?.()
  }, [onCatalogChanged])

  const openCreate = () => {
    setEditingId(null)
    const initial = emptyForm()
    if (typeFilter !== 'ALL' && allowedDocTypes.includes(typeFilter)) {
      initial.documentType = typeFilter
    } else {
      initial.documentType = allowedDocTypes[0] ?? 'NFSE'
    }
    setForm(initial)
    setFormVisible(true)
  }

  const openEdit = (item: NfseCatalogProduto) => {
    setEditingId(item.id)
    setForm({
      codigo: item.codigo ?? '',
      cnae: item.cnae ?? '',
      discriminacao: item.discriminacao ?? '',
      aliquota: item.aliquota != null ? String(item.aliquota).replace('.', ',') : '',
      valorSugerido: item.valor_sugerido != null ? String(item.valor_sugerido).replace('.', ',') : '',
      documentType: (item.document_type as DocumentType) || 'NFSE',
      nfe: nfeCatalogProdutoFormFieldsFromMetadata(item.metadata_json),
    })
    setFormVisible(true)
  }

  const handleSaveForm = async () => {
    let basePayload
    try {
      const editingItem = editingId ? items.find((it) => it.id === editingId) : null
      basePayload = buildProdutoCatalogPayload(
        {
          codigo: form.codigo,
          cnae: form.cnae,
          discriminacao: form.discriminacao,
          aliquotaStr: form.aliquota,
          valorSugeridoStr: form.valorSugerido,
          documentType: form.documentType,
          nfe: form.nfe,
        },
        parseDecimalInput,
        editingItem?.metadata_json as Record<string, unknown> | null | undefined,
      )
    } catch (e: unknown) {
      alertDialog('Validação', e instanceof Error ? e.message : 'Dados inválidos.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await atualizarCatalogoNfseProduto(editingId, basePayload)
        showToast(
          isNfeLikeCatalogDocumentType(form.documentType) ? 'Produto atualizado.' : 'Serviço atualizado.',
          'success',
        )
      } else {
        await criarCatalogoNfseProduto({
          ...basePayload,
          documentType: form.documentType,
        })
        showToast(
          isNfeLikeCatalogDocumentType(form.documentType) ? 'Produto criado.' : 'Serviço criado.',
          'success',
        )
      }
      setFormVisible(false)
      resetList()
      await fetchPage({ append: false, reset: true, q: searchQ })
      notifyChanged()
    } catch (e: unknown) {
      alertDialog('Erro', e instanceof Error ? e.message : 'Falha ao salvar serviço.')
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (item: NfseCatalogProduto) => {
    setDeleteTarget(item)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await excluirCatalogoNfseProduto(deleteTarget.id)
      showToast('Serviço removido.', 'success')
      setDeleteTarget(null)
      resetList()
      await fetchPage({ append: false, reset: true, q: searchQ })
      notifyChanged()
    } catch (e: unknown) {
      alertDialog('Erro', e instanceof Error ? e.message : 'Falha ao excluir.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const runSearch = () => {
    resetList()
    void fetchPage({ append: false, reset: true, q: searchQ })
  }

  const emptyListMessage =
    typeFilter === 'ALL'
      ? 'Nenhum item. Toque em + para adicionar.'
      : `Nenhum item de ${typeFilter === 'NFSE' ? 'NFS-e' : typeFilter === 'NFE' ? 'NF-e' : 'NFC-e'}. Toque em + para adicionar.`

  const headerRight = useMemo(
    () => (
      <Pressable
        onPress={openCreate}
        style={flow.headerAdd}
        accessibilityRole="button"
        accessibilityLabel="Novo serviço"
      >
        <Ionicons name="add" size={22} color={theme.primary} />
      </Pressable>
    ),
    [flow.headerAdd, theme.primary, openCreate],
  )

  return (
    <>
      <MeiFlowModalShell
        visible={visible}
        onClose={onClose}
        title="Catálogo de serviços e produtos"
        eyebrow=""
        closeIcon="close"
        headerRight={headerRight}
        flatListBody
      >
        <MeiSearchBar
          value={searchQ}
          onChangeText={setSearchQ}
          onSearch={runSearch}
          placeholder="Buscar por código, CNAE ou descrição"
        />

        <MeiCatalogDocTypeFilterChips
          value={typeFilter}
          onChange={onTypeFilterChange}
          allowedTypes={allowedDocTypes}
        />

        {loading && items.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            style={flow.listPad}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Text style={flow.empty}>{emptyListMessage}</Text>
            }
            renderItem={({ item }) => {
              const needsCodigo = Boolean(
                item.metadata_json
                && typeof item.metadata_json === 'object'
                && (item.metadata_json as { needsServicoCodigo?: boolean }).needsServicoCodigo,
              )
              const missingCodigo = !String(item.codigo || '').trim()
              const tipo = catalogDocTypeLabel(item.document_type)
              const metaBits = [
                tipo,
                item.cnae ? `CNAE ${item.cnae}` : null,
                needsCodigo || missingCodigo ? 'Completar código LC 116' : null,
              ].filter(Boolean)
              return (
                <MeiCatalogListCard
                  title={buildProdutoCatalogLabel(item)}
                  meta={metaBits.join(' · ') || undefined}
                  onEdit={() => openEdit(item)}
                  onDelete={() => requestDelete(item)}
                />
              )
            }}
          />
        )}

        <Text style={flow.hint}>
          Lista até {PAGE_SIZE} itens por página; deslize para carregar mais.
        </Text>
      </MeiFlowModalShell>

      <MeiFormSheet
        visible={formVisible}
        title={editingId ? (isNfeLikeCatalogDocumentType(form.documentType) ? 'Editar produto' : 'Editar serviço') : 'Novo item'}
        onClose={() => setFormVisible(false)}
        footer={
          <MeiFormSheetActions
            onCancel={() => setFormVisible(false)}
            onConfirm={handleSaveForm}
            loading={saving}
          />
        }
      >
        <MeiFormSectionLabel>Tipo de documento fiscal</MeiFormSectionLabel>
        <MeiTypeChips
          value={form.documentType as MeiDocType}
          allowedTypes={allowedDocTypes}
          onChange={(dt) => {
            if (editingId) return
            setForm((f) => ({
              ...f,
              documentType: dt,
              ...(isNfeLikeCatalogDocumentType(dt) ? {} : { nfe: emptyNfeCatalogProdutoFormFields() }),
            }))
          }}
        />
        {editingId ? (
          <Text style={flow.hint}>O tipo de documento não pode ser alterado após criar o item.</Text>
        ) : null}
        {isNfeLikeCatalogDocumentType(form.documentType) ? (
          <>
            <MeiFormBanner>
              Cadastre aqui NCM, CFOP e tributos do produto. Na emissão de NF-e, basta escolher este item no catálogo.
            </MeiFormBanner>
            <MeiFormSectionLabel>Dados do produto (NF-e / NFC-e)</MeiFormSectionLabel>
            <MeiFormField
              label="Código / SKU"
              required
              placeholder="Ex.: AGUA20L"
              value={form.codigo}
              onChangeText={(t) => setForm((f) => ({ ...f, codigo: t }))}
            />
            <MeiFormField
              label="Descrição"
              required
              placeholder="Descrição do produto"
              value={form.discriminacao}
              onChangeText={(t) => setForm((f) => ({ ...f, discriminacao: t }))}
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <MeiFormField
              label="NCM (8 dígitos)"
              required
              placeholder="22011000"
              value={form.nfe.ncm}
              onChangeText={(t) =>
                setForm((f) => ({ ...f, nfe: { ...f.nfe, ncm: t.replace(/\D/g, '').slice(0, 8) } }))
              }
              keyboardType="numeric"
              maxLength={8}
            />
            <MeiFormField
              label="CFOP"
              required
              placeholder="5102"
              value={form.nfe.cfop}
              onChangeText={(t) =>
                setForm((f) => ({ ...f, nfe: { ...f.nfe, cfop: t.replace(/\D/g, '').slice(0, 4) } }))
              }
              keyboardType="numeric"
              maxLength={4}
            />
            <MeiFormField
              label="Unidade"
              required
              placeholder="UN"
              value={form.nfe.unidade}
              onChangeText={(t) => setForm((f) => ({ ...f, nfe: { ...f.nfe, unidade: t } }))}
            />
            <MeiFormField
              label="CSOSN ICMS (MEI)"
              required
              placeholder="102"
              value={form.nfe.icmsCsosn}
              onChangeText={(t) =>
                setForm((f) => ({
                  ...f,
                  nfe: { ...f.nfe, icmsCsosn: t.replace(/\D/g, '').slice(0, 3) },
                }))
              }
              keyboardType="numeric"
              maxLength={3}
            />
            <MeiFormField
              label="CST PIS"
              required
              placeholder="49"
              value={form.nfe.pisCst}
              onChangeText={(t) =>
                setForm((f) => ({ ...f, nfe: { ...f.nfe, pisCst: t.replace(/\D/g, '').slice(0, 2) } }))
              }
              keyboardType="numeric"
              maxLength={2}
            />
            <MeiFormField
              label="CST COFINS"
              required
              placeholder="49"
              value={form.nfe.cofinsCst}
              onChangeText={(t) =>
                setForm((f) => ({ ...f, nfe: { ...f.nfe, cofinsCst: t.replace(/\D/g, '').slice(0, 2) } }))
              }
              keyboardType="numeric"
              maxLength={2}
            />
            <MeiFormField
              label="Valor sugerido"
              placeholder="Opcional — ex.: 100,00"
              value={form.valorSugerido}
              onChangeText={(t) => setForm((f) => ({ ...f, valorSugerido: t }))}
              keyboardType="decimal-pad"
            />
          </>
        ) : (
          <>
        <MeiFormBanner>{CODIGO_CNAE_INTRO}</MeiFormBanner>
        <MeiFormSectionLabel>Dados fiscais da NFS-e</MeiFormSectionLabel>
        <MeiFormField
          label={CODIGO_SERVICO_LABEL}
          required
          hint={CODIGO_SERVICO_HINT}
          placeholder="Ex.: 14.01.01 ou 140101"
          value={form.codigo}
          onChangeText={(t) => setForm((f) => ({ ...f, codigo: t }))}
        />
        <MeiFormField
          label={CNAE_LABEL}
          required
          hint={CNAE_HINT}
          placeholder="Ex.: 4211102 ou 4211-1/02"
          value={form.cnae}
          onChangeText={(t) => setForm((f) => ({ ...f, cnae: t }))}
          onBlur={() => {
            const n = normalizeCnaeInput(form.cnae)
            if (n.length === 7) {
              setForm((f) => ({ ...f, cnae: n }))
            }
          }}
        />
        <MeiFormField
          label="Discriminação"
          required
          placeholder="Descrição do serviço"
          value={form.discriminacao}
          onChangeText={(t) => setForm((f) => ({ ...f, discriminacao: t }))}
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <MeiFormField
          label="Alíquota (%) — opcional"
          placeholder="MEI/Simples: deixe em branco"
          value={form.aliquota}
          onChangeText={(t) => setForm((f) => ({ ...f, aliquota: t }))}
          keyboardType="decimal-pad"
        />
        <MeiFormField
          label="Valor sugerido"
          placeholder="Opcional — ex.: 100,00"
          value={form.valorSugerido}
          onChangeText={(t) => setForm((f) => ({ ...f, valorSugerido: t }))}
          keyboardType="decimal-pad"
        />
          </>
        )}
      </MeiFormSheet>

      <MeiConfirmDialog
        visible={deleteTarget != null}
        title="Excluir serviço"
        message="Remover este serviço do catálogo?"
        detail={deleteTarget ? buildProdutoCatalogLabel(deleteTarget) : undefined}
        confirmLabel="Excluir"
        loading={deleteLoading}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleteLoading) setDeleteTarget(null)
        }}
      />
    </>
  )
}
