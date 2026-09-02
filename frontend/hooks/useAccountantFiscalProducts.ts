import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NfseCatalogProduto } from '@/services/meiNotasService'
import {
  createAccountantClientProduct,
  listAccountantClientEstablishments,
  listAccountantClientProducts,
  listAccountantClients,
  updateAccountantClientProduct,
  type AccountantClient,
  type AccountantEstablishment,
} from '@/services/accountantClientsService'
import {
  approveAccountantRule,
  assignProductsToFiscalGroup,
  createAccountantRuleDraft,
  createAccountantRuleNewVersion,
  createFiscalProductGroup,
  fetchCompanyFiscalProfile,
  fetchFiscalConfigurationReadiness,
  fetchProductFiscalProfile,
  isFiscalForbiddenError,
  listAccountantFiscalRules,
  listFiscalProductGroupProducts,
  listFiscalProductGroups,
  previewAccountantRuleDraft,
  removeProductFromFiscalGroup,
  saveProductFiscalProfile,
  updateAccountantRuleDraft,
  updateFiscalProductGroup,
} from '@/services/fiscalConfigurationService'
import { readCatalogNcmCest } from '@/lib/fiscalConfiguration/ruleFormMapper'
import {
  deriveProductFiscalUiStatus,
  findRulesForProductAtEstablishment,
  pickPrimaryRule,
  resolveEstablishmentSelection,
} from '@/lib/fiscalConfiguration/productFiscalStatus'
import type {
  AccountantApprovedRule,
  FiscalProductGroup,
  FiscalProductListRow,
  FiscalReadinessResponse,
  ProductFiscalConfigForm,
  RulePreviewResult,
} from '@/lib/fiscalConfiguration/types'
import {
  emptyProductFiscalConfigForm,
  formToRuleDraft,
  ruleToForm,
  deriveIcmsGroupFromCsosn,
} from '@/lib/fiscalConfiguration/ruleFormMapper'

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'forbidden'

export type CommercialProductForm = {
  discriminacao: string
  codigo: string
  unidade: string
  ncm: string
  cest: string
  valor_sugerido: string
  fiscalProductGroupId: string
}

export function emptyCommercialProductForm(): CommercialProductForm {
  return {
    discriminacao: '',
    codigo: '',
    unidade: 'UN',
    ncm: '',
    cest: '',
    valor_sugerido: '',
    fiscalProductGroupId: '',
  }
}

export function useAccountantFiscalProducts(options: {
  role: string | null
}) {
  const [clientsLoadState, setClientsLoadState] = useState<LoadState>('loading')
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [clients, setClients] = useState<AccountantClient[]>([])
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null)
  const [establishments, setEstablishments] = useState<AccountantEstablishment[]>([])
  const [establishmentStatus, setEstablishmentStatus] = useState<'OK' | 'NO_FISCAL_ESTABLISHMENT' | null>(null)
  const [establishmentId, setEstablishmentIdState] = useState<string>('')
  const [catalog, setCatalog] = useState<NfseCatalogProduto[]>([])
  const [rules, setRules] = useState<AccountantApprovedRule[]>([])
  const [groups, setGroups] = useState<FiscalProductGroup[]>([])
  const [productGroupMap, setProductGroupMap] = useState<Record<string, { id: string; name: string }>>({})
  const [groupProductCounts, setGroupProductCounts] = useState<Record<string, number>>({})
  const [readiness, setReadiness] = useState<FiscalReadinessResponse | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [groupFilter, setGroupFilter] = useState<string>('ALL')
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [commercialForm, setCommercialForm] = useState<CommercialProductForm>(emptyCommercialProductForm())

  const selectedClientId = useMemo(() => {
    if (!selectedClientKey) return null
    const matched = clients.find(
      (client) => (client.clientKey ?? client.empresaId) === selectedClientKey,
    )
    return matched?.empresaId ?? selectedClientKey.split(':')[0] ?? null
  }, [clients, selectedClientKey])

  const selectedClient = useMemo(
    () => clients.find((c) => (c.clientKey ?? c.empresaId) === selectedClientKey) ?? null,
    [clients, selectedClientKey],
  )

  const loadClients = useCallback(async () => {
    setClientsLoadState('loading')
    try {
      const rows = await listAccountantClients()
      setClients(rows)
      setClientsLoadState('ready')
      if (rows.length === 1) {
        const first = rows[0]
        setSelectedClientKey(first.clientKey ?? first.empresaId)
        if (first.establishmentId) {
          setEstablishmentIdState(first.establishmentId)
        }
        setLoadState('loading')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar clientes.'
      const isAuthError = /não autenticado|not authenticated|sessão inválida|token ausente|401/i.test(message)
      setClientsLoadState('error')
      setErrorMessage(
        isAuthError
          ? 'Sessão expirada ou inválida. Saia e entre novamente.'
          : message,
      )
    }
  }, [])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  const selectClient = useCallback((clientKey: string | null) => {
    setSelectedClientKey(clientKey)
    const matched = clientKey
      ? clients.find((client) => (client.clientKey ?? client.empresaId) === clientKey)
      : null
    const establishmentId = matched?.establishmentId
      ?? (clientKey?.split(':')[1]?.replace(/\D/g, '') ?? '')
    setEstablishmentIdState(establishmentId)
    setEstablishments([])
    setEstablishmentStatus(null)
    setCatalog([])
    setRules([])
    setGroups([])
    setProductGroupMap({})
    setGroupProductCounts({})
    setReadiness(null)
    setSearch('')
    setStatusFilter('ALL')
    setGroupFilter('ALL')
    setCreatingProduct(false)
    setCommercialForm(emptyCommercialProductForm())
    setErrorMessage(null)
    setLoadState(clientKey ? 'loading' : 'idle')
  }, [clients])

  const reloadProductGroups = useCallback(async (clientId: string) => {
    const groupRows = await listFiscalProductGroups(clientId)
    setGroups(groupRows)

    const memberships = await Promise.all(
      groupRows.map(async (group) => {
        const products = await listFiscalProductGroupProducts(group.id, clientId)
        return { group, products }
      }),
    )

    const map: Record<string, { id: string; name: string }> = {}
    const counts: Record<string, number> = {}
    for (const entry of memberships) {
      counts[entry.group.id] = entry.products.length
      for (const membership of entry.products) {
        map[membership.productId] = { id: entry.group.id, name: entry.group.name }
      }
    }
    setProductGroupMap(map)
    setGroupProductCounts(counts)
  }, [])

  const reloadFiscalRules = useCallback(async (clientId: string) => {
    const [ruleRows, readinessRow] = await Promise.all([
      listAccountantFiscalRules(clientId),
      fetchFiscalConfigurationReadiness(clientId),
    ])
    setRules(ruleRows)
    setReadiness(readinessRow)
  }, [])

  const reloadFiscal = useCallback(async (clientId: string) => {
    await Promise.all([reloadProductGroups(clientId), reloadFiscalRules(clientId)])
  }, [reloadFiscalRules, reloadProductGroups])

  const reload = useCallback(async () => {
    if (!selectedClientId) {
      setLoadState('idle')
      return
    }

    setLoadState('loading')
    setErrorMessage(null)

    try {
      const [establishmentResult, catalogRows] = await Promise.all([
        listAccountantClientEstablishments(selectedClientId),
        listAccountantClientProducts(selectedClientId, {
          limit: 200,
          documentType: 'NFE',
          emitterUserId: selectedClient?.emitterUserId ?? null,
        }),
      ])

      setEstablishments(establishmentResult.establishments)
      setEstablishmentStatus(establishmentResult.status)
      setCatalog(catalogRows)
      const preferredEstablishment = selectedClient?.establishmentId ?? ''
      setEstablishmentIdState((prev) => {
        if (preferredEstablishment) {
          const preferredDigits = preferredEstablishment.replace(/\D/g, '')
          const matched = establishmentResult.establishments.find(
            (entry) => entry.establishmentId.replace(/\D/g, '') === preferredDigits,
          )
          if (matched) return matched.establishmentId
          return preferredEstablishment
        }
        return resolveEstablishmentSelection(prev, establishmentResult.establishments)
      })

      await reloadProductGroups(selectedClientId)
      if (establishmentResult.status === 'OK') {
        await reloadFiscalRules(selectedClientId)
      } else {
        setRules([])
        setReadiness(null)
      }

      setLoadState('ready')
    } catch (error) {
      if (isFiscalForbiddenError(error)) {
        setLoadState('forbidden')
        setErrorMessage('Você não tem permissão para acessar a configuração fiscal deste cliente.')
        return
      }
      setLoadState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar produtos fiscais.')
    }
  }, [reloadFiscalRules, reloadProductGroups, selectedClient, selectedClientId])

  const persistProductGroupMembership = useCallback(async (
    productId: string,
    nextGroupId: string,
    currentMap: Record<string, { id: string; name: string }>,
  ) => {
    if (!selectedClientId) return
    const currentGroupId = currentMap[productId]?.id ?? ''
    if (currentGroupId === nextGroupId) return

    if (nextGroupId) {
      await assignProductsToFiscalGroup(nextGroupId, [productId], true, selectedClientId)
      return
    }

    if (currentGroupId) {
      await removeProductFromFiscalGroup(currentGroupId, productId, selectedClientId)
    }
  }, [selectedClientId])

  const createGroup = useCallback(async (input: { name: string; description?: string }) => {
    if (!selectedClientId) throw new Error('Selecione um cliente.')
    const group = await createFiscalProductGroup(input, selectedClientId)
    await reloadProductGroups(selectedClientId)
    return group
  }, [reloadProductGroups, selectedClientId])

  const updateGroup = useCallback(async (
    groupId: string,
    input: { name?: string; description?: string | null },
  ) => {
    if (!selectedClientId) throw new Error('Selecione um cliente.')
    const group = await updateFiscalProductGroup(groupId, input, selectedClientId)
    await reloadProductGroups(selectedClientId)
    return group
  }, [reloadProductGroups, selectedClientId])

  const bulkAssignProductsToGroup = useCallback(async (productIds: string[], groupId: string) => {
    if (!selectedClientId) throw new Error('Selecione um cliente.')
    if (!groupId) throw new Error('Selecione um grupo fiscal.')
    await assignProductsToFiscalGroup(groupId, productIds, true, selectedClientId)
    await reloadProductGroups(selectedClientId)
  }, [reloadProductGroups, selectedClientId])

  const setEstablishmentId = useCallback((nextId: string) => {
    setEstablishmentIdState(nextId)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const rows: FiscalProductListRow[] = useMemo(() => {
    return catalog.map((product) => {
      const meta = readCatalogNcmCest(product.metadata_json)
      const group = productGroupMap[product.id] ?? null

      if (!establishmentId) {
        return {
          productId: product.id,
          descricao: product.discriminacao ?? product.codigo ?? 'Produto',
          codigo: product.codigo ?? '',
          ncm: meta.ncm,
          cest: meta.cest,
          unidade: meta.unidade,
          grupoFiscalId: group?.id ?? null,
          grupoFiscalNome: group?.name ?? null,
          fiscalStatus: 'PENDENTE' as const,
          ruleId: null,
          ruleStatus: null,
          updatedAt: product.updated_at ?? product.created_at ?? null,
        }
      }

      const matched = findRulesForProductAtEstablishment(
        rules,
        product.id,
        group?.id ?? null,
        establishmentId,
      )
      const primary = pickPrimaryRule(matched)
      const fiscalStatus = deriveProductFiscalUiStatus(matched, null)

      return {
        productId: product.id,
        descricao: product.discriminacao ?? product.codigo ?? 'Produto',
        codigo: product.codigo ?? '',
        ncm: meta.ncm,
        cest: meta.cest,
        unidade: meta.unidade,
        grupoFiscalId: group?.id ?? null,
        grupoFiscalNome: group?.name ?? null,
        fiscalStatus,
        ruleId: primary?.id ?? null,
        ruleStatus: primary?.status ?? null,
        updatedAt: product.updated_at ?? product.created_at ?? null,
      }
    })
  }, [catalog, establishmentId, productGroupMap, rules])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'ALL' && row.fiscalStatus !== statusFilter) return false
      if (groupFilter !== 'ALL' && row.grupoFiscalId !== groupFilter) return false
      if (!q) return true
      const haystack = `${row.descricao} ${row.codigo} ${row.ncm}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [groupFilter, rows, search, statusFilter])

  const saveCommercialProduct = useCallback(async (
    productId?: string | null,
    options?: { keepOpen?: boolean },
  ): Promise<{ productId: string } | void> => {
    if (!selectedClientId) return
    const valor = commercialForm.valor_sugerido.trim()
    const payload = {
      discriminacao: commercialForm.discriminacao.trim(),
      codigo: commercialForm.codigo.trim(),
      documentType: 'NFE',
      valor_sugerido: valor ? Number(valor.replace(',', '.')) : null,
      metadata_json: {
        ncm: commercialForm.ncm.replace(/\D/g, ''),
        cest: commercialForm.cest.replace(/\D/g, ''),
        unidade: commercialForm.unidade.trim() || 'UN',
      },
    }
    if (!payload.discriminacao) throw new Error('Descrição é obrigatória.')

    let savedProductId = productId ?? null
    if (productId) {
      await updateAccountantClientProduct(selectedClientId, productId, payload)
      await persistProductGroupMembership(
        productId,
        commercialForm.fiscalProductGroupId,
        productGroupMap,
      )
    } else {
      const created = await createAccountantClientProduct(
        selectedClientId,
        payload,
        { emitterUserId: selectedClient?.emitterUserId ?? null },
      )
      savedProductId = created.id
      if (commercialForm.fiscalProductGroupId) {
        await assignProductsToFiscalGroup(
          commercialForm.fiscalProductGroupId,
          [created.id],
          true,
          selectedClientId,
        )
      }
    }
    if (!options?.keepOpen) {
      setCreatingProduct(false)
      setCommercialForm(emptyCommercialProductForm())
    }
    await reload()
    if (savedProductId) return { productId: savedProductId }
  }, [commercialForm, persistProductGroupMembership, productGroupMap, reload, selectedClient, selectedClientId])

  return {
    loadState,
    clientsLoadState,
    errorMessage,
    clients,
    selectedClientId,
    selectedClientKey,
    selectedClient,
    selectClient,
    establishments,
    establishmentStatus,
    establishmentId,
    setEstablishmentId,
    catalog,
    rules,
    groups,
    productGroupMap,
    groupProductCounts,
    readiness,
    rows: filteredRows,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    groupFilter,
    setGroupFilter,
    reload,
    reloadProductGroups,
    creatingProduct,
    setCreatingProduct,
    commercialForm,
    setCommercialForm,
    saveCommercialProduct,
    createGroup,
    updateGroup,
    bulkAssignProductsToGroup,
    persistProductGroupMembership,
  }
}

export function useProductFiscalConfiguration(options: {
  clientEmpresaId: string | null
  productId: string | null
  establishmentId: string
  rules: AccountantApprovedRule[]
  groups: FiscalProductGroup[]
  productGroupMap: Record<string, { id: string; name: string }>
  catalog: NfseCatalogProduto[]
  canEdit: boolean
  onSaved: (savedRule: AccountantApprovedRule) => void | Promise<void>
  onCommercialSaved: () => void
  persistProductGroupMembership: (productId: string, nextGroupId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ProductFiscalConfigForm>(emptyProductFiscalConfigForm())
  const [rule, setRule] = useState<AccountantApprovedRule | null>(null)
  const [preview, setPreview] = useState<RulePreviewResult | null>(null)
  const [catalogItem, setCatalogItem] = useState<NfseCatalogProduto | null>(null)
  const [fiscalStatus, setFiscalStatus] = useState<'READY' | 'PENDENTE' | 'INCOMPLETO' | 'BLOQUEADO'>('PENDENTE')
  const [commercialForm, setCommercialForm] = useState<CommercialProductForm>(emptyCommercialProductForm())

  const patchForm = useCallback((patch: Partial<ProductFiscalConfigForm>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      next.icmsGroup = deriveIcmsGroupFromCsosn(next.csosn)
      return next
    })
  }, [])

  const patchCommercial = useCallback((patch: Partial<CommercialProductForm>) => {
    setCommercialForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setOpen(false)
    setLoading(false)
    setSaving(false)
    setForm(emptyProductFiscalConfigForm())
    setRule(null)
    setPreview(null)
    setCatalogItem(null)
    setFiscalStatus('PENDENTE')
    setCommercialForm(emptyCommercialProductForm())
  }, [])

  const hydrateCommercialProduct = useCallback((productId: string) => {
    const product = options.catalog.find((p) => p.id === productId) ?? null
    setCatalogItem(product)
    const meta = readCatalogNcmCest(product?.metadata_json)
    const group = options.productGroupMap[productId] ?? null
    setCommercialForm({
      discriminacao: product?.discriminacao ?? '',
      codigo: product?.codigo ?? '',
      unidade: meta.unidade || 'UN',
      ncm: meta.ncm,
      cest: meta.cest,
      valor_sugerido: product?.valor_sugerido != null ? String(product.valor_sugerido) : '',
      fiscalProductGroupId: group?.id ?? '',
    })
  }, [options.catalog, options.productGroupMap])

  const loadFiscalForEstablishment = useCallback(async (productId: string, establishmentId: string) => {
    if (!options.clientEmpresaId || !establishmentId) return
    setLoading(true)
    try {
      const product = options.catalog.find((p) => p.id === productId) ?? null
      const meta = readCatalogNcmCest(product?.metadata_json)

      const [companyProfile, productProfile, ruleRows] = await Promise.all([
        fetchCompanyFiscalProfile(options.clientEmpresaId, establishmentId),
        fetchProductFiscalProfile(productId, options.clientEmpresaId),
        listAccountantFiscalRules(options.clientEmpresaId),
      ])

      const group = options.productGroupMap[productId] ?? null
      const matched = findRulesForProductAtEstablishment(
        ruleRows,
        productId,
        group?.id ?? null,
        establishmentId,
      )
      const primary = pickPrimaryRule(matched)
      setRule(primary)

      const nextForm = ruleToForm(primary, companyProfile, productProfile, group?.id ?? null)
      setForm(nextForm)
      setFiscalStatus(deriveProductFiscalUiStatus(matched, null))

      const draft = formToRuleDraft(nextForm, {
        productId,
        establishmentId,
        establishmentIssuerUf: companyProfile?.issuerUf,
        crt: companyProfile?.crt,
        ncm: meta.ncm,
        ruleId: primary?.id,
        version: primary?.version,
      })

      const previewResult = await previewAccountantRuleDraft(
        draft as Partial<AccountantApprovedRule>,
        options.clientEmpresaId,
      )
      setPreview(previewResult)
      setFiscalStatus(deriveProductFiscalUiStatus(matched, previewResult))
    } catch (error) {
      setPreview(null)
      throw error
    } finally {
      setLoading(false)
    }
  }, [options.catalog, options.clientEmpresaId, options.productGroupMap])

  const openProduct = useCallback(async (productId: string, establishmentIdOverride?: string) => {
    if (!options.clientEmpresaId) return
    const establishmentId = establishmentIdOverride ?? options.establishmentId
    setOpen(true)
    setRule(null)
    setPreview(null)
    setForm(emptyProductFiscalConfigForm())
    setFiscalStatus('PENDENTE')
    hydrateCommercialProduct(productId)
    if (establishmentId) {
      await loadFiscalForEstablishment(productId, establishmentId)
    }
  }, [hydrateCommercialProduct, loadFiscalForEstablishment, options.clientEmpresaId, options.establishmentId])

  const loadProduct = useCallback(async (productId: string) => {
    await openProduct(productId)
  }, [openProduct])

  const saveCommercial = useCallback(async () => {
    if (!options.clientEmpresaId || !options.productId || !options.canEdit) return
    setSaving(true)
    try {
      const valor = commercialForm.valor_sugerido.trim()
      await updateAccountantClientProduct(options.clientEmpresaId, options.productId, {
        discriminacao: commercialForm.discriminacao.trim(),
        codigo: commercialForm.codigo.trim(),
        valor_sugerido: valor ? Number(valor.replace(',', '.')) : null,
        metadata_json: {
          ncm: commercialForm.ncm.replace(/\D/g, ''),
          cest: commercialForm.cest.replace(/\D/g, ''),
          unidade: commercialForm.unidade.trim() || 'UN',
        },
      })
      await options.persistProductGroupMembership(
        options.productId,
        commercialForm.fiscalProductGroupId,
      )
      options.onCommercialSaved()
    } finally {
      setSaving(false)
    }
  }, [commercialForm, options])

  const saveDraft = useCallback(async () => {
    if (!options.productId || !options.canEdit || !options.clientEmpresaId) {
      throw new Error('Produto ou permissão indisponível para salvar.')
    }
    const establishmentId = String(options.establishmentId ?? '').replace(/\D/g, '')
    if (!establishmentId) {
      throw new Error('Selecione o estabelecimento fiscal antes de salvar.')
    }
    const cfop = form.cfop.replace(/\D/g, '').slice(0, 4)
    const csosn = form.csosn.replace(/\D/g, '').slice(0, 3)
    if (!cfop || !csosn) {
      throw new Error('Preencha CFOP e CSOSN antes de salvar o rascunho fiscal.')
    }

    setSaving(true)
    try {
      const companyProfile = await fetchCompanyFiscalProfile(options.clientEmpresaId, establishmentId)
      const meta = readCatalogNcmCest(catalogItem?.metadata_json)

      await saveProductFiscalProfile(
        options.productId,
        {
          productId: options.productId,
          ncm: meta.ncm,
          cest: meta.cest || undefined,
          itemSource: form.itemSource,
        },
        options.clientEmpresaId,
      )

      const draftPayload = formToRuleDraft(form, {
        productId: options.productId,
        establishmentId,
        establishmentIssuerUf: companyProfile?.issuerUf,
        crt: companyProfile?.crt,
        ncm: meta.ncm,
        ruleId: rule?.status === 'DRAFT' ? rule.id : undefined,
        version: rule?.status === 'DRAFT' ? rule.version : undefined,
      }) as Partial<AccountantApprovedRule>

      let saved: AccountantApprovedRule
      if (rule?.status === 'DRAFT' && rule.id) {
        saved = await updateAccountantRuleDraft(rule.id, rule.version, draftPayload, options.clientEmpresaId)
      } else if (!rule || rule.status === 'APPROVED') {
        saved = await createAccountantRuleDraft(draftPayload, options.clientEmpresaId)
      } else {
        saved = await createAccountantRuleDraft(draftPayload, options.clientEmpresaId)
      }

      await options.persistProductGroupMembership(
        options.productId,
        commercialForm.fiscalProductGroupId,
      )

      const previewResult = await previewAccountantRuleDraft(saved, options.clientEmpresaId)
      setPreview(previewResult)
      setRule(saved)
      setForm(ruleToForm(
        saved,
        companyProfile,
        null,
        commercialForm.fiscalProductGroupId || null,
      ))
      setFiscalStatus(deriveProductFiscalUiStatus([saved], previewResult))
      await options.onSaved(saved)
    } finally {
      setSaving(false)
    }
  }, [catalogItem?.metadata_json, commercialForm.fiscalProductGroupId, form, options, rule])

  const approve = useCallback(async (justification?: string) => {
    if (!rule?.id || !options.clientEmpresaId) return
    setSaving(true)
    try {
      const approved = await approveAccountantRule(rule.id, justification, options.clientEmpresaId)
      await options.onSaved(approved)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }, [options, rule?.id])

  const newVersion = useCallback(async () => {
    if (!rule?.id || !options.clientEmpresaId) return
    setSaving(true)
    try {
      const next = await createAccountantRuleNewVersion(rule.id, {}, options.clientEmpresaId)
      setRule(next)
      setForm(ruleToForm(
        next,
        await fetchCompanyFiscalProfile(options.clientEmpresaId, options.establishmentId),
        null,
        commercialForm.fiscalProductGroupId || null,
      ))
      await options.onSaved(next)
    } finally {
      setSaving(false)
    }
  }, [commercialForm.fiscalProductGroupId, options, rule?.id])

  return {
    open,
    setOpen,
    loading,
    saving,
    form,
    patchForm,
    commercialForm,
    patchCommercial,
    rule,
    preview,
    catalogItem,
    fiscalStatus,
    loadProduct,
    openProduct,
    loadFiscalForEstablishment,
    reset,
    saveCommercial,
    saveDraft,
    approve,
    newVersion,
  }
}
