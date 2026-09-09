/**
 * Mapeamento empresa PlugNotas ↔ formulário da aba Certificado.
 * Port simplificado de frontend/lib/plugNotasEmpresaForm.ts.
 */

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

function takeField(current, incoming, onlyFillEmpty = true) {
  const c = String(current ?? '').trim();
  const inc = incoming == null || incoming === '' ? '' : String(incoming).trim();
  if (!inc) return c;
  if (onlyFillEmpty && c !== '') return c;
  return inc;
}

/** @param {unknown} telefone */
export function formatTelefoneEmpresa(telefone) {
  if (telefone == null || telefone === '') return '';
  if (typeof telefone === 'string') return telefone.trim();
  if (typeof telefone === 'object' && !Array.isArray(telefone)) {
    const ddd = String(telefone.ddd ?? '').replace(/\D/g, '');
    const numero = String(telefone.numero ?? '').replace(/\D/g, '');
    if (ddd && numero) return `(${ddd}) ${numero}`;
    if (numero) return numero;
  }
  return '';
}

/** @param {Record<string, unknown>|null|undefined} empresa */
export function empresaFiscalToCertPageForm(empresa) {
  if (!empresa) return null;
  const endereco = empresa?.endereco && typeof empresa.endereco === 'object'
    ? empresa.endereco
    : {};
  const flatEndereco = typeof empresa?.endereco === 'string' ? empresa.endereco : '';

  return {
    razaoSocial: String(empresa?.razaoSocial || empresa?.nome || ''),
    nomeFantasia: String(empresa?.nomeFantasia || ''),
    cpfCnpj: String(empresa?.cpfCnpj || empresa?.cnpj || ''),
    inscricaoMunicipal: String(empresa?.inscricaoMunicipal || empresa?.im || ''),
    email: String(empresa?.email || ''),
    telefone: formatTelefoneEmpresa(empresa?.telefone ?? empresa?.phone),
    cep: normalizeDoc(endereco?.cep || empresa?.cep || ''),
    municipio: String(endereco?.descricaoCidade || empresa?.municipio || empresa?.cidade || ''),
    uf: String(endereco?.estado || empresa?.uf || '').toUpperCase().slice(0, 2),
    logradouro: String(endereco?.logradouro || flatEndereco || empresa?.logradouro || ''),
    bairro: String(endereco?.bairro || empresa?.bairro || ''),
    numero: endereco?.numero != null ? String(endereco.numero) : '',
    complemento: String(endereco?.complemento || ''),
    codigoCidade: endereco?.codigoCidade != null ? String(endereco.codigoCidade) : '',
  };
}

/** @param {Record<string, unknown>|null|undefined} form @param {Record<string, unknown>|null|undefined} prefill */
export function mergeCertPrefillIntoCertPageForm(form, prefill, options = {}) {
  const onlyFillEmpty = options.onlyFillEmpty !== false;
  const base = form || empresaFiscalToCertPageForm({}) || {};
  const pec = prefill?.prestadorEndereco && typeof prefill.prestadorEndereco === 'object'
    ? prefill.prestadorEndereco
    : null;

  return {
    ...base,
    razaoSocial: takeField(base.razaoSocial, prefill?.prestadorRazaoSocial, onlyFillEmpty),
    nomeFantasia: takeField(
      base.nomeFantasia,
      prefill?.prestadorRazaoSocial,
      onlyFillEmpty && !String(base.nomeFantasia ?? '').trim(),
    ),
    cpfCnpj: takeField(base.cpfCnpj, prefill?.prestadorCpfCnpj, onlyFillEmpty),
    inscricaoMunicipal: takeField(base.inscricaoMunicipal, prefill?.prestadorInscricaoMunicipal, onlyFillEmpty),
    email: takeField(base.email, prefill?.prestadorEmail, onlyFillEmpty),
    logradouro: takeField(base.logradouro, pec?.logradouro, onlyFillEmpty),
    bairro: takeField(base.bairro, pec?.bairro, onlyFillEmpty),
    complemento: takeField(base.complemento, pec?.complemento, onlyFillEmpty),
    numero: takeField(base.numero, pec?.numero, onlyFillEmpty),
    codigoCidade: takeField(base.codigoCidade, pec?.codigoCidade, onlyFillEmpty),
    cep: takeField(base.cep, pec?.cep ? normalizeDoc(pec.cep) : '', onlyFillEmpty),
    municipio: takeField(base.municipio, pec?.descricaoCidade, onlyFillEmpty),
    uf: takeField(
      base.uf,
      pec?.estado ? String(pec.estado).toUpperCase().slice(0, 2) : '',
      onlyFillEmpty,
    ),
  };
}

/** @param {Record<string, unknown>|null|undefined} form @param {Record<string, unknown>|null|undefined} lookup */
export function mergeCnpjLookupIntoCertPageForm(form, lookup, options = {}) {
  const onlyFillEmpty = options.onlyFillEmpty !== false;
  const base = form || {};
  const end = lookup?.endereco && typeof lookup.endereco === 'object' ? lookup.endereco : null;

  const numeroFromLookup = end?.numero != null ? String(end.numero).trim() : '';
  let nextNumero = String(base.numero ?? '').trim();
  if (numeroFromLookup && (!onlyFillEmpty || !nextNumero)) {
    nextNumero = numeroFromLookup;
  } else if (!nextNumero && onlyFillEmpty) {
    nextNumero = '';
  }

  return {
    ...base,
    razaoSocial: takeField(base.razaoSocial, lookup?.razaoSocial, onlyFillEmpty),
    nomeFantasia: takeField(base.nomeFantasia, lookup?.nomeFantasia, onlyFillEmpty),
    email: takeField(base.email, lookup?.email, onlyFillEmpty),
    telefone: takeField(base.telefone, formatTelefoneEmpresa(lookup?.telefone), onlyFillEmpty),
    inscricaoMunicipal: takeField(base.inscricaoMunicipal, lookup?.inscricaoMunicipal, onlyFillEmpty),
    cep: takeField(base.cep, end?.cep ? normalizeDoc(end.cep) : '', onlyFillEmpty),
    logradouro: takeField(base.logradouro, end?.logradouro, onlyFillEmpty),
    bairro: takeField(base.bairro, end?.bairro, onlyFillEmpty),
    complemento: takeField(base.complemento, end?.complemento, onlyFillEmpty),
    numero: nextNumero,
    municipio: takeField(base.municipio, end?.descricaoCidade, onlyFillEmpty),
    uf: takeField(
      base.uf,
      end?.estado ? String(end.estado).toUpperCase().slice(0, 2) : '',
      onlyFillEmpty,
    ),
    codigoCidade: takeField(base.codigoCidade, end?.codigoCidade, onlyFillEmpty),
  };
}

/** @param {Record<string, unknown>|null|undefined} form */
export function needsAddressEnrichment(form) {
  if (!form) return true;
  const hasCep = normalizeDoc(form.cep).length === 8;
  const hasCity = String(form.municipio ?? '').trim().length > 0;
  const hasUf = String(form.uf ?? '').trim().length === 2;
  const hasStreet = String(form.logradouro ?? '').trim().length > 0;
  return !(hasCep && hasCity && hasUf && hasStreet);
}

/**
 * Monta formulário enriquecido: PlugNotas + certificado PFX + lookup CNPJ (best-effort).
 * @param {{
 *   empresa?: Record<string, unknown>|null,
 *   prefill?: Record<string, unknown>|null,
 *   cnpj?: string|null,
 *   lookupCnpjFn?: (cnpj: string) => Promise<Record<string, unknown>>,
 *   prefillOnlyFillEmpty?: boolean,
 *   lookupOnlyFillEmpty?: boolean,
 * }} params
 */
export async function buildEnrichedCertPageForm({
  empresa = null,
  prefill = null,
  cnpj = null,
  lookupCnpjFn = null,
  prefillOnlyFillEmpty = true,
  lookupOnlyFillEmpty = true,
}) {
  let form = empresaFiscalToCertPageForm(empresa) || empresaFiscalToCertPageForm({}) || {};
  form = mergeCertPrefillIntoCertPageForm(form, prefill, { onlyFillEmpty: prefillOnlyFillEmpty });

  const cnpjDigits = normalizeDoc(cnpj || form.cpfCnpj || prefill?.prestadorCpfCnpj || '');
  if (needsAddressEnrichment(form) && cnpjDigits.length === 14 && lookupCnpjFn) {
    try {
      const lookup = await lookupCnpjFn(cnpjDigits);
      form = mergeCnpjLookupIntoCertPageForm(form, lookup, { onlyFillEmpty: lookupOnlyFillEmpty });
    } catch {
      /* lookup é best-effort */
    }
  }

  return form;
}

/** @param {Record<string, unknown>|null|undefined} form */
export function buildCertPageCompanyPayload(form) {
  if (!form) return {};

  const cep = normalizeDoc(form.cep).slice(0, 8);
  const endereco = {
    tipoLogradouro: 'Rua',
    logradouro: String(form.logradouro ?? '').trim(),
    numero: String(form.numero ?? '').trim() || 'S/N',
    bairro: String(form.bairro ?? '').trim(),
    codigoPais: '1058',
    descricaoPais: 'Brasil',
    codigoCidade: String(form.codigoCidade ?? '').trim(),
    descricaoCidade: String(form.municipio ?? '').trim(),
    estado: String(form.uf ?? '').trim().toUpperCase().slice(0, 2),
    cep,
  };

  const complemento = String(form.complemento ?? '').trim();
  if (complemento) endereco.complemento = complemento;

  const payload = {
    cpfCnpj: normalizeDoc(form.cpfCnpj),
    razaoSocial: String(form.razaoSocial ?? '').trim(),
    nomeFantasia: String(form.nomeFantasia ?? '').trim() || String(form.razaoSocial ?? '').trim(),
    endereco,
  };

  const email = String(form.email ?? '').trim();
  const im = String(form.inscricaoMunicipal ?? '').trim();
  if (email) payload.email = email;
  if (im) payload.inscricaoMunicipal = im;

  const telefoneRaw = String(form.telefone ?? '').replace(/\D/g, '');
  if (telefoneRaw.length >= 10) {
    payload.telefone = {
      ddd: telefoneRaw.slice(0, 2),
      numero: telefoneRaw.slice(2),
    };
  }

  return payload;
}
