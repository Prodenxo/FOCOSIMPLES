import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { AccountantClientSelectField } from '@/components/fiscal-configuration/AccountantClientSelectField'
import { FiscalEstablishmentSelectField } from '@/components/fiscal-configuration/FiscalEstablishmentSelectField'
import { FiscalConfigSelectField } from '@/components/fiscal-configuration/FiscalConfigSelectField'
import { FiscalProductConfigDrawer } from '@/components/fiscal-configuration/FiscalProductConfigDrawer'
import { FiscalProductListPanel, buildBulkGroupOptions } from '@/components/fiscal-configuration/FiscalProductListPanel'
import { FiscalProductGroupFormModal } from '@/components/fiscal-configuration/FiscalProductGroupFormModal'
import { FiscalProductGroupManageModal } from '@/components/fiscal-configuration/FiscalProductGroupManageModal'
import { ProductFiscalRegistrationPanel } from '@/components/fiscal-configuration/ProductFiscalRegistrationPanel'
import { FISCAL_GROUP_CREATE_OPTION } from '@/lib/fiscalConfiguration/fiscalGroupUi'
import type { FiscalProductGroup } from '@/lib/fiscalConfiguration/types'
import { hasRole } from '@/lib/auth-roles'
import { FISCAL_STATUS_FILTER_OPTIONS } from '@/lib/fiscalConfiguration/labels'
import { saveProductScenarioDraft } from '@/lib/fiscalConfiguration/saveProductScenarioDraft'
import { readCatalogNcmCest } from '@/lib/fiscalConfiguration/ruleFormMapper'
import {
  emptyCommercialProductForm,
  useAccountantFiscalProducts,
  useProductFiscalConfiguration,
} from '@/hooks/useAccountantFiscalProducts'
import { useProductFiscalScenarios } from '@/hooks/useProductFiscalScenarios'
import { useAuthStore } from '@/store/authStore'
import { useAppToastStore } from '@/store/appToastStore'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  onBack: () => void
}

export default function AccountantFiscalProductsScreen({ onBack }: Props) {
  const { theme } = useMfTheme()
  const { width } = useWindowDimensions()
  const isDesktop = width >= 900
  const { role, empresaId: authEmpresaId, isImpersonating } = useAuthStore()
  const showToast = useAppToastStore((s) => s.show)

  const canAccess = hasRole(role, ['admin', 'superadmin'])

  const list = useAccountantFiscalProducts({ role })

  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [productSavedInFlow, setProductSavedInFlow] = useState(false)
  const [configEstablishmentId, setConfigEstablishmentId] = useState('')
  const [registrationEstablishmentId, setRegistrationEstablishmentId] = useState('')
  const [registrationProductId, setRegistrationProductId] = useState<string | null>(null)
  const [scenarioSaving, setScenarioSaving] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [bulkGroupId, setBulkGroupId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [manageGroupsOpen, setManageGroupsOpen] = useState(false)
  const [groupFormOpen, setGroupFormOpen] = useState(false)
  const [groupFormMode, setGroupFormMode] = useState<'create' | 'edit'>('create')
  const [editingGroup, setEditingGroup] = useState<FiscalProductGroup | null>(null)
  const [groupFormSaving, setGroupFormSaving] = useState(false)
  const [pendingGroupSelectPatch, setPendingGroupSelectPatch] = useState<((v: string) => void) | null>(null)

  const persistProductGroupMembership = useCallback(async (productId: string, nextGroupId: string) => {
    if (!list.selectedClientId) return
    await list.persistProductGroupMembership(productId, nextGroupId, list.productGroupMap)
  }, [list])

  const issuerUf = list.establishments.find((e) => e.establishmentId === (configEstablishmentId || registrationEstablishmentId))?.issuerUf ?? 'RJ'
  const scenarios = useProductFiscalScenarios(issuerUf)

  const config = useProductFiscalConfiguration({
    clientEmpresaId: list.selectedClientId,
    productId: activeProductId,
    establishmentId: configEstablishmentId,
    rules: list.rules,
    groups: list.groups,
    productGroupMap: list.productGroupMap,
    catalog: list.catalog,
    canEdit: canAccess,
    onSaved: async () => {
      showToast('Configuração fiscal salva.', 'success')
      await list.reload()
    },
    onCommercialSaved: () => {
      showToast('Produto atualizado.', 'success')
      void list.reload()
    },
    persistProductGroupMembership,
  })

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.background },
        content: { padding: mfSpacing.lg, gap: mfSpacing.lg, maxWidth: 1200, width: '100%', alignSelf: 'center' },
        title: { ...mfTypography.title, color: theme.text },
        lead: { ...mfTypography.body, color: theme.textSecondary },
        filters: {
          flexDirection: isDesktop ? 'row' : 'column',
          gap: mfSpacing.md,
          alignItems: isDesktop ? 'flex-end' : 'stretch',
        },
        searchWrap: {
          flex: 1,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.sm,
          backgroundColor: theme.surface,
        },
        searchInput: { flex: 1, ...mfTypography.body, color: theme.text },
        filterCol: { minWidth: isDesktop ? 180 : undefined },
        stateBox: {
          padding: mfSpacing.xl,
          borderRadius: mfRadius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          alignItems: 'center',
          gap: mfSpacing.md,
        },
        stateText: { ...mfTypography.body, color: theme.textSecondary, textAlign: 'center' },
        readiness: { ...mfTypography.caption, color: theme.textSecondary },
        newProductCard: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.lg,
          padding: mfSpacing.lg,
          gap: mfSpacing.md,
          backgroundColor: theme.surface,
        },
        sectionTitle: { ...mfTypography.subtitle, color: theme.text },
        rowActions: { flexDirection: 'row', gap: mfSpacing.sm, flexWrap: 'wrap' },
        primaryBtn: {
          backgroundColor: theme.primary,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.xs,
        },
        primaryBtnDisabled: {
          backgroundColor: theme.border,
          opacity: 0.7,
        },
        primaryBtnText: { ...mfTypography.body, color: '#fff', fontWeight: '700' },
        field: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm,
          ...mfTypography.body,
          color: theme.text,
          backgroundColor: theme.surface,
        },
        fieldLabel: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
      }),
    [isDesktop, theme],
  )

  const clientOptions = useMemo(
    () => list.clients.map((client) => ({
      clientKey: client.clientKey ?? client.empresaId,
      label: client.label ?? client.razaoSocial ?? client.nomeFantasia ?? client.empresaId,
    })),
    [list.clients],
  )

  const clientLabel = list.selectedClient
    ? (list.selectedClient.label ?? list.selectedClient.razaoSocial ?? list.selectedClient.nomeFantasia)
    : null

  const canCreateProduct = Boolean(list.selectedClientId) && list.loadState !== 'loading'

  useEffect(() => {
    if (list.selectedClientKey || list.clients.length === 0) return
    if (!isImpersonating || !authEmpresaId) return
    const match = list.clients.find((client) => client.empresaId === authEmpresaId)
    if (match) {
      list.selectClient(match.clientKey ?? match.empresaId)
    }
  }, [authEmpresaId, isImpersonating, list.clients, list.selectedClientKey, list.selectClient])

  const resetClientScopedUi = () => {
    setActiveProductId(null)
    setProductSavedInFlow(false)
    setConfigEstablishmentId('')
    setRegistrationEstablishmentId('')
    setRegistrationProductId(null)
    setScenarioSaving(false)
    setSelectedProductIds([])
    setBulkGroupId('')
    setManageGroupsOpen(false)
    setGroupFormOpen(false)
    setEditingGroup(null)
    scenarios.resetScenarios()
    config.reset()
  }

  const openCreateGroupForm = (selectPatch?: (v: string) => void) => {
    setGroupFormMode('create')
    setEditingGroup(null)
    setPendingGroupSelectPatch(selectPatch ?? null)
    setGroupFormOpen(true)
  }

  const openEditGroupForm = (group: FiscalProductGroup) => {
    setGroupFormMode('edit')
    setEditingGroup(group)
    setPendingGroupSelectPatch(null)
    setGroupFormOpen(true)
    setManageGroupsOpen(false)
  }

  const handleSubmitGroupForm = async (input: { name: string; description: string }) => {
    setGroupFormSaving(true)
    try {
      if (groupFormMode === 'edit' && editingGroup) {
        await list.updateGroup(editingGroup.id, {
          name: input.name,
          description: input.description || null,
        })
        showToast('Grupo fiscal atualizado.', 'success')
      } else {
        const created = await list.createGroup({
          name: input.name,
          description: input.description || undefined,
        })
        showToast('Grupo fiscal criado.', 'success')
        if (pendingGroupSelectPatch) {
          pendingGroupSelectPatch(created.id)
          setPendingGroupSelectPatch(null)
        } else if (list.creatingProduct) {
          list.setCommercialForm((prev) => ({ ...prev, fiscalProductGroupId: created.id }))
        } else if (config.open && config.commercialForm) {
          config.patchCommercial({ fiscalProductGroupId: created.id })
        }
      }
      setGroupFormOpen(false)
      setEditingGroup(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao salvar grupo.', 'error')
    } finally {
      setGroupFormSaving(false)
    }
  }

  const handleGroupFieldChange = (value: string, patch: (v: string) => void) => {
    if (value === FISCAL_GROUP_CREATE_OPTION) {
      openCreateGroupForm(patch)
      return
    }
    patch(value)
  }

  const handleBulkAssign = async () => {
    if (!bulkGroupId || selectedProductIds.length === 0) return
    setBulkAssigning(true)
    try {
      await list.bulkAssignProductsToGroup(selectedProductIds, bulkGroupId)
      showToast('Grupo atribuído aos produtos selecionados.', 'success')
      setSelectedProductIds([])
      setBulkGroupId('')
      await list.reload()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha na atribuição em lote.', 'error')
    } finally {
      setBulkAssigning(false)
    }
  }

  const bulkGroupOptions = useMemo(
    () => [{ value: '', label: 'Selecione um grupo…' }, ...buildBulkGroupOptions(list.groups)],
    [list.groups],
  )

  const groupFieldHandlers = {
    groupProductCounts: list.groupProductCounts,
    onManageGroups: () => setManageGroupsOpen(true),
    onCreateGroupRequest: () => openCreateGroupForm(),
    onGroupFieldChange: handleGroupFieldChange,
  }

  const groupFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Todos os grupos' },
      ...list.groups.map((g) => ({ value: g.id, label: g.name })),
    ],
    [list.groups],
  )

  const handleStartNewProduct = () => {
    if (!list.selectedClientId) return
    list.setCreatingProduct(true)
    list.setCommercialForm(emptyCommercialProductForm())
    setProductSavedInFlow(false)
    setRegistrationEstablishmentId('')
    setRegistrationProductId(null)
    setScenarioSaving(false)
    scenarios.resetScenarios()
    scenarios.addScenario()
  }

  const handleCancelNewProduct = () => {
    list.setCreatingProduct(false)
    setProductSavedInFlow(false)
    setRegistrationEstablishmentId('')
    setRegistrationProductId(null)
    setScenarioSaving(false)
    scenarios.resetScenarios()
  }

  const handleSaveNewProduct = async () => {
    if (!list.commercialForm.discriminacao.trim()) {
      showToast('Descrição é obrigatória.', 'error')
      return
    }
    try {
      const result = await list.saveCommercialProduct(registrationProductId, { keepOpen: true })
      const productId = result?.productId ?? registrationProductId
      if (productId) setRegistrationProductId(productId)
      setProductSavedInFlow(true)
      showToast('Produto salvo. Configure os cenários fiscais abaixo.', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao criar produto.', 'error')
    }
  }

  const handleSaveScenarioDraft = async () => {
    if (!list.selectedClientId) {
      showToast('Selecione um cliente.', 'error')
      return
    }
    if (!registrationProductId) {
      showToast('Salve os dados comerciais do produto antes do cenário fiscal.', 'error')
      return
    }
    if (!registrationEstablishmentId) {
      showToast('Selecione o estabelecimento fiscal (CNPJ).', 'error')
      return
    }
    if (list.establishmentStatus !== 'OK') {
      showToast('Cliente sem estabelecimento fiscal configurado.', 'error')
      return
    }

    const activeScenario = scenarios.activeScenario
    if (!activeScenario) {
      showToast('Selecione ou adicione um cenário fiscal.', 'error')
      return
    }

    const catalogProduct = list.catalog.find((p) => p.id === registrationProductId) ?? null
    const existingRule = activeScenario.ruleId
      ? list.rules.find((rule) => rule.id === activeScenario.ruleId) ?? null
      : null

    const form = {
      ...activeScenario.form,
      origemMercadoria: scenarios.merchandiseFacts.origemMercadoria,
      itemSource: scenarios.merchandiseFacts.itemSource,
      priorStStatus: scenarios.merchandiseFacts.priorStStatus,
    }

    setScenarioSaving(true)
    try {
      const { rule, uiStatus } = await saveProductScenarioDraft({
        clientEmpresaId: list.selectedClientId,
        productId: registrationProductId,
        establishmentId: registrationEstablishmentId,
        form,
        catalogMetadata: catalogProduct?.metadata_json ?? {
          ncm: list.commercialForm.ncm.replace(/\D/g, ''),
          cest: list.commercialForm.cest.replace(/\D/g, ''),
        },
        existingRule,
        fiscalProductGroupId: list.commercialForm.fiscalProductGroupId,
        persistProductGroupMembership: async (productId, groupId) => {
          await list.persistProductGroupMembership(productId, groupId, list.productGroupMap)
        },
      })

      scenarios.markScenarioSaved(activeScenario.id, {
        ruleId: rule.id ?? '',
        uiStatus,
      })
      showToast('Rascunho do cenário salvo.', 'success')
      await list.reload()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao salvar rascunho do cenário.', 'error')
    } finally {
      setScenarioSaving(false)
    }
  }

  const handleSelectClient = (clientKey: string) => {
    if (clientKey === list.selectedClientKey) return
    resetClientScopedUi()
    list.selectClient(clientKey)
  }

  const handleConfigure = async (productId: string) => {
    if (!list.selectedClientId) {
      showToast('Selecione um cliente antes de configurar o produto.', 'error')
      return
    }
    setActiveProductId(productId)
    const establishmentForConfig = list.establishmentId || configEstablishmentId
    setConfigEstablishmentId(establishmentForConfig)
    if (establishmentForConfig) {
      list.setEstablishmentId(establishmentForConfig)
    }
    try {
      await config.openProduct(productId, establishmentForConfig)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Falha ao abrir configuração.',
        'error',
      )
    }
  }

  const handleListEstablishmentChange = (nextId: string) => {
    list.setEstablishmentId(nextId)
    setConfigEstablishmentId(nextId)
    if (activeProductId) {
      void config.loadFiscalForEstablishment(activeProductId, nextId).catch((error) => {
        showToast(
          error instanceof Error ? error.message : 'Falha ao carregar configuração fiscal.',
          'error',
        )
      })
    }
  }

  const handleConfigEstablishmentChange = (nextId: string) => {
    setConfigEstablishmentId(nextId)
    list.setEstablishmentId(nextId)
    if (activeProductId) {
      void config.loadFiscalForEstablishment(activeProductId, nextId).catch((error) => {
        showToast(
          error instanceof Error ? error.message : 'Falha ao carregar configuração fiscal.',
          'error',
        )
      })
    }
  }

  const activeRow = list.rows.find((r) => r.productId === activeProductId)
  const meta = readCatalogNcmCest(config.catalogItem?.metadata_json)

  if (!canAccess) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Produtos fiscais</Text>
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Acesso restrito a contadores e administradores fiscais.</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <MfScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar" style={{ alignSelf: 'flex-start' }}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Produtos e Configuração Fiscal</Text>
          <Text style={styles.lead}>
            Selecione o emissor (CNPJ com CRT), cadastre produtos comerciais e configure o tratamento fiscal.
          </Text>
          {list.readiness?.readiness ? (
            <Text style={styles.readiness}>
              Prontidão geral (backend): {list.readiness.readiness}
            </Text>
          ) : null}
        </View>

        <AccountantClientSelectField
          clients={clientOptions}
          selectedClientKey={list.selectedClientKey}
          onSelectClient={handleSelectClient}
          disabled={list.clientsLoadState === 'loading'}
        />

        {list.clientsLoadState === 'error' ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{list.errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.primaryBtn, !canCreateProduct ? styles.primaryBtnDisabled : null]}
            onPress={handleStartNewProduct}
            disabled={!canCreateProduct}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCreateProduct }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Novo produto</Text>
          </TouchableOpacity>
        </View>

        {!list.selectedClientId ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              Selecione um cliente para visualizar e cadastrar produtos.
            </Text>
          </View>
        ) : list.loadState === 'loading' ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.stateText}>Carregando produtos…</Text>
          </View>
        ) : list.loadState === 'forbidden' ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{list.errorMessage}</Text>
          </View>
        ) : list.loadState === 'error' ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{list.errorMessage}</Text>
            <TouchableOpacity onPress={() => void list.reload()}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {list.creatingProduct ? (
              <ProductFiscalRegistrationPanel
                clientLabel={clientLabel}
                establishments={list.establishments}
                establishmentId={registrationEstablishmentId || null}
                establishmentStatus={list.establishmentStatus}
                onEstablishmentChange={setRegistrationEstablishmentId}
                commercialForm={list.commercialForm}
                onCommercialChange={(patch) => list.setCommercialForm((prev) => ({ ...prev, ...patch }))}
                merchandiseFacts={scenarios.merchandiseFacts}
                onMerchandiseChange={(patch) => scenarios.setMerchandiseFacts((prev) => ({ ...prev, ...patch }))}
                scenarios={scenarios.scenarios}
                activeScenarioId={scenarios.activeScenarioId}
                onSelectScenario={scenarios.setActiveScenarioId}
                onAddScenario={(kind) => scenarios.addScenario(kind ? { scenarioApplies: kind } : undefined)}
                onRemoveScenario={scenarios.removeScenario}
                onUpdateScenario={scenarios.updateScenarioForm}
                groups={list.groups}
                rules={list.rules}
                {...groupFieldHandlers}
                canEdit={canAccess}
                fiscalSectionsEnabled={productSavedInFlow}
                saving={scenarioSaving}
                onSaveProduct={() => void handleSaveNewProduct()}
                onSaveScenarioDraft={() => void handleSaveScenarioDraft()}
                onCancel={handleCancelNewProduct}
              />
            ) : null}

            <View style={styles.filters}>
              {list.establishmentStatus === 'OK' && list.establishments.length > 0 ? (
                <View style={styles.filterCol}>
                  <FiscalEstablishmentSelectField
                    establishments={list.establishments}
                    selectedEstablishmentId={list.establishmentId || null}
                    onSelectEstablishment={handleListEstablishmentChange}
                    establishmentStatus={list.establishmentStatus}
                    clientLabel={clientLabel}
                  />
                </View>
              ) : null}
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  value={list.search}
                  onChangeText={list.setSearch}
                  placeholder="Buscar produto, código ou NCM…"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.filterCol}>
                <FiscalConfigSelectField
                  label="Status fiscal"
                  value={list.statusFilter}
                  options={FISCAL_STATUS_FILTER_OPTIONS}
                  onChange={list.setStatusFilter}
                />
              </View>
              <View style={styles.filterCol}>
                <FiscalConfigSelectField
                  label="Grupo fiscal"
                  value={list.groupFilter}
                  options={groupFilterOptions}
                  onChange={list.setGroupFilter}
                />
              </View>
            </View>

            <FiscalProductListPanel
              rows={list.rows}
              onConfigure={handleConfigure}
              selectionEnabled={canAccess && list.groups.some((g) => g.status === 'ACTIVE')}
              selectedProductIds={selectedProductIds}
              onToggleSelect={(productId) => {
                setSelectedProductIds((prev) =>
                  prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
                )
              }}
              onToggleSelectAll={() => {
                setSelectedProductIds((prev) =>
                  prev.length === list.rows.length ? [] : list.rows.map((r) => r.productId),
                )
              }}
              bulkGroupId={bulkGroupId}
              onBulkGroupChange={setBulkGroupId}
              bulkGroupOptions={bulkGroupOptions}
              onBulkAssign={() => void handleBulkAssign()}
              bulkAssigning={bulkAssigning}
              emptyMessage={
                list.catalog.length === 0
                  ? 'Este cliente ainda não possui produtos cadastrados.'
                  : 'Nenhum produto corresponde aos filtros.'
              }
            />
          </>
        )}
      </MfScrollView>

      <FiscalProductConfigDrawer
        visible={config.open}
        productLabel={activeRow?.descricao ?? config.catalogItem?.discriminacao ?? 'Produto'}
        clientLabel={clientLabel}
        establishments={list.establishments}
        establishmentId={configEstablishmentId || null}
        establishmentStatus={list.establishmentStatus}
        onEstablishmentChange={handleConfigEstablishmentChange}
        catalogCodigo={activeRow?.codigo ?? config.catalogItem?.codigo ?? ''}
        catalogNcm={activeRow?.ncm ?? meta.ncm}
        catalogCest={activeRow?.cest ?? meta.cest}
        catalogUnidade={activeRow?.unidade ?? meta.unidade}
        fiscalStatus={config.fiscalStatus}
        form={config.form}
        onChange={config.patchForm}
        commercialForm={config.commercialForm}
        onCommercialChange={config.patchCommercial}
        onSaveCommercial={() => {
          void config.saveCommercial().catch((error) => {
            showToast(error instanceof Error ? error.message : 'Falha ao salvar produto.', 'error')
          })
        }}
        rule={config.rule}
        preview={config.preview}
        groups={list.groups}
        rules={list.rules}
        productId={activeProductId}
        {...groupFieldHandlers}
        canEdit={canAccess}
        canApprove={canAccess}
        saving={config.saving}
        loading={config.loading}
        onClose={() => {
          config.setOpen(false)
          setConfigEstablishmentId(list.establishmentId || '')
        }}
        onSaveDraft={() => {
          void config.saveDraft().catch((error) => {
            showToast(
              error instanceof Error ? error.message : 'Falha ao salvar rascunho.',
              'error',
            )
          })
        }}
        onApprove={(justification) => {
          void config.approve(justification).catch((error) => {
            showToast(
              error instanceof Error ? error.message : 'Falha ao aprovar configuração.',
              'error',
            )
          })
        }}
        onNewVersion={() => {
          void config.newVersion().catch((error) => {
            showToast(
              error instanceof Error ? error.message : 'Falha ao criar nova versão.',
              'error',
            )
          })
        }}
      />

      <FiscalProductGroupManageModal
        visible={manageGroupsOpen}
        groups={list.groups}
        groupProductCounts={list.groupProductCounts}
        onClose={() => setManageGroupsOpen(false)}
        onEditGroup={openEditGroupForm}
        onCreateGroup={() => openCreateGroupForm()}
      />

      <FiscalProductGroupFormModal
        visible={groupFormOpen}
        mode={groupFormMode}
        initialName={editingGroup?.name ?? ''}
        initialDescription={editingGroup?.description ?? ''}
        saving={groupFormSaving}
        onCancel={() => {
          setGroupFormOpen(false)
          setEditingGroup(null)
          setPendingGroupSelectPatch(null)
        }}
        onSubmit={(input) => void handleSubmitGroupForm(input)}
      />
    </SafeAreaView>
  )
}
