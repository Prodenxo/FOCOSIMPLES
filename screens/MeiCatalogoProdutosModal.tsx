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
  catalogProdutoNeedsNfeCompletion,
  emptyNfeCatalogProdutoFormFields,
  isNfeLikeCatalogDocumentType,
  nfeCatalogProdutoFormFieldsFromMetadata,
  type NfeCatalogProdutoFormFields,
} from '../lib/nfeCatalogProdutoMetadata'
import { parseDecimalInput } from '../lib/meiNfseForms'
import { resolveAppOrigin } from '../lib/appOrigin'
import type { DocumentType, NfseCatalogProduto } from '../services/meiNotasService'
import {
  atualizarCatalogoNfseProduto,
  criarCatalogoNfseProduto,
  criarCatalogoProdutosFromSpreadsheet,
  excluirCatalogoNfseProduto,
  listarCatalogoNfseProdutos,
} from '../services/meiNotasService'
import type { CatalogoProdutoSpreadsheetRow } from '../lib/catalogoProdutosSpreadsheet'
import {
  defaultSpreadsheetDocumentType,
  downloadCatalogoProdutosTemplate,
  pickAndParseCatalogoProdutosSpreadsheet,
} from '../lib/catalogoProdutosSpreadsheet'
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
import { NcmAutocompleteField } from '../components/mei/NcmAutocompleteField'
import { useMfTheme } from '../components/ui/useMfTheme'
import { alertDialog } from '../lib/confirmDialog'
import { formatApiNetworkError } from '../lib/apiNetworkError'
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
  const { theme, isDarkMode } = useMfTheme()
  const flow = useMeiFlowStyles()
  const showToast = useAppToastStore((s) => s.show)
  const isFocoSimples = resolveAppOrigin() === 'focosimples'

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
  const [addChoiceVisible, setAddChoiceVisible] = useState(false)
  const [importVisible, setImportVisible] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importRowCount, setImportRowCount] = useState(0)
  const [importRows, setImportRows] = useState<CatalogoProdutoSpreadsheetRow[]>([])

  const allowedDocTypes = useMemo(
    () => (allowedDocumentTypes?.length ? allowedDocumentTypes : (['NFSE', 'NFE', 'NFCE'] as MeiDocType[])),
    [allowedDocumentTypes],
  )

  const canImportSpreadsheet = useMemo(
    () => allowedDocTypes.some((t) => t === 'NFE' || t === 'NFCE'),
    [allowedDocTypes],
  )

  const choiceBorder = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'

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
    setAddChoiceVisible(false)
    setEditingId(null)
    const initial = emptyForm()
    if (typeFilter !== 'ALL' && allowedDocTypes.includes(typeFilter)) {
      initial.documentType = typeFilter
    } else if (isFocoSimples && allowedDocTypes.includes('NFE')) {
      initial.documentType = 'NFE'
    } else {
      initial.documentType = allowedDocTypes[0] ?? 'NFSE'
    }
    setForm(initial)
    setFormVisible(true)
  }

  const openAddChoice = () => {
    if (isFocoSimples && canImportSpreadsheet) {
      setAddChoiceVisible(true)
      return
    }
    openCreate()
  }

  const openImportSheet = () => {
    setAddChoiceVisible(false)
    setImportFileName(null)
    setImportRowCount(0)
    setImportRows([])
    setImportVisible(true)
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
      const raw = e instanceof Error ? e.message : 'Falha ao salvar serviço.'
      alertDialog('Erro', formatApiNetworkError(raw))
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

  const handlePickSpreadsheet = async () => {
    setImportBusy(true)
    try {
      const picked = await pickAndParseCatalogoProdutosSpreadsheet()
      if (!picked) return
      setImportFileName(picked.fileName)
      setImportRows(picked.rows)
      setImportRowCount(picked.rows.length)
      if (picked.rows.length === 0) {
        alertDialog('Planilha', 'Nenhuma linha de produto encontrada. Baixe o modelo e preencha.')
      }
    } catch (e: unknown) {
      alertDialog('Erro', e instanceof Error ? e.message : 'Falha ao ler a planilha.')
    } finally {
      setImportBusy(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setImportBusy(true)
    try {
      await downloadCatalogoProdutosTemplate()
      showToast('Modelo de planilha pronto.', 'success')
    } catch (e: unknown) {
      alertDialog('Erro', e instanceof Error ? e.message : 'Falha ao gerar o modelo.')
    } finally {
      setImportBusy(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!importRows.length) {
      alertDialog('Planilha', 'Selecione uma planilha com produtos.')
      return
    }
    setImportBusy(true)
    try {
      const documentType = defaultSpreadsheetDocumentType(allowedDocTypes as DocumentType[])
      const result = await criarCatalogoProdutosFromSpreadsheet({
        documentType,
        rows: importRows.map((r) => ({
          line: r.line,
          codigo: r.codigo,
          descricao: r.descricao,
          ncm: r.ncm,
          unidade: r.unidade,
          preco: r.preco,
        })),
      })
      const n = result.created?.length ?? 0
      const errN = result.errors?.length ?? 0
      if (n > 0) {
        showToast(
          errN > 0
            ? `${n} produto(s) importado(s); ${errN} linha(s) com erro.`
            : (n === 1 ? '1 produto importado.' : `${n} produtos importados.`),
          errN > 0 ? 'info' : 'success',
        )
      } else {
        alertDialog(
          'Nada importado',
          errN > 0
            ? `Todas as ${errN} linhas falharam. Verifique descrição e NCM (8 dígitos).`
            : 'Nenhuma linha válida.',
        )
      }
      setImportVisible(false)
      resetList()
      await fetchPage({ append: false, reset: true, q: searchQ })
      notifyChanged()
    } catch (e: unknown) {
      alertDialog('Erro', e instanceof Error ? e.message : 'Falha ao importar planilha.')
    } finally {
      setImportBusy(false)
    }
  }

  const emptyListMessage = isFocoSimples && canImportSpreadsheet
    ? 'Nenhum item. Toque em + para criar produto ou importar planilha.'
    : typeFilter === 'ALL'
      ? 'Nenhum item. Toque em + para adicionar.'
      : `Nenhum item de ${typeFilter === 'NFSE' ? 'NFS-e' : typeFilter === 'NFE' ? 'NF-e' : 'NFC-e'}. Toque em + para adicionar.`

  const headerRight = useMemo(
    () => (
      <Pressable
        onPress={openAddChoice}
        style={flow.headerAdd}
        accessibilityRole="button"
        accessibilityLabel="Adicionar produto ou serviço"
      >
        <Ionicons name="add" size={22} color={theme.primary} />
      </Pressable>
    ),
    [flow.headerAdd, theme.primary],
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
              const isNfeLike = isNfeLikeCatalogDocumentType(String(item.document_type || ''))
              const needsCodigo = Boolean(
                item.metadata_json
                && typeof item.metadata_json === 'object'
                && (item.metadata_json as { needsServicoCodigo?: boolean }).needsServicoCodigo,
              )
              const missingCodigo = !String(item.codigo || '').trim()
              const needsNcm = isNfeLike && catalogProdutoNeedsNfeCompletion(item)
              const tipo = catalogDocTypeLabel(item.document_type)
              const metaBits = [
                tipo,
                item.cnae ? `CNAE ${item.cnae}` : null,
                !isNfeLike && (needsCodigo || missingCodigo) ? 'Completar código LC 116' : null,
                needsNcm ? 'Completar NCM' : null,
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
        visible={addChoiceVisible}
        title="Como adicionar?"
        onClose={() => setAddChoiceVisible(false)}
      >
        <Text style={[flow.hint, { marginBottom: 14 }]}>
          Produtos NF-e precisam de nome e NCM. O sistema calcula impostos na emissão.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={openCreate}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            marginBottom: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: choiceBorder,
          }}
        >
          <Ionicons name="create-outline" size={22} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>Criar produto</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
              Nome, NCM e preço — impostos calculados automaticamente
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={openImportSheet}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            marginBottom: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: choiceBorder,
          }}
        >
          <Ionicons name="document-attach-outline" size={22} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>Importar planilha</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
              Excel/CSV com produtos já configurados
            </Text>
          </View>
        </Pressable>
      </MeiFormSheet>

      <MeiFormSheet
        visible={importVisible}
        title="Importar planilha de produtos"
        onClose={() => !importBusy && setImportVisible(false)}
        footer={
          <MeiFormSheetActions
            onCancel={() => setImportVisible(false)}
            onConfirm={() => void handleConfirmImport()}
            confirmLabel={importBusy ? 'Importando…' : 'Importar'}
            loading={importBusy}
            disabled={importBusy || importRowCount === 0}
          />
        }
      >
        <Text style={[flow.hint, { marginBottom: 12 }]}>
          Colunas: codigo, descricao, ncm (8 dígitos), unidade, preco.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleDownloadTemplate()}
          disabled={importBusy}
          style={{ marginBottom: 12 }}
        >
          <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 14 }}>
            Baixar modelo (.xlsx)
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void handlePickSpreadsheet()}
          disabled={importBusy}
          style={{
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: choiceBorder,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          {importBusy ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Ionicons name="folder-open-outline" size={22} color={theme.primary} />
              <Text style={{ color: theme.text, fontWeight: '600', marginTop: 8 }}>
                Selecionar arquivo
              </Text>
            </>
          )}
        </Pressable>
        {importFileName ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {importFileName} · {importRowCount} linha(s) pronta(s)
          </Text>
        ) : null}
      </MeiFormSheet>

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
              Informe nome, NCM e preço. O sistema define impostos e códigos fiscais
              automaticamente na hora de emitir a nota.
            </MeiFormBanner>
            <MeiFormSectionLabel>Dados do produto</MeiFormSectionLabel>
            <MeiFormField
              label="Código / SKU"
              placeholder="Opcional — ex.: AGUA20L"
              value={form.codigo}
              onChangeText={(t) => setForm((f) => ({ ...f, codigo: t }))}
            />
            <MeiFormField
              label="Nome do produto"
              required
              placeholder="Ex.: Refrigerante Cola 2L PET, Cerveja 350ml Lata"
              hint="Inclua a embalagem (PET, lata, garrafa) quando aplicável — ajuda a vincular o CEST em produtos com ST."
              value={form.discriminacao}
              onChangeText={(t) => setForm((f) => ({ ...f, discriminacao: t }))}
              multiline
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
            <NcmAutocompleteField
              required
              value={form.nfe.ncm}
              productHint={form.discriminacao}
              onChange={(ncm) =>
                setForm((f) => ({ ...f, nfe: { ...f.nfe, ncm } }))
              }
            />
            <MeiFormField
              label="CEST (opcional)"
              placeholder="7 dígitos — preenchido automaticamente se possível"
              hint="Obrigatório em alguns produtos com ST. Informe ou deixe em branco para sugestão pela embalagem na descrição."
              value={form.nfe.cest}
              onChangeText={(t) =>
                setForm((f) => ({
                  ...f,
                  nfe: { ...f.nfe, cest: t.replace(/\D/g, '').slice(0, 7) },
                }))
              }
              keyboardType="number-pad"
            />
            <MeiFormField
              label="Preço de venda (opcional)"
              placeholder="Ex.: 12,50"
              hint="Pré-preenche o valor na hora de emitir a nota."
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
          placeholder={
            resolveAppOrigin() === 'focosimples'
              ? 'Simples Nacional: deixe em branco se ISS no DAS'
              : 'Simples Nacional: deixe em branco'
          }
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
