'use client';

import { Loader2 } from 'lucide-react';
import { EMPRESA_BUSINESS_TYPE_OPTIONS } from '@/lib/empresaBusinessType';
import { formatCnpj } from '@/lib/fiscalFormat';

/**
 * Formulário completo da empresa emissora (PlugNotas).
 * @param {{
 *   form: Record<string, unknown>,
 *   onChange: (field: string, value: unknown) => void,
 *   cnpjLookupLoading?: boolean,
 *   cnpjLookupError?: string|null,
 *   readOnlyCnpj?: boolean,
 *   showDocumentFlags?: boolean,
 * }} props
 */
export function EmpresaFiscalForm({
  form,
  onChange,
  cnpjLookupLoading = false,
  cnpjLookupError = null,
  readOnlyCnpj = true,
  showDocumentFlags = false,
}) {
  if (!form) return null;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Identificação</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Razão social" value={form.razaoSocial} onChange={(v) => onChange('razaoSocial', v)} required />
          <Field label="Nome fantasia" value={form.nomeFantasia} onChange={(v) => onChange('nomeFantasia', v)} />
          <Field
            label="CNPJ"
            value={readOnlyCnpj ? formatCnpj(form.cpfCnpj || '') : form.cpfCnpj}
            onChange={(v) => onChange('cpfCnpj', v)}
            readOnly={readOnlyCnpj}
          />
          <Field label="Inscrição municipal" value={form.inscricaoMunicipal} onChange={(v) => onChange('inscricaoMunicipal', v)} hint="Obrigatória para NFS-e." />
          <Field label="Inscrição estadual" value={form.inscricaoEstadual} onChange={(v) => onChange('inscricaoEstadual', v)} hint="NF-e. Deixe vazio se isento." />
          <Field label="E-mail fiscal" value={form.email} onChange={(v) => onChange('email', v)} type="email" required />
          <Field label="Telefone" value={form.telefone} onChange={(v) => onChange('telefone', v)} />
        </div>
        {cnpjLookupLoading ? (
          <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Consultando CNPJ na Receita…
          </p>
        ) : null}
        {cnpjLookupError ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">{cnpjLookupError}</p>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-[var(--card-border)] pt-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Endereço fiscal</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="CEP" value={form.cep} onChange={(v) => onChange('cep', v)} />
          <Field label="Código IBGE" value={form.codigoCidade} onChange={(v) => onChange('codigoCidade', v)} required hint="7 dígitos do município." />
          <Field label="UF" value={form.uf} onChange={(v) => onChange('uf', v.toUpperCase().slice(0, 2))} maxLength={2} />
        </div>
        <Field label="Município" value={form.municipio} onChange={(v) => onChange('municipio', v)} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Logradouro" value={form.logradouro} onChange={(v) => onChange('logradouro', v)} />
          <Field label="Número" value={form.numero} onChange={(v) => onChange('numero', v)} placeholder="S/N" />
          <Field label="Complemento" value={form.complemento} onChange={(v) => onChange('complemento', v)} />
        </div>
        <Field label="Bairro" value={form.bairro} onChange={(v) => onChange('bairro', v)} />
      </section>

      {form.nfseAtivo !== false ? (
        <section className="space-y-3 border-t border-[var(--card-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Numeração RPS / DPS</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Informe o próximo número a emitir. Se já usava outro sistema, coloque o último RPS emitido + 1.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Série" value={form.rpsSerie} onChange={(v) => onChange('rpsSerie', v)} maxLength={5} />
            <Field
              label="Próximo nº"
              value={String(form.rpsNumero ?? '')}
              onChange={(v) => {
                const n = Number.parseInt(String(v).replace(/\D/g, ''), 10);
                onChange('rpsNumero', Number.isFinite(n) && n >= 1 ? n : 1);
              }}
              inputMode="numeric"
            />
            <Field
              label="Lote"
              value={String(form.rpsLote ?? '')}
              onChange={(v) => {
                const n = Number.parseInt(String(v).replace(/\D/g, ''), 10);
                onChange('rpsLote', Number.isFinite(n) && n >= 1 ? n : 1);
              }}
              inputMode="numeric"
            />
          </div>
        </section>
      ) : null}

      {showDocumentFlags ? (
        <section className="space-y-3 border-t border-[var(--card-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tipos de nota</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Permissões efetivas podem ser definidas pelo administrador. Ajuste aqui apenas se autorizado.
          </p>
          <div className="flex flex-wrap gap-4">
            <Toggle label="NFS-e" checked={Boolean(form.nfseAtivo)} onChange={(v) => onChange('nfseAtivo', v)} />
            <Toggle label="NF-e" checked={Boolean(form.nfeAtivo)} onChange={(v) => onChange('nfeAtivo', v)} />
            <Toggle label="NFC-e" checked={Boolean(form.nfceAtivo)} onChange={(v) => onChange('nfceAtivo', v)} />
          </div>
        </section>
      ) : null}

      {form.nfeAtivo ? (
        <section className="space-y-3 border-t border-[var(--card-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tipo de operação (NF-e)</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {EMPRESA_BUSINESS_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-[12px] border p-3 text-sm transition-colors ${
                  form.businessType === opt.value
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50'
                    : 'border-[var(--card-border)] hover:bg-[var(--canvas)]'
                }`}
              >
                <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                  <input
                    type="radio"
                    name="businessType"
                    checked={form.businessType === opt.value}
                    onChange={() => onChange('businessType', opt.value)}
                    className="text-[var(--accent)]"
                  />
                  {opt.label}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{opt.hint}</span>
              </label>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label, value, onChange, readOnly, maxLength, type = 'text', hint, placeholder, required, inputMode,
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-[var(--text-muted)]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        readOnly={readOnly}
        maxLength={maxLength}
        className={`h-10 rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none ${readOnly ? 'opacity-70' : ''}`}
      />
      {hint ? <span className="text-[11px] text-[var(--text-muted)]">{hint}</span> : null}
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--card-border)] text-[var(--accent)]"
      />
      {label}
    </label>
  );
}
