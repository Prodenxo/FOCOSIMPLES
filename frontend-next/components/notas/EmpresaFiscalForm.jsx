'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EMPRESA_BUSINESS_TYPE_OPTIONS } from '@/lib/empresaBusinessType';
import {
  getInscricaoMunicipalFieldHint,
  PLUGNOTAS_REGIME_TRIBUTARIO_OPTIONS,
} from '@/lib/plugNotasEmpresaForm';
import { AppSelect } from '@/components/ui/AppSelect';
import { formatCnpj } from '@/lib/fiscalFormat';
import { lookupCep } from '@/lib/fiscalApi';

/** Campo numérico de RPS: vazio continua vazio enquanto o usuário digita (não volta para 1). */
const parseRpsFieldValue = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : '';
};

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
  const [cepLoading, setCepLoading] = useState(false);

  const handleCepBlur = async () => {
    const cep = String(form?.cep || '').replace(/\D/g, '').slice(0, 8);
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const data = await lookupCep(cep);
      if (!data) return;
      const ibge = data.codigoCidade || data.ibge || data.city_ibge_code;
      if (data.logradouro) onChange('logradouro', data.logradouro);
      if (data.bairro) onChange('bairro', data.bairro);
      const cidade = data.descricaoCidade || data.cidade || data.localidade;
      if (cidade) onChange('municipio', cidade);
      if (data.estado || data.uf) {
        onChange('uf', String(data.estado || data.uf).toUpperCase().slice(0, 2));
      }
      if (ibge) onChange('codigoCidade', String(ibge).replace(/\D/g, '').slice(0, 7));
      onChange('cep', cep);
      const log = String(data.logradouro || form.logradouro || '').trim();
      if (/^av\.?\s|^avenida\s/i.test(log)) onChange('tipoLogradouro', 'Avenida');
    } catch {
      /* CEP opcional — usuário pode preencher manualmente */
    } finally {
      setCepLoading(false);
    }
  };

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
          <Field
            label="Inscrição municipal"
            value={form.inscricaoMunicipal}
            onChange={(v) => onChange('inscricaoMunicipal', v)}
            hint={getInscricaoMunicipalFieldHint(form)}
          />
          <Field label="Inscrição estadual" value={form.inscricaoEstadual} onChange={(v) => onChange('inscricaoEstadual', v)} hint="NF-e. Deixe vazio se isento." />
          <Field label="E-mail fiscal" value={form.email} onChange={(v) => onChange('email', v)} type="email" required />
          <Field label="Telefone" value={form.telefone} onChange={(v) => onChange('telefone', v)} />
          <AppSelect
            label="Regime tributário (CRT)"
            value={String(form.regimeTributario ?? '1')}
            onChange={(v) => onChange('regimeTributario', v)}
            options={PLUGNOTAS_REGIME_TRIBUTARIO_OPTIONS}
          />
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
          <Field
            label="CEP"
            value={form.cep}
            onChange={(v) => onChange('cep', v)}
            onBlur={() => void handleCepBlur()}
            hint={cepLoading ? 'Consultando CEP…' : 'Use o CEP da nota autorizada (ex.: 28495376).'}
          />
          <Field label="Código IBGE" value={form.codigoCidade} onChange={(v) => onChange('codigoCidade', v)} required hint="7 dígitos — Aperibé/RJ: 3300159." />
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
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">NFS-e</h3>
          <label className="flex cursor-pointer items-start gap-2 rounded-[12px] border border-[var(--card-border)] p-3 text-sm">
            <input
              type="checkbox"
              checked={form.nfseNacional !== false}
              onChange={(e) => onChange('nfseNacional', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--card-border)] text-[var(--accent)]"
            />
            <span>
              <span className="font-medium text-[var(--text-primary)]">Usar NFS-e Nacional (Emissor Nacional)</span>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">
                Recomendado quando a prefeitura ainda não está homologada na PlugNotas (ex.: Aperibé/RJ). As notas vão pelo ambiente nacional.
                Isso não cadastra o certificado .pfx — use o botão &quot;Enviar certificado à PlugNotas&quot; no card do certificado.
              </span>
            </span>
          </label>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Numeração RPS / DPS</h3>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Aqui você informa a sequência do <strong className="font-medium text-[var(--text-primary)]">RPS ou DPS</strong>{' '}
            (recibo provisório enviado à prefeitura). O <strong className="font-medium text-[var(--text-primary)]">número da NFS-e</strong>{' '}
            que aparece na nota aprovada é definido na autorização — não preencha esse número nesta tela.
            Se você usava outro sistema, use o último RPS/DPS emitido + 1, ou o valor que a prefeitura indicou ao
            liberar um lote novo.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Série RPS/DPS"
              hint="Em geral 1, salvo orientação da prefeitura."
              value={form.rpsSerie}
              onChange={(v) => onChange('rpsSerie', v)}
              maxLength={5}
            />
            <Field
              label="Próximo nº RPS/DPS"
              hint="Próximo recibo provisório a emitir (não é o nº da NFS-e)."
              value={String(form.rpsNumero ?? '')}
              onChange={(v) => onChange('rpsNumero', parseRpsFieldValue(v))}
              inputMode="numeric"
            />
            <Field
              label="Lote de RPS"
              hint="Lote cadastrado na prefeitura para envio dos RPS (não é o nº da nota)."
              value={String(form.rpsLote ?? '')}
              onChange={(v) => onChange('rpsLote', parseRpsFieldValue(v))}
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
  label, value, onChange, onBlur, readOnly, maxLength, type = 'text', hint, placeholder, required, inputMode,
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
        onBlur={onBlur}
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
