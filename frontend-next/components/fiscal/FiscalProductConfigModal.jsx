'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { AppSelect } from '@/components/ui/AppSelect';
import { ScenarioApplicationFields } from '@/components/fiscal/ScenarioApplicationFields';
import {
  CURRENT_OPERATION_ST_OPTIONS,
  ITEM_SOURCE_OPTIONS,
  ORIGEM_MERCADORIA_OPTIONS,
  PIS_COFINS_MODE_OPTIONS,
  PRIOR_ST_STATUS_OPTIONS,
  formatCapabilityMessage,
  labelFiscalStatus,
  labelRuleStatus,
} from '@/lib/fiscalConfiguration/labels';
import {
  deriveIcmsGroupFromCsosn,
  displayIcmsGroupForForm,
  shouldShowStFields,
} from '@/lib/fiscalConfiguration/ruleFormMapper';

function Field({ label, children, hint }) {
  return (
    <label className="block text-xs text-[var(--text-muted)]">
      {label}
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</p> : null}
    </label>
  );
}

function inputClass() {
  return 'h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm disabled:opacity-60';
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      {children}
    </section>
  );
}

function MetaChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[11px]">
      <span className="font-semibold text-[var(--text-muted)]">{label}</span>
      <span>{value}</span>
    </span>
  );
}

export function FiscalProductConfigModal({
  open,
  productLabel,
  clientLabel,
  establishments = [],
  establishmentId,
  establishmentStatus,
  onEstablishmentChange,
  catalogCodigo,
  catalogNcm,
  catalogCest,
  catalogUnidade,
  fiscalStatus,
  form,
  onChange,
  rule,
  preview,
  groups = [],
  productId,
  canEdit,
  canApprove,
  saving,
  loading,
  onClose,
  onSaveDraft,
  onApprove,
  onNewVersion,
  commercialForm,
  onCommercialChange,
  onSaveCommercial,
}) {
  const [activeTab, setActiveTab] = useState('produto');
  const [approveOpen, setApproveOpen] = useState(false);

  useEffect(() => {
    if (open) setActiveTab('produto');
  }, [open, productLabel]);

  const isApproved = rule?.status === 'APPROVED';
  const readOnly = isApproved || !canEdit;
  const capabilityBlocked = preview?.capability?.executable === false;
  const capabilityMessage = formatCapabilityMessage(preview?.capability ?? null);
  const fiscalContextReady = Boolean(establishmentId) && establishmentStatus === 'OK';
  const hasPersistedDraft = Boolean(rule?.id && rule?.status === 'DRAFT');
  const approveDisabled = saving || loading || !hasPersistedDraft;
  const hasCommercialEditor = Boolean(commercialForm && onCommercialChange);

  const establishmentOptions = useMemo(
    () => establishments.map((e) => ({ value: e.establishmentId, label: e.label })),
    [establishments],
  );

  const groupOptions = useMemo(
    () => [
      { value: '', label: 'Sem grupo fiscal' },
      ...groups.filter((g) => g.status === 'ACTIVE').map((g) => ({ value: g.id, label: g.name })),
    ],
    [groups],
  );

  const issuerUf = establishments.find((e) => e.establishmentId === establishmentId)?.issuerUf
    ?? form.issuerUf
    ?? '—';

  const displayCodigo = commercialForm?.codigo || catalogCodigo || '—';
  const displayNcm = commercialForm?.ncm || catalogNcm || '—';
  const displayUnidade = commercialForm?.unidade || catalogUnidade || 'UN';

  if (!open) return null;

  const renderCommercialTab = () => {
    if (hasCommercialEditor) {
      return (
        <Section title="Dados comerciais">
          <Field label="Descrição">
            <input
              className={inputClass()}
              value={commercialForm.discriminacao}
              onChange={(e) => onCommercialChange({ discriminacao: e.target.value })}
              disabled={!canEdit}
              placeholder="Nome do produto na NF-e"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código / SKU">
              <input
                className={inputClass()}
                value={commercialForm.codigo}
                onChange={(e) => onCommercialChange({ codigo: e.target.value })}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Unidade">
              <input
                className={inputClass()}
                value={commercialForm.unidade}
                onChange={(e) => onCommercialChange({ unidade: e.target.value })}
                disabled={!canEdit}
              />
            </Field>
            <Field label="NCM">
              <input
                className={inputClass()}
                value={commercialForm.ncm}
                onChange={(e) => onCommercialChange({ ncm: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                disabled={!canEdit}
              />
            </Field>
            <Field label="CEST">
              <input
                className={inputClass()}
                value={commercialForm.cest}
                onChange={(e) => onCommercialChange({ cest: e.target.value.replace(/\D/g, '') })}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <Field label="Preço padrão">
            <input
              className={inputClass()}
              value={commercialForm.valor_sugerido}
              onChange={(e) => onCommercialChange({ valor_sugerido: e.target.value })}
              disabled={!canEdit}
            />
          </Field>
          <AppSelect
            label="Grupo fiscal"
            value={commercialForm.fiscalProductGroupId}
            onChange={(v) => onCommercialChange({ fiscalProductGroupId: v })}
            options={groupOptions}
            disabled={!canEdit}
          />
        </Section>
      );
    }

    return (
      <Section title="Dados comerciais">
        <p className="text-sm text-[var(--text-muted)]">Descrição: {productLabel}</p>
        <div className="flex flex-wrap gap-1">
          <MetaChip label="Código" value={displayCodigo} />
          <MetaChip label="NCM" value={displayNcm} />
          <MetaChip label="Un." value={displayUnidade} />
          {catalogCest ? <MetaChip label="CEST" value={catalogCest} /> : null}
        </div>
      </Section>
    );
  };

  const renderFiscalTab = () => {
    if (!fiscalContextReady) {
      return (
        <div className="rounded-[16px] border border-dashed border-[var(--card-border)] p-6 text-center">
          <p className="text-sm font-semibold">Selecione o estabelecimento fiscal</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Escolha o CNPJ emissor para configurar ICMS, ST, PIS e COFINS deste produto.
          </p>
          {onEstablishmentChange ? (
            <div className="mx-auto mt-4 max-w-md text-left">
              <AppSelect
                label="Estabelecimento (CNPJ emissor)"
                value={establishmentId ?? ''}
                onChange={onEstablishmentChange}
                options={establishmentOptions}
                disabled={!canEdit}
              />
              {establishmentStatus && establishmentStatus !== 'OK' ? (
                <p className="mt-2 text-xs text-amber-600">
                  Este cliente não tem estabelecimento fiscal pronto ({establishmentStatus}).
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {productId ? (
          <p className="text-xs text-[var(--text-muted)]">
            Estabelecimento: {clientLabel ?? '—'} · UF emitente: {issuerUf}
          </p>
        ) : null}

        <Section title="Mercadoria">
          <div className="grid gap-3 sm:grid-cols-2">
            <AppSelect
              label="Origem da mercadoria"
              value={form.origemMercadoria}
              onChange={(v) => onChange({ origemMercadoria: v })}
              options={ORIGEM_MERCADORIA_OPTIONS}
              disabled={readOnly}
            />
            <AppSelect
              label="Origem comercial do item"
              value={form.itemSource}
              onChange={(v) => onChange({ itemSource: v })}
              options={ITEM_SOURCE_OPTIONS}
              disabled={readOnly}
            />
            <AppSelect
              label="Situação ST anterior"
              value={form.priorStStatus}
              onChange={(v) => onChange({ priorStStatus: v })}
              options={PRIOR_ST_STATUS_OPTIONS}
              disabled={readOnly}
            />
          </div>
        </Section>

        <Section title="Condições de aplicação">
          <ScenarioApplicationFields form={form} onChange={onChange} readOnly={readOnly} />
        </Section>

        <Section title="Tratamento fiscal">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CFOP">
              <input
                className={inputClass()}
                value={form.cfop}
                onChange={(e) => onChange({ cfop: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                disabled={readOnly}
              />
            </Field>
            <Field label="CSOSN">
              <input
                className={inputClass()}
                value={form.csosn}
                onChange={(e) => {
                  const csosn = e.target.value.replace(/\D/g, '').slice(0, 3);
                  onChange({ csosn, icmsGroup: deriveIcmsGroupFromCsosn(csosn) });
                }}
                disabled={readOnly}
              />
            </Field>
            <Field label="Grupo ICMS (automático)">
              <input className={inputClass()} value={displayIcmsGroupForForm(form)} readOnly disabled />
            </Field>
            <AppSelect
              label="ST nesta operação"
              value={form.currentOperationSt}
              onChange={(v) => onChange({ currentOperationSt: v })}
              options={CURRENT_OPERATION_ST_OPTIONS}
              disabled={readOnly}
            />
          </div>
          {shouldShowStFields(form) ? (
            <p className="text-xs text-[var(--text-muted)]">
              Parâmetros de ST: configure conforme orientação contábil quando CSOSN ou evidência exigir ST.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="PIS — CST">
              <input
                className={inputClass()}
                value={form.pisCst}
                onChange={(e) => onChange({ pisCst: e.target.value.replace(/\D/g, '') })}
                disabled={readOnly}
              />
            </Field>
            <Field label="COFINS — CST">
              <input
                className={inputClass()}
                value={form.cofinsCst}
                onChange={(e) => onChange({ cofinsCst: e.target.value.replace(/\D/g, '') })}
                disabled={readOnly}
              />
            </Field>
            <AppSelect
              label="PIS — modo de cálculo"
              value={form.pisCalculationMode}
              onChange={(v) => onChange({ pisCalculationMode: v })}
              options={PIS_COFINS_MODE_OPTIONS}
              disabled={readOnly}
            />
            {form.pisCalculationMode === 'ALIQ_PERCENT' ? (
              <Field label="PIS — percentual">
                <input
                  className={inputClass()}
                  value={form.pisPercentual}
                  onChange={(e) => onChange({ pisPercentual: e.target.value })}
                  disabled={readOnly}
                />
              </Field>
            ) : null}
            <AppSelect
              label="COFINS — modo de cálculo"
              value={form.cofinsCalculationMode}
              onChange={(v) => onChange({ cofinsCalculationMode: v })}
              options={PIS_COFINS_MODE_OPTIONS}
              disabled={readOnly}
            />
            {form.cofinsCalculationMode === 'ALIQ_PERCENT' ? (
              <Field label="COFINS — percentual">
                <input
                  className={inputClass()}
                  value={form.cofinsPercentual}
                  onChange={(e) => onChange({ cofinsPercentual: e.target.value })}
                  disabled={readOnly}
                />
              </Field>
            ) : null}
          </div>
        </Section>

        <Section title="Governança">
          <p className="text-xs text-[var(--text-muted)]">Status da regra: {labelRuleStatus(rule?.status ?? null)}</p>
          {isApproved ? (
            <>
              <p className="text-xs text-[var(--text-muted)]">Versão: {rule?.version ?? '—'}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Aprovado em:{' '}
                {rule?.approvedAt ? new Date(rule.approvedAt).toLocaleString('pt-BR') : '—'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Referência: {rule?.sourceLegalReference || rule?.justification || '—'}
              </p>
            </>
          ) : (
            <>
              <Field label="Nome interno (opcional)">
                <input
                  className={inputClass()}
                  value={form.name ?? ''}
                  onChange={(e) => onChange({ name: e.target.value })}
                  disabled={readOnly}
                />
              </Field>
              <Field label="Referência / observação fiscal">
                <input
                  className={inputClass()}
                  value={form.sourceLegalReference ?? ''}
                  onChange={(e) => onChange({ sourceLegalReference: e.target.value })}
                  disabled={readOnly}
                />
              </Field>
            </>
          )}
        </Section>
      </div>
    );
  };

  const footerHint = (() => {
    if (isApproved) return null;
    if (activeTab === 'fiscal' && canApprove && fiscalContextReady && !hasPersistedDraft) {
      return 'Salve o rascunho fiscal antes de aprovar a configuração.';
    }
    if (activeTab === 'fiscal' && canApprove && hasPersistedDraft && capabilityBlocked && capabilityMessage) {
      return capabilityMessage;
    }
    if (activeTab === 'produto') {
      return 'Depois de salvar, configure tributação na aba Configuração fiscal.';
    }
    return null;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
      <Card className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <div className="border-b border-[var(--card-border)] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Configuração de produto
              </p>
              <h2 className="text-lg font-semibold leading-snug">{productLabel}</h2>
              {clientLabel ? (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{clientLabel}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                <MetaChip label="Código" value={displayCodigo} />
                <MetaChip label="NCM" value={displayNcm} />
                <MetaChip label="Status" value={labelFiscalStatus(fiscalStatus)} />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--card-border)] p-2 text-[var(--text-muted)]"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex gap-1 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-1">
            {[
              { id: 'produto', label: 'Produto' },
              { id: 'fiscal', label: 'Configuração fiscal' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-[10px] py-2 text-xs font-semibold ${
                  activeTab === tab.id ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {fiscalContextReady && onEstablishmentChange ? (
            <div className="mt-3">
              <AppSelect
                label="Estabelecimento (CNPJ emissor)"
                value={establishmentId ?? ''}
                onChange={onEstablishmentChange}
                options={establishmentOptions}
                disabled={!canEdit}
              />
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
            </div>
          ) : (
            <>
              {capabilityBlocked && capabilityMessage && activeTab === 'fiscal' ? (
                <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {capabilityMessage}
                </div>
              ) : null}
              {activeTab === 'produto' ? renderCommercialTab() : renderFiscalTab()}
            </>
          )}
        </div>

        <div className="border-t border-[var(--card-border)] p-4 sm:p-5">
          {footerHint ? (
            <p className="mb-3 text-center text-[11px] text-[var(--text-muted)]">{footerHint}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-[12px] border px-4 py-2 text-sm font-semibold">
              Fechar
            </button>
            {!isApproved && activeTab === 'fiscal' && canApprove && hasPersistedDraft && fiscalContextReady ? (
              <button
                type="button"
                disabled={approveDisabled}
                onClick={() => setApproveOpen(true)}
                className="rounded-[12px] border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Aprovar
              </button>
            ) : null}
            {isApproved && canEdit ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => onNewVersion?.()}
                className="rounded-[12px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Criar nova versão
              </button>
            ) : null}
            {!isApproved && activeTab === 'produto' && canEdit && onSaveCommercial ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => onSaveCommercial()}
                className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar produto
              </button>
            ) : null}
            {!isApproved && activeTab === 'fiscal' && canEdit && fiscalContextReady ? (
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => onSaveDraft?.()}
                className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar rascunho fiscal
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      {approveOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-5">
            <h3 className="text-base font-semibold">Aprovar configuração fiscal</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              CFOP {form.cfop || '—'} · CSOSN {form.csosn || '—'} · PIS CST {form.pisCst} · COFINS CST{' '}
              {form.cofinsCst}
            </p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Após aprovar, alterações exigem nova versão da regra.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setApproveOpen(false)} className="text-sm underline">
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setApproveOpen(false);
                  onApprove?.();
                }}
                className="rounded-[12px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Confirmar aprovação
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
