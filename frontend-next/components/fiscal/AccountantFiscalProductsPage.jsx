'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { hasRole } from '@/lib/authRoles';
import {
  emptyCommercialProductForm,
  useAccountantFiscalProducts,
  useProductFiscalConfiguration,
} from '@/hooks/useAccountantFiscalProducts';
import { useProductFiscalScenarios } from '@/hooks/useProductFiscalScenarios';
import { saveProductScenarioDraft } from '@/lib/fiscalConfiguration/saveProductScenarioDraft';
import { labelFiscalStatus, FISCAL_STATUS_FILTER_OPTIONS, SCENARIO_APPLIES_OPTIONS, PIS_COFINS_MODE_OPTIONS, CURRENT_OPERATION_ST_OPTIONS, ORIGEM_MERCADORIA_OPTIONS, ITEM_SOURCE_OPTIONS, PRIOR_ST_STATUS_OPTIONS } from '@/lib/fiscalConfiguration/labels';
import { deriveIcmsGroupFromCsosn } from '@/lib/fiscalConfiguration/ruleFormMapper';
import { Card } from '@/components/ui/Card';
import { AppSelect } from '@/components/ui/AppSelect';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

function Field({ label, children }) {
  return (
    <label className="block text-xs text-[var(--text-muted)]">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function inputClass() {
  return 'h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm';
}

export default function AccountantFiscalProductsPage() {
  const { role } = useAuth();
  const canAccess = hasRole(role, ['admin', 'superadmin']);
  const list = useAccountantFiscalProducts({ role });

  const [registrationEstablishmentId, setRegistrationEstablishmentId] = useState('');
  const [registrationProductId, setRegistrationProductId] = useState(null);
  const [productSavedInFlow, setProductSavedInFlow] = useState(false);
  const [scenarioSaving, setScenarioSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const clientLabel = list.selectedClient?.label
    || list.selectedClient?.nomeFantasia
    || list.selectedClient?.razaoSocial
    || null;

  const issuerUf = list.establishments.find(
    (e) => e.establishmentId === (registrationEstablishmentId || list.establishmentId),
  )?.issuerUf ?? 'RJ';

  const scenarios = useProductFiscalScenarios(issuerUf);

  const [configProductId, setConfigProductId] = useState(null);
  const [configEstablishmentId, setConfigEstablishmentId] = useState('');

  const config = useProductFiscalConfiguration({
    clientEmpresaId: list.selectedClientId,
    productId: configProductId,
    establishmentId: configEstablishmentId || list.establishmentId,
    rules: list.rules,
    groups: list.groups,
    productGroupMap: list.productGroupMap,
    catalog: list.catalog,
    canEdit: canAccess,
    onSaved: async () => {
      setToast({ type: 'success', text: 'Configuração fiscal salva.' });
      await list.reload();
    },
    onCommercialSaved: () => {
      setToast({ type: 'success', text: 'Produto atualizado.' });
      void list.reload();
    },
    persistProductGroupMembership: async (productId, groupId) => {
      await list.persistProductGroupMembership(productId, groupId, list.productGroupMap);
    },
  });

  const clientOptions = useMemo(
    () => list.clients.map((c) => ({
      value: c.clientKey ?? c.empresaId,
      label: c.label || c.nomeFantasia || c.razaoSocial || c.cpfCnpj || c.empresaId,
    })),
    [list.clients],
  );

  const groupFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Todos os grupos' },
      ...list.groups.map((g) => ({ value: g.id, label: g.name })),
    ],
    [list.groups],
  );

  const handleStartNewProduct = () => {
    if (!list.selectedClientId) return;
    list.setCreatingProduct(true);
    list.setCommercialForm(emptyCommercialProductForm());
    setProductSavedInFlow(false);
    setRegistrationEstablishmentId('');
    setRegistrationProductId(null);
    scenarios.resetScenarios();
    scenarios.addScenario();
  };

  const handleSaveNewProduct = async () => {
    if (!list.commercialForm.discriminacao.trim()) {
      setToast({ type: 'error', text: 'Descrição é obrigatória.' });
      return;
    }
    try {
      const result = await list.saveCommercialProduct(registrationProductId, { keepOpen: true });
      const productId = result?.productId ?? registrationProductId;
      if (productId) setRegistrationProductId(productId);
      setProductSavedInFlow(true);
      setToast({ type: 'success', text: 'Produto salvo. Configure os cenários fiscais abaixo.' });
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao criar produto.' });
    }
  };

  const handleSaveScenarioDraft = async () => {
    if (!list.selectedClientId || !registrationProductId || !registrationEstablishmentId) {
      setToast({ type: 'error', text: 'Salve o produto e selecione o estabelecimento fiscal.' });
      return;
    }
    const activeScenario = scenarios.activeScenario;
    if (!activeScenario) {
      setToast({ type: 'error', text: 'Adicione um cenário fiscal.' });
      return;
    }
    const catalogProduct = list.catalog.find((p) => p.id === registrationProductId) ?? null;
    const existingRule = activeScenario.ruleId
      ? list.rules.find((r) => r.id === activeScenario.ruleId) ?? null
      : null;
    const form = {
      ...activeScenario.form,
      origemMercadoria: scenarios.merchandiseFacts.origemMercadoria,
      itemSource: scenarios.merchandiseFacts.itemSource,
      priorStStatus: scenarios.merchandiseFacts.priorStStatus,
    };
    setScenarioSaving(true);
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
          await list.persistProductGroupMembership(productId, groupId, list.productGroupMap);
        },
      });
      scenarios.markScenarioSaved(activeScenario.id, { ruleId: rule.id ?? '', uiStatus });
      setToast({ type: 'success', text: 'Cenário fiscal salvo como rascunho.' });
      await list.reload();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao salvar cenário.' });
    } finally {
      setScenarioSaving(false);
    }
  };

  const openConfigure = useCallback(async (productId) => {
    setConfigProductId(productId);
    setConfigEstablishmentId(list.establishmentId || '');
    await config.openProduct(productId, list.establishmentId || undefined);
  }, [config, list.establishmentId]);

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/minha-conta" className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Card className="mt-4 p-6">
          <EmptyPanel title="Acesso restrito" description="Somente administradores podem configurar produtos fiscais." />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-8">
      <Link href="/minha-conta" className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
        <ArrowLeft className="h-4 w-4" /> Voltar às configurações
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Produtos e configuração fiscal</h1>
        <p className="text-sm text-[var(--text-muted)]">Tratamento fiscal aprovado por CNPJ — mesma rota do app (grade fiscal / cenários)</p>
      </header>

      {toast ? (
        <div className={`rounded-[12px] border p-3 text-sm ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {toast.text}
        </div>
      ) : null}

      <Card className="space-y-4 p-4 sm:p-5">
        <AppSelect
          label="Cliente (CNPJ)"
          value={list.selectedClientKey ?? ''}
          onChange={(key) => list.selectClient(key || null)}
          options={clientOptions}
          placeholder="Selecione o cliente…"
        />

        {list.clientsLoadState === 'loading' ? <LoadingPanel label="Carregando clientes…" /> : null}
        {list.clientsLoadState === 'error' ? <ErrorPanel message={list.errorMessage} onRetry={() => void list.loadClients()} /> : null}

        {list.selectedClientId ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleStartNewProduct}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Novo produto
            </button>
          </div>
        ) : null}

        {list.creatingProduct ? (
          <div className="space-y-4 rounded-[16px] border border-[var(--card-border)] p-4">
            <h2 className="text-base font-semibold">Cadastro comercial</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Descrição *">
                <input className={inputClass()} value={list.commercialForm.discriminacao} onChange={(e) => list.setCommercialForm((p) => ({ ...p, discriminacao: e.target.value }))} />
              </Field>
              <Field label="Código">
                <input className={inputClass()} value={list.commercialForm.codigo} onChange={(e) => list.setCommercialForm((p) => ({ ...p, codigo: e.target.value }))} />
              </Field>
              <Field label="NCM">
                <input className={inputClass()} value={list.commercialForm.ncm} onChange={(e) => list.setCommercialForm((p) => ({ ...p, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) }))} />
              </Field>
              <Field label="CEST">
                <input className={inputClass()} value={list.commercialForm.cest} onChange={(e) => list.setCommercialForm((p) => ({ ...p, cest: e.target.value.replace(/\D/g, '') }))} />
              </Field>
              <Field label="Unidade">
                <input className={inputClass()} value={list.commercialForm.unidade} onChange={(e) => list.setCommercialForm((p) => ({ ...p, unidade: e.target.value }))} />
              </Field>
              <Field label="Grupo fiscal">
                <AppSelect
                  value={list.commercialForm.fiscalProductGroupId}
                  onChange={(v) => list.setCommercialForm((p) => ({ ...p, fiscalProductGroupId: v }))}
                  options={[{ value: '', label: 'Sem grupo' }, ...list.groups.map((g) => ({ value: g.id, label: g.name }))]}
                />
              </Field>
            </div>
            <button type="button" onClick={() => void handleSaveNewProduct()} className="rounded-[12px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              Salvar dados comerciais
            </button>

            {productSavedInFlow ? (
              <div className="space-y-3 border-t border-[var(--card-border)] pt-4">
                <h3 className="text-sm font-semibold">Grade fiscal — cenários</h3>
                <AppSelect
                  label="Estabelecimento (CNPJ emissor)"
                  value={registrationEstablishmentId}
                  onChange={setRegistrationEstablishmentId}
                  options={list.establishments.map((e) => ({ value: e.establishmentId, label: e.label }))}
                />
                <div className="flex flex-wrap gap-2">
                  {scenarios.scenarios.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => scenarios.setActiveScenarioId(s.id)}
                      className={`rounded-full px-3 py-1 text-xs ${scenarios.activeScenarioId === s.id ? 'bg-[var(--accent)] text-white' : 'border border-[var(--card-border)]'}`}
                    >
                      {s.name}
                    </button>
                  ))}
                  <button type="button" onClick={() => scenarios.addScenario()} className="rounded-full border px-3 py-1 text-xs">+ Cenário</button>
                </div>
                {scenarios.activeScenario ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AppSelect label="Aplicação" value={scenarios.activeScenario.form.scenarioApplies} onChange={(v) => scenarios.updateScenarioForm(scenarios.activeScenario.id, { scenarioApplies: v, operationScope: v === 'INTERNAL' ? 'INTERNAL' : v === 'FOREIGN' ? 'FOREIGN' : 'INTERSTATE' })} options={SCENARIO_APPLIES_OPTIONS} />
                    <Field label="CFOP">
                      <input className={inputClass()} value={scenarios.activeScenario.form.cfop} onChange={(e) => scenarios.updateScenarioForm(scenarios.activeScenario.id, { cfop: e.target.value })} />
                    </Field>
                    <Field label="CSOSN">
                      <input className={inputClass()} value={scenarios.activeScenario.form.csosn} onChange={(e) => scenarios.updateScenarioForm(scenarios.activeScenario.id, { csosn: e.target.value, icmsGroup: deriveIcmsGroupFromCsosn(e.target.value) })} />
                    </Field>
                    <AppSelect label="ST nesta operação" value={scenarios.activeScenario.form.currentOperationSt} onChange={(v) => scenarios.updateScenarioForm(scenarios.activeScenario.id, { currentOperationSt: v })} options={CURRENT_OPERATION_ST_OPTIONS} />
                    <AppSelect label="PIS modo" value={scenarios.activeScenario.form.pisCalculationMode} onChange={(v) => scenarios.updateScenarioForm(scenarios.activeScenario.id, { pisCalculationMode: v })} options={PIS_COFINS_MODE_OPTIONS} />
                    <AppSelect label="COFINS modo" value={scenarios.activeScenario.form.cofinsCalculationMode} onChange={(v) => scenarios.updateScenarioForm(scenarios.activeScenario.id, { cofinsCalculationMode: v })} options={PIS_COFINS_MODE_OPTIONS} />
                    <AppSelect label="Origem mercadoria" value={scenarios.merchandiseFacts.origemMercadoria} onChange={(v) => scenarios.setMerchandiseFacts((p) => ({ ...p, origemMercadoria: v }))} options={ORIGEM_MERCADORIA_OPTIONS} />
                    <AppSelect label="Fonte item" value={scenarios.merchandiseFacts.itemSource} onChange={(v) => scenarios.setMerchandiseFacts((p) => ({ ...p, itemSource: v }))} options={ITEM_SOURCE_OPTIONS} />
                    <AppSelect label="ST anterior" value={scenarios.merchandiseFacts.priorStStatus} onChange={(v) => scenarios.setMerchandiseFacts((p) => ({ ...p, priorStStatus: v }))} options={PRIOR_ST_STATUS_OPTIONS} />
                  </div>
                ) : null}
                <button type="button" disabled={scenarioSaving} onClick={() => void handleSaveScenarioDraft()} className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
                  {scenarioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar rascunho do cenário
                </button>
                <button type="button" onClick={() => { list.setCreatingProduct(false); scenarios.resetScenarios(); }} className="ml-2 text-sm text-[var(--text-muted)] underline">
                  Cancelar
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {list.selectedClientId && list.loadState === 'loading' ? <LoadingPanel label="Carregando produtos…" /> : null}
        {list.loadState === 'error' ? <ErrorPanel message={list.errorMessage} onRetry={() => void list.reload()} /> : null}

        {list.selectedClientId && list.loadState === 'ready' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {list.establishments.length > 0 ? (
                <AppSelect label="Estabelecimento (lista)" value={list.establishmentId} onChange={list.setEstablishmentId} options={list.establishments.map((e) => ({ value: e.establishmentId, label: e.label }))} />
              ) : null}
              <label className="flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] px-3 sm:col-span-2">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input className="w-full bg-transparent text-sm outline-none" placeholder="Buscar produto, código ou NCM…" value={list.search} onChange={(e) => list.setSearch(e.target.value)} />
              </label>
              <AppSelect label="Status fiscal" value={list.statusFilter} onChange={list.setStatusFilter} options={FISCAL_STATUS_FILTER_OPTIONS} />
              <AppSelect label="Grupo fiscal" value={list.groupFilter} onChange={list.setGroupFilter} options={groupFilterOptions} />
            </div>

            {list.rows.length === 0 ? (
              <EmptyPanel title="Nenhum produto" description={list.catalog.length === 0 ? 'Use Novo produto para cadastrar com a grade fiscal.' : 'Nenhum item corresponde aos filtros.'} />
            ) : (
              <ul className="divide-y divide-[var(--card-border)] rounded-[12px] border border-[var(--card-border)]">
                {list.rows.map((row) => (
                  <li key={row.productId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{row.descricao}</p>
                      <p className="text-xs text-[var(--text-muted)]">{row.codigo} · NCM {row.ncm || '—'} · {labelFiscalStatus(row.fiscalStatus)}</p>
                    </div>
                    <button type="button" onClick={() => void openConfigure(row.productId)} className="rounded-[10px] bg-[var(--canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
                      Configurar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </Card>

      {config.open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5">
            <h2 className="text-lg font-semibold">Configurar — {clientLabel}</h2>
            <p className="text-xs text-[var(--text-muted)]">Status: {labelFiscalStatus(config.fiscalStatus)}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="CFOP"><input className={inputClass()} value={config.form.cfop} onChange={(e) => config.patchForm({ cfop: e.target.value })} /></Field>
              <Field label="CSOSN"><input className={inputClass()} value={config.form.csosn} onChange={(e) => config.patchForm({ csosn: e.target.value, icmsGroup: deriveIcmsGroupFromCsosn(e.target.value) })} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={config.saving} onClick={() => void config.saveDraft().catch((e) => setToast({ type: 'error', text: e.message }))} className="rounded-[12px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Salvar rascunho</button>
              <button type="button" disabled={config.saving} onClick={() => void config.approve().catch((e) => setToast({ type: 'error', text: e.message }))} className="rounded-[12px] border px-4 py-2 text-sm font-semibold">Aprovar regra</button>
              <button type="button" onClick={() => config.setOpen(false)} className="text-sm text-[var(--text-muted)] underline">Fechar</button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
