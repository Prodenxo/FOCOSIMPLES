/**
 * Formulário e payload PlugNotas — aba Certificado (Foco Simples).
 * Port de frontend/lib/plugNotasEmpresaForm.ts.
 */

import { DEFAULT_EMPRESA_BUSINESS_TYPE, normalizeEmpresaBusinessType } from '@/lib/empresaBusinessType';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');
const hasRequiredText = (value) => String(value || '').trim().length > 0;
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const clampRpsInt = (value, fallback) => {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return fallback;
};

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

export function getDefaultPlugNotasCompanyForm() {
  return {
    razaoSocial: '',
    nomeFantasia: '',
    cpfCnpj: '',
    inscricaoMunicipal: '',
    inscricaoEstadual: '',
    email: '',
    telefone: '',
    regimeTributario: '1',
    simplesNacional: true,
    businessType: DEFAULT_EMPRESA_BUSINESS_TYPE,
    cep: '',
    tipoLogradouro: 'Rua',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    codigoCidade: '',
    municipio: '',
    uf: '',
    nfseAtivo: true,
    nfeAtivo: true,
    nfceAtivo: false,
    rpsLote: 1,
    rpsNumero: 1,
    rpsSerie: '1',
  };
}

/** @param {Record<string, unknown>|null|undefined} empresa */
export function empresaFiscalToCompanyForm(empresa) {
  const defaults = getDefaultPlugNotasCompanyForm();
  if (!empresa) return { ...defaults };

  const endereco = empresa?.endereco && typeof empresa.endereco === 'object' ? empresa.endereco : {};
  const ieApi = String(empresa?.inscricaoEstadual || '').trim();

  return {
    ...defaults,
    razaoSocial: String(empresa?.razaoSocial || empresa?.nome || ''),
    nomeFantasia: String(empresa?.nomeFantasia || ''),
    cpfCnpj: String(empresa?.cpfCnpj || empresa?.cnpj || ''),
    inscricaoMunicipal: String(empresa?.inscricaoMunicipal || empresa?.im || ''),
    inscricaoEstadual: ieApi && ieApi.toUpperCase() !== 'ISENTO' ? ieApi : '',
    email: String(empresa?.email || ''),
    telefone: formatTelefoneEmpresa(empresa?.telefone ?? empresa?.phone),
    cep: normalizeDoc(endereco?.cep || empresa?.cep || ''),
    tipoLogradouro: String(endereco?.tipoLogradouro || defaults.tipoLogradouro),
    logradouro: String(endereco?.logradouro || empresa?.logradouro || ''),
    numero: endereco?.numero != null ? String(endereco.numero) : '',
    complemento: String(endereco?.complemento || ''),
    bairro: String(endereco?.bairro || empresa?.bairro || ''),
    codigoCidade: endereco?.codigoCidade != null ? String(endereco.codigoCidade) : '',
    municipio: String(endereco?.descricaoCidade || empresa?.municipio || empresa?.cidade || ''),
    uf: String(endereco?.estado || empresa?.uf || '').toUpperCase().slice(0, 2),
    nfseAtivo: empresa?.nfse?.ativo !== false,
    nfeAtivo: empresa?.nfe?.ativo === true,
    nfceAtivo: empresa?.nfce?.ativo === true,
    rpsLote: clampRpsInt(empresa?.rps?.lote ?? empresa?.nfse?.config?.rps?.lote, 1),
    rpsNumero: clampRpsInt(
      empresa?.rps?.numeracao?.[0]?.numero ?? empresa?.nfse?.config?.rps?.numero,
      1,
    ),
    rpsSerie: String(
      empresa?.rps?.numeracao?.[0]?.serie ?? empresa?.nfse?.config?.rps?.serie ?? '1',
    ).trim() || '1',
    businessType: normalizeEmpresaBusinessType(empresa?.businessType ?? empresa?.business_type),
  };
}

/** Alias legado */
export const empresaFiscalToCertPageForm = empresaFiscalToCompanyForm;

/** @param {Record<string, unknown>|null|undefined} form @param {Record<string, unknown>|null|undefined} prefill */
export function mergeCertPrefillIntoCertPageForm(form, prefill, options = {}) {
  const onlyFillEmpty = options.onlyFillEmpty !== false;
  const base = form || getDefaultPlugNotasCompanyForm();
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
  const base = form || getDefaultPlugNotasCompanyForm();
  const end = lookup?.endereco && typeof lookup.endereco === 'object' ? lookup.endereco : null;

  const numeroFromLookup = end?.numero != null ? String(end.numero).trim() : '';
  let nextNumero = String(base.numero ?? '').trim();
  if (numeroFromLookup && (!onlyFillEmpty || !nextNumero)) {
    nextNumero = numeroFromLookup;
  }

  return {
    ...base,
    razaoSocial: takeField(base.razaoSocial, lookup?.razaoSocial, onlyFillEmpty),
    nomeFantasia: takeField(base.nomeFantasia, lookup?.nomeFantasia, onlyFillEmpty),
    email: takeField(base.email, lookup?.email, onlyFillEmpty),
    telefone: takeField(base.telefone, formatTelefoneEmpresa(lookup?.telefone), onlyFillEmpty),
    inscricaoMunicipal: takeField(base.inscricaoMunicipal, lookup?.inscricaoMunicipal, onlyFillEmpty),
    inscricaoEstadual: takeField(base.inscricaoEstadual, lookup?.inscricaoEstadual, onlyFillEmpty),
    cep: takeField(base.cep, end?.cep ? normalizeDoc(end.cep) : '', onlyFillEmpty),
    logradouro: takeField(base.logradouro, end?.logradouro, onlyFillEmpty),
    bairro: takeField(base.bairro, end?.bairro, onlyFillEmpty),
    complemento: takeField(base.complemento, end?.complemento, onlyFillEmpty),
    numero: nextNumero || base.numero,
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

export async function buildEnrichedCertPageForm({
  empresa = null,
  prefill = null,
  cnpj = null,
  lookupCnpjFn = null,
  prefillOnlyFillEmpty = true,
  lookupOnlyFillEmpty = true,
}) {
  let form = empresaFiscalToCompanyForm(empresa);
  if (!empresa) {
    form = { ...form, cpfCnpj: normalizeDoc(cnpj || '') };
  }
  form = mergeCertPrefillIntoCertPageForm(form, prefill, { onlyFillEmpty: prefillOnlyFillEmpty });

  const cnpjDigits = normalizeDoc(cnpj || form.cpfCnpj || prefill?.prestadorCpfCnpj || '');
  if (needsAddressEnrichment(form) && cnpjDigits.length === 14 && lookupCnpjFn) {
    try {
      const lookup = await lookupCnpjFn(cnpjDigits);
      form = mergeCnpjLookupIntoCertPageForm(form, lookup, { onlyFillEmpty: lookupOnlyFillEmpty });
    } catch {
      /* best-effort */
    }
  }

  return form;
}

/** @param {Record<string, unknown>|null|undefined} empresa */
export function isEmpresaCadastradaNoEmissor(empresa) {
  if (!empresa || typeof empresa !== 'object') return false;
  const cnpj = normalizeDoc(empresa.cpfCnpj || empresa.cnpj || '');
  if (cnpj.length !== 14) return false;
  return Boolean(String(empresa.razaoSocial || empresa.nome || '').trim());
}

/** @param {ReturnType<typeof getDefaultPlugNotasCompanyForm>} form */
export function getPlugNotasCompanyValidationMessage(form) {
  if (!hasRequiredText(form.razaoSocial)) {
    return 'Informe a razão social da empresa para configurar a integração fiscal.';
  }
  if (!hasRequiredText(form.logradouro)) return 'Informe o logradouro do endereço da empresa.';
  if (!hasRequiredText(form.numero)) return 'Informe o número do endereço da empresa.';
  if (!hasRequiredText(form.bairro)) return 'Informe o bairro do endereço da empresa.';
  if (normalizeDoc(form.cep).length !== 8) return 'Informe um CEP válido com 8 dígitos.';
  if (!hasRequiredText(form.codigoCidade)) return 'Informe o código IBGE da cidade.';
  if (!hasRequiredText(form.municipio)) return 'Informe a cidade da empresa.';
  if (String(form.uf ?? '').trim().length !== 2) return 'Informe a UF com 2 letras (ex.: PR).';
  if (!hasRequiredText(form.email)) return 'Informe o e-mail da empresa (obrigatório no cadastro fiscal).';
  if (!isValidEmail(form.email)) return 'Informe um e-mail válido (ex.: contato@empresa.com.br).';
  if (form.nfseAtivo && !hasRequiredText(form.inscricaoMunicipal)) {
    return 'Informe a Inscrição Municipal (IM) para emitir NFS-e.';
  }
  if (!form.nfseAtivo && !form.nfeAtivo && !form.nfceAtivo) {
    return 'Selecione pelo menos um tipo de nota fiscal (NFS-e, NF-e ou NFC-e).';
  }
  if (form.nfceAtivo) {
    return 'NFC-e exige CSC/SEFAZ configurado no emissor. Desative NFC-e por agora.';
  }
  if (!Number.isFinite(form.rpsLote) || form.rpsLote < 1) {
    return 'Lote RPS deve ser um número inteiro maior ou igual a 1.';
  }
  if (!Number.isFinite(form.rpsNumero) || form.rpsNumero < 1) {
    return 'Número inicial do RPS deve ser um inteiro maior ou igual a 1.';
  }
  if (!String(form.rpsSerie ?? '').trim()) return 'Informe a série do RPS (ex.: 1).';
  return null;
}

/** @param {ReturnType<typeof getDefaultPlugNotasCompanyForm>} form */
export function buildPlugNotasEmpresaPayload(form) {
  const cnpj = normalizeDoc(form.cpfCnpj);
  const endereco = {
    tipoLogradouro: String(form.tipoLogradouro || 'Rua').trim() || 'Rua',
    logradouro: String(form.logradouro ?? '').trim(),
    numero: String(form.numero ?? '').trim(),
    bairro: String(form.bairro ?? '').trim(),
    codigoPais: '1058',
    descricaoPais: 'Brasil',
    codigoCidade: String(form.codigoCidade ?? '').trim(),
    descricaoCidade: String(form.municipio ?? '').trim(),
    estado: String(form.uf ?? '').trim().toUpperCase().slice(0, 2),
    cep: normalizeDoc(form.cep).slice(0, 8),
  };
  if (String(form.complemento ?? '').trim()) {
    endereco.complemento = String(form.complemento).trim();
  }

  const email = String(form.email ?? '').trim();
  const im = String(form.inscricaoMunicipal ?? '').trim();
  const ie = String(form.inscricaoEstadual ?? '').trim();

  const payload = {
    cpfCnpj: cnpj,
    razaoSocial: String(form.razaoSocial ?? '').trim(),
    nomeFantasia: String(form.nomeFantasia ?? '').trim() || String(form.razaoSocial ?? '').trim(),
    regimeTributario: Number(form.regimeTributario || '1'),
    simplesNacional: true,
    endereco,
    nfse: {
      ativo: Boolean(form.nfseAtivo),
      tipoContrato: 0,
      config: {
        producao: true,
        nfseNacional: true,
        consultaNfseNacional: true,
        rps: {
          serie: String(form.rpsSerie ?? '1').trim() || '1',
          numero: clampRpsInt(form.rpsNumero, 1),
          lote: clampRpsInt(form.rpsLote, 1),
        },
      },
    },
    nfe: {
      ativo: Boolean(form.nfeAtivo),
      tipoContrato: 0,
      config: { producao: true, serie: 1, numero: 1 },
    },
    nfce: {
      ativo: Boolean(form.nfceAtivo),
      tipoContrato: 0,
      config: { producao: true, serie: 1, numero: 1 },
    },
    documentosAtivos: {
      nfse: Boolean(form.nfseAtivo),
      nfe: Boolean(form.nfeAtivo),
      nfce: Boolean(form.nfceAtivo),
    },
    businessType: normalizeEmpresaBusinessType(form.businessType),
    rps: {
      lote: clampRpsInt(form.rpsLote, 1),
      numeracao: [{
        numero: clampRpsInt(form.rpsNumero, 1),
        serie: String(form.rpsSerie ?? '1').trim() || '1',
      }],
    },
  };

  if (email) payload.email = email;
  if (im) payload.inscricaoMunicipal = im;
  if (ie) {
    if (ie.toUpperCase() === 'ISENTO') payload.inscricaoEstadual = 'ISENTO';
    else {
      const ieDigits = ie.replace(/\D/g, '');
      if (ieDigits) payload.inscricaoEstadual = ieDigits;
    }
  }

  const telefoneRaw = String(form.telefone ?? '').replace(/\D/g, '');
  if (telefoneRaw.length >= 10) {
    payload.telefone = { ddd: telefoneRaw.slice(0, 2), numero: telefoneRaw.slice(2) };
  }

  return payload;
}

/** @deprecated use buildPlugNotasEmpresaPayload */
export const buildCertPageCompanyPayload = buildPlugNotasEmpresaPayload;
