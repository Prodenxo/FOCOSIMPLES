import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Pressable } from 'react-native'
import type { NfeDestinatarioEnderecoForm } from '../lib/meiNfseForms'
import type { DestinatarioIndIeDest } from '../lib/meiNfeDestinatarioIe'
import { buildClienteCatalogLabel } from '../lib/meiFormatters'
import {
  buildCatalogClienteMetadataJson,
  enderecoFromCnpjLookup,
  mergeEnderecoFromCepLookup,
  parseCatalogClienteFiscalMeta,
  validateCatalogClienteNfeFields,
  validateCatalogClienteNfseTomadorFields,
} from '../lib/meiCatalogClienteFiscal'
import {
  formatCatalogGrupoMeta,
  groupCatalogoClientes,
  type CatalogClienteGrupo,
} from '../lib/meiCatalogClienteGroup'
import { getDefaultNfeDestinatarioEndereco } from '../lib/meiNfseForms'
import { DEFAULT_DESTINATARIO_IND_IE_DEST } from '../lib/meiNfeDestinatarioIe'
import type { NfseCatalogCliente } from '../services/meiNotasService'
import {
  listarCatalogoNfseClientes,
  lookupCnpj,
  lookupNfseEnderecoPorCep,
  softHideCatalogoClientePorDocumento,
  syncCatalogoClienteDocumentTypes,
} from '../services/meiNotasService'
import {
  MeiFlowModalShell,
  MeiFormField,
  MeiFormSheet,
  MeiCatalogListCard,
  MeiSearchBar,
  MeiConfirmDialog,
  MeiFormSheetActions,
  MeiFormSectionLabel,
  MeiTypeMultiChips,
  useMeiFlowStyles,
  type MeiDocType,
} from '../components/mei/meiFlowUi'
import { useMfTheme } from '../components/ui/useMfTheme'
import { alertDialog } from '../lib/confirmDialog'
import { useAppToastStore } from '../store/appToastStore'

const PAGE_SIZE = 50
const CLIENTE_DOC_TYPES: MeiDocType[] = ['NFSE', 'NFE', 'NFCE']

function normalizeDoc (value: string): string {
  return value.replace(/\D/g, '')
}

function formatDocumentDisplay (value: string): string {
  const digits = normalizeDoc(value).slice(0, 14)
  let formatted = ''
  for (let i = 0; i < digits.length; i += 1) {
    formatted += digits[i]
    if (digits.length <= 11) {
      if (i === 2 || i === 5) formatted += '.'
      if (i === 8) formatted += '-'
    } else {
      if (i === 1 || i === 4) formatted += '.'
      if (i === 7) formatted += '/'
      if (i === 11) formatted += '-'
    }
  }
  return formatted
}

function validateClienteForm (documento: string, nome: string): string | null {
  const doc = normalizeDoc(documento)
  if (doc.length !== 11 && doc.length !== 14) {
    return 'Informe CPF (11 dígitos) ou CNPJ (14 dígitos).'
  }
  if (!nome.trim()) {
    return 'Nome ou razão social é obrigatório.'
  }
  return null
}

export type MeiCatalogoClientesModalProps = {
  visible: boolean
  onClose: () => void
  onCatalogChanged?: () => void
}

type FormState = {
  documento: string
  nome: string
  email: string
  documentTypes: Array<'NFSE' | 'NFE' | 'NFCE'>
  indIEDest: DestinatarioIndIeDest
  endereco: NfeDestinatarioEnderecoForm
}

const emptyForm = (): FormState => ({
  documento: '',
  nome: '',
  email: '',
  documentTypes: ['NFSE'],
  indIEDest: DEFAULT_DESTINATARIO_IND_IE_DEST,
  endereco: getDefaultNfeDestinatarioEndereco(),
})

export default function MeiCatalogoClientesModal ({
  visible,
  onClose,
  onCatalogChanged,
}: MeiCatalogoClientesModalProps) {
  const { theme } = useMfTheme()
  const flow = useMeiFlowStyles()
  const showToast = useAppToastStore((s) => s.show)

  const [items, setItems] = useState<NfseCatalogCliente[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const nextOffsetRef = useRef(0)
  const searchQRef = useRef(searchQ)
  const hasMoreRef = useRef(hasMore)
  const loadingMoreRef = useRef(loadingMore)
  const refreshingRef = useRef(refreshing)
  const fetchGenRef = useRef(0)

  searchQRef.current = searchQ
  hasMoreRef.current = hasMore
  loadingMoreRef.current = loadingMore
  refreshingRef.current = refreshing

  const [formVisible, setFormVisible] = useState(false)
  const [editingDocumento, setEditingDocumento] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false)
  const [cepLookupLoading, setCepLookupLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CatalogClienteGrupo | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const groupedItems = useMemo(() => groupCatalogoClientes(items), [items])

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
        const page = await listarCatalogoNfseClientes({
          q: q.trim() || undefined,
          limit: PAGE_SIZE,
          offset: startOffset > 0 ? startOffset : undefined,
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
  }, [visible, resetList, fetchPage])

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
    setEditingDocumento(null)
    setForm(emptyForm())
    setFormVisible(true)
  }

  const openEdit = async (group: CatalogClienteGrupo) => {
    const fiscal = parseCatalogClienteFiscalMeta(group.primary.metadata_json ?? undefined)
    setEditingDocumento(group.documento)
    setForm({
      documento: formatDocumentDisplay(group.documento),
      nome: group.nome ?? '',
      email: group.email ?? '',
      documentTypes: group.activeTypes.filter(
        (t): t is 'NFSE' | 'NFE' | 'NFCE' => t === 'NFSE' || t === 'NFE' || t === 'NFCE',
      ),
      indIEDest: fiscal.indIEDest ?? DEFAULT_DESTINATARIO_IND_IE_DEST,
      endereco: fiscal.endereco ?? getDefaultNfeDestinatarioEndereco(),
    })
    setFormVisible(true)

    try {
      const all = await listarCatalogoNfseClientes({
        q: group.documento,
        limit: 20,
        includeInactive: true,
      })
      const exact = (Array.isArray(all) ? all : []).filter(
        (r) => normalizeDoc(r.documento || '') === group.documento,
      )
      const activeFromApi = exact
        .filter((r) => r.active !== false)
        .map((r) => String(r.document_type || '').toUpperCase())
        .filter((t): t is 'NFSE' | 'NFE' | 'NFCE' => t === 'NFSE' || t === 'NFE' || t === 'NFCE')
      if (activeFromApi.length > 0) {
        setForm((f) => ({
          ...f,
          documentTypes: [...new Set(activeFromApi)],
        }))
      }
      const bestMeta = exact.find((r) => r.document_type === 'NFE') || exact[0]
      if (bestMeta?.metadata_json) {
        const meta = parseCatalogClienteFiscalMeta(bestMeta.metadata_json)
        setForm((f) => ({
          ...f,
          indIEDest: meta.indIEDest ?? f.indIEDest,
          endereco: meta.endereco ?? f.endereco,
        }))
      }
    } catch {
      // Mantém os tipos já carregados do grupo na listagem.
    }
  }

  const lookupDocumentoEndereco = async () => {
    const digits = normalizeDoc(form.documento)
    if (digits.length !== 14) return
    setCnpjLookupLoading(true)
    try {
      const data = await lookupCnpj(digits)
      setForm((f) => ({
        ...f,
        nome: f.nome.trim() || data.razaoSocial || f.nome,
        email: f.email.trim() || data.email || f.email,
        endereco: enderecoFromCnpjLookup(data),
      }))
      showToast('Endereço preenchido pela Receita Federal.', 'success')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Não foi possível consultar o CNPJ.', 'error')
    } finally {
      setCnpjLookupLoading(false)
    }
  }

  const lookupCepEndereco = async () => {
    const cep = normalizeDoc(form.endereco.cep)
    if (cep.length !== 8) return
    setCepLookupLoading(true)
    try {
      const data = await lookupNfseEnderecoPorCep(cep)
      setForm((f) => ({
        ...f,
        endereco: mergeEnderecoFromCepLookup(f.endereco, data),
      }))
      showToast('Endereço e código IBGE preenchidos pelo CEP.', 'success')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Não foi possível consultar o CEP.', 'error')
    } finally {
      setCepLookupLoading(false)
    }
  }

  const handleSaveForm = async () => {
    const err = validateClienteForm(form.documento, form.nome)
    if (err) {
      alertDialog('Validação', err)
      return
    }
    if (form.documentTypes.length === 0) {
      alertDialog('Validação', 'Selecione ao menos NFSE, NFE ou NFCE.')
      return
    }

    const wantsNfeLike =
      form.documentTypes.includes('NFE') || form.documentTypes.includes('NFCE')
    const wantsNfse = form.documentTypes.includes('NFSE')
    if (wantsNfeLike) {
      const nfeErr = validateCatalogClienteNfeFields('NFE', form.endereco)
      if (nfeErr) {
        alertDialog('Validação NF-e / NFC-e', nfeErr)
        return
      }
    }
    if (wantsNfse) {
      const nfseErr = validateCatalogClienteNfseTomadorFields(form.documento, form.endereco)
      if (nfseErr) {
        alertDialog('Validação NFS-e', nfseErr)
        return
      }
    }

    setSaving(true)
    try {
      const metadata_json = buildCatalogClienteMetadataJson({
        ...(wantsNfeLike ? { indIEDest: form.indIEDest } : {}),
        endereco: form.endereco,
      })
      await syncCatalogoClienteDocumentTypes({
        documento: normalizeDoc(form.documento),
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        documentTypes: form.documentTypes,
        metadata_json,
      })
      showToast(editingDocumento ? 'Cliente atualizado.' : 'Cliente criado.', 'success')
      setFormVisible(false)
      resetList()
      await fetchPage({ append: false, reset: true, q: searchQ })
      notifyChanged()
    } catch (e: unknown) {
      alertDialog('Erro', e instanceof Error ? e.message : 'Falha ao salvar cliente.')
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (group: CatalogClienteGrupo) => {
    setDeleteTarget(group)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await softHideCatalogoClientePorDocumento(deleteTarget.documento)
      showToast('Cliente ocultado. Cadastre de novo com o mesmo CPF/CNPJ para reativar.', 'success')
      setDeleteTarget(null)
      resetList()
      await fetchPage({ append: false, reset: true, q: searchQ })
      notifyChanged()
    } catch (e: unknown) {
      alertDialog('Erro', e instanceof Error ? e.message : 'Falha ao ocultar cliente.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const runSearch = () => {
    resetList()
    void fetchPage({ append: false, reset: true, q: searchQ })
  }

  const headerRight = useMemo(
    () => (
      <Pressable
        onPress={openCreate}
        style={flow.headerAdd}
        accessibilityRole="button"
        accessibilityLabel="Novo cliente"
      >
        <Ionicons name="add" size={22} color={theme.primary} />
      </Pressable>
    ),
    [flow.headerAdd, theme.primary],
  )

  const docDigitsForm = normalizeDoc(form.documento)
  const wantsNfeLike =
    form.documentTypes.includes('NFE') || form.documentTypes.includes('NFCE')
  const wantsNfse = form.documentTypes.includes('NFSE')
  const showTomadorEndereco = wantsNfeLike || wantsNfse
  const enderecoObrigatorio =
    wantsNfeLike || (wantsNfse && docDigitsForm.length === 14)
  const enderecoSectionTitle = (() => {
    if (wantsNfeLike) return 'Endereço (obrigatório na NF-e / NFC-e)'
    if (docDigitsForm.length === 14) return 'Endereço fiscal (obrigatório na NFS-e para CNPJ)'
    return 'Endereço fiscal (opcional para CPF)'
  })()

  return (
    <>
      <MeiFlowModalShell
        visible={visible}
        onClose={onClose}
        title="Catálogo de clientes"
        eyebrow=""
        closeIcon="close"
        headerRight={headerRight}
        flatListBody
      >
        <MeiSearchBar
          value={searchQ}
          onChangeText={setSearchQ}
          onSearch={runSearch}
          placeholder="Buscar por nome ou documento"
        />

        {loading && items.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={groupedItems}
            keyExtractor={(it) => it.documento}
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
              <Text style={flow.empty}>Nenhum cliente. Toque em + para adicionar.</Text>
            }
            renderItem={({ item }) => (
              <MeiCatalogListCard
                title={buildClienteCatalogLabel(item.primary)}
                meta={formatCatalogGrupoMeta(item)}
                onEdit={() => void openEdit(item)}
                onDelete={() => requestDelete(item)}
              />
            )}
          />
        )}

        <Text style={flow.hint}>
          Um cadastro por CPF/CNPJ. Marque NFSE e/ou NFE: desmarcar só oculta o tipo da listagem.
        </Text>
      </MeiFlowModalShell>

      <MeiFormSheet
        visible={formVisible}
        title={editingDocumento ? 'Editar cliente' : 'Novo cliente'}
        onClose={() => setFormVisible(false)}
        footer={
          <MeiFormSheetActions
            onCancel={() => setFormVisible(false)}
            onConfirm={handleSaveForm}
            loading={saving}
          />
        }
      >
        <MeiFormField
          label="CPF / CNPJ"
          required
          placeholder="Somente números ou formatado"
          value={form.documento}
          onChangeText={(t) => {
            if (editingDocumento) return
            setForm((f) => ({ ...f, documento: formatDocumentDisplay(t) }))
          }}
          onBlur={() => void lookupDocumentoEndereco()}
          keyboardType="numeric"
          editable={!editingDocumento}
        />
        {cnpjLookupLoading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>Consultando CNPJ na Receita…</Text>
          </View>
        ) : null}
        <MeiFormField
          label="Nome ou razão social"
          required
          placeholder="Nome completo"
          value={form.nome}
          onChangeText={(t) => setForm((f) => ({ ...f, nome: t }))}
        />
        <MeiFormField
          label="E-mail"
          placeholder="opcional"
          value={form.email}
          onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <MeiFormSectionLabel>Tipos de documento (pode marcar os dois)</MeiFormSectionLabel>
        <MeiTypeMultiChips
          value={form.documentTypes as MeiDocType[]}
          allowedTypes={CLIENTE_DOC_TYPES}
          onChange={(types) =>
            setForm((f) => ({
              ...f,
              documentTypes: types.filter(
                (t): t is 'NFSE' | 'NFE' | 'NFCE' =>
                  t === 'NFSE' || t === 'NFE' || t === 'NFCE',
              ),
            }))
          }
        />
        <Text style={[flow.hint, { marginBottom: 8 }]}>
          NFSE = serviço · NFE = produto · NFCE = cupom. Desmarcar oculta só esse tipo; marcar de novo reativa.
        </Text>
        {showTomadorEndereco ? (
          <>
            <MeiFormSectionLabel>{enderecoSectionTitle}</MeiFormSectionLabel>
            <Text style={[flow.hint, { marginBottom: 8 }]}>
              {wantsNfeLike
                ? 'Ao informar CNPJ, buscamos logradouro e IBGE automaticamente. Confira o número se vier vazio.'
                : enderecoObrigatorio
                  ? 'Informe o CEP para preencher logradouro, cidade, UF e código IBGE.'
                  : 'Opcional para pessoa física. Se informar o CEP, preenchemos o restante automaticamente.'}
            </Text>
            {cepLookupLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>Consultando CEP…</Text>
              </View>
            ) : null}
            <MeiFormField
              label="CEP"
              required={enderecoObrigatorio}
              value={form.endereco.cep}
              onChangeText={(t) =>
                setForm((f) => ({
                  ...f,
                  endereco: { ...f.endereco, cep: t.replace(/\D/g, '').slice(0, 8) },
                }))
              }
              onBlur={() => void lookupCepEndereco()}
              keyboardType="numeric"
              maxLength={8}
            />
            <MeiFormField
              label="Logradouro"
              required={enderecoObrigatorio}
              value={form.endereco.logradouro}
              onChangeText={(t) =>
                setForm((f) => ({ ...f, endereco: { ...f.endereco, logradouro: t } }))
              }
            />
            <MeiFormField
              label="Número"
              required={enderecoObrigatorio}
              value={form.endereco.numero}
              onChangeText={(t) =>
                setForm((f) => ({ ...f, endereco: { ...f.endereco, numero: t } }))
              }
            />
            <MeiFormField
              label="Bairro"
              required={enderecoObrigatorio}
              value={form.endereco.bairro}
              onChangeText={(t) =>
                setForm((f) => ({ ...f, endereco: { ...f.endereco, bairro: t } }))
              }
            />
            <MeiFormField
              label="Código IBGE"
              required={enderecoObrigatorio}
              value={form.endereco.codigoCidade}
              editable={false}
              keyboardType="numeric"
              maxLength={7}
            />
            <Text style={[flow.hint, { marginTop: -4, marginBottom: 8 }]}>
              Preenchido automaticamente ao informar o CEP.
            </Text>
            <MeiFormField
              label="Cidade"
              required={enderecoObrigatorio}
              value={form.endereco.descricaoCidade}
              onChangeText={(t) =>
                setForm((f) => ({ ...f, endereco: { ...f.endereco, descricaoCidade: t } }))
              }
            />
            <MeiFormField
              label="UF"
              required={enderecoObrigatorio}
              value={form.endereco.estado}
              onChangeText={(t) =>
                setForm((f) => ({
                  ...f,
                  endereco: {
                    ...f.endereco,
                    estado: t.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2),
                  },
                }))
              }
              maxLength={2}
              autoCapitalize="characters"
            />
          </>
        ) : null}
      </MeiFormSheet>

      <MeiConfirmDialog
        visible={deleteTarget != null}
        title="Ocultar cliente"
        message="Ocultar este cliente da listagem ativa? Para voltar a ver, cadastre o mesmo CPF/CNPJ e marque os tipos de novo."
        detail={deleteTarget ? buildClienteCatalogLabel(deleteTarget.primary) : undefined}
        confirmLabel="Ocultar"
        loading={deleteLoading}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleteLoading) setDeleteTarget(null)
        }}
      />
    </>
  )
}
