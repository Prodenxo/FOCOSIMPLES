/**
 * Formulário e payload para cadastro de empresa PlugNotas (NFSe/NFe/NFC-e).
 * Adaptado do site Meu-financeiro (GuidesMei.tsx).
 */

import { resolveAppOrigin } from './appOrigin';

const normalizeDoc = (value: string) => value.replace(/\D/g, '');
const hasRequiredText = (value: unknown) => String(value || '').trim().length > 0;

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Regime Simples Nacional (código PlugNotas 1). */
export type PlugNotasRegimeTributario = '1';

/** MEI na Plugnotas: regimeTributario 1 + regimeTributarioEspecial 5. */
export const PLUGNOTAS_REGIME_ESPECIAL_MEI = 5;

export const PLUGNOTAS_REGIME_TRIBUTARIO_MEI_LABEL = 'Simples Nacional + MEI';
export const PLUGNOTAS_REGIME_TRIBUTARIO_SIMPLES_LABEL = 'Simples Nacional';

export const PLUGNOTAS_REGIME_TRIBUTARIO_OPTIONS: Array<{ value: PlugNotasRegimeTributario; label: string }> = [
  {
    value: '1',
    label:
      resolveAppOrigin() === 'focosimples'
        ? PLUGNOTAS_REGIME_TRIBUTARIO_SIMPLES_LABEL
        : PLUGNOTAS_REGIME_TRIBUTARIO_MEI_LABEL,
  },
];

export interface PlugNotasCompanyForm {
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  email: string;
  regimeTributario: PlugNotasRegimeTributario;
  simplesNacional: boolean;
  cep: string;
  tipoLogradouro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigoCidade: string;
  descricaoCidade: string;
  estado: string;
  nfseAtivo: boolean;
  nfeAtivo: boolean;
  nfceAtivo: boolean;
  /** Lote inicial RPS no emissor (NFS-e). */
  rpsLote: number;
  /** Número inicial RPS. */
  rpsNumero: number;
  /** Série RPS (texto). */
  rpsSerie: string;
}

const clampRpsInt = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return fallback;
};

export function isPlugnotasRpsSerieNotRegisteredMessage(message: string): boolean {
  const m = String(message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!m.trim()) return false;
  if (m.includes('nenhuma serie cadastrada')) return true;
  if (m.includes('serie') && m.includes('cadastrad') && (m.includes('rps') || m.includes('nfse'))) return true;
  return false;
}

/**
 * Converte os dados retornados pelo backend (EmpresaFiscalData) para o
 * formato do formulário (PlugNotasCompanyForm). Usado para pré-preencher
 * o formulário ao editar uma empresa já cadastrada no PlugNotas.
 */
export function empresaFiscalToCompanyForm(empresa: any): PlugNotasCompanyForm {
  const defaults = getDefaultPlugNotasCompanyForm();
  const endereco = empresa?.endereco || {};
  return {
    razaoSocial: empresa?.razaoSocial || '',
    nomeFantasia: empresa?.nomeFantasia || '',
    inscricaoMunicipal: empresa?.inscricaoMunicipal || '',
    inscricaoEstadual: empresa?.inscricaoEstadual || '',
    email: empresa?.email || '',
    regimeTributario: '1',
    simplesNacional: empresa?.simplesNacional ?? defaults.simplesNacional,
    cep: normalizeDoc(endereco?.cep || ''),
    tipoLogradouro: endereco?.tipoLogradouro || defaults.tipoLogradouro,
    logradouro: endereco?.logradouro || '',
    numero: endereco?.numero || '',
    complemento: endereco?.complemento || '',
    bairro: endereco?.bairro || '',
    codigoCidade: endereco?.codigoCidade ? String(endereco.codigoCidade) : '',
    descricaoCidade: endereco?.descricaoCidade || '',
    estado: (endereco?.estado || '').toUpperCase().slice(0, 2),
    nfseAtivo: empresa?.nfse?.ativo !== false,
    nfeAtivo: empresa?.nfe?.ativo === true,
    nfceAtivo: empresa?.nfce?.ativo === true,
    rpsLote: clampRpsInt(empresa?.rps?.lote ?? empresa?.nfse?.config?.rps?.lote, 1),
    rpsNumero: clampRpsInt(
      empresa?.rps?.numeracao?.[0]?.numero ?? empresa?.nfse?.config?.rps?.numero,
      1
    ),
    rpsSerie: String(
      empresa?.rps?.numeracao?.[0]?.serie ?? empresa?.nfse?.config?.rps?.serie ?? '1'
    ).trim() || '1',
  };
}

export function getDefaultPlugNotasCompanyForm(): PlugNotasCompanyForm {
  return {
    razaoSocial: '',
    nomeFantasia: '',
    inscricaoMunicipal: '',
    inscricaoEstadual: '',
    email: '',
    regimeTributario: '1',
    simplesNacional: true,
    cep: '',
    tipoLogradouro: 'Rua',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    codigoCidade: '',
    descricaoCidade: '',
    estado: '',
    nfseAtivo: true,
    nfeAtivo: resolveAppOrigin() === 'focosimples',
    // NFC-e exige CSC/SEFAZ — fora do MVP (Foco Simples e FocoMEI).
    nfceAtivo: false,
    rpsLote: 1,
    rpsNumero: 1,
    rpsSerie: '1',
  };
}

export function getPlugNotasCompanyValidationMessage(form: PlugNotasCompanyForm): string | null {
  if (!hasRequiredText(form.razaoSocial)) return 'Informe a razão social da empresa para configurar a integração fiscal.';
  if (!hasRequiredText(form.logradouro)) return 'Informe o logradouro do endereço da empresa.';
  if (!hasRequiredText(form.numero)) return 'Informe o número do endereço da empresa.';
  if (!hasRequiredText(form.bairro)) return 'Informe o bairro do endereço da empresa.';
  if (normalizeDoc(form.cep).length !== 8) return 'Informe um CEP válido com 8 dígitos.';
  if (!hasRequiredText(form.codigoCidade)) return 'Informe o código IBGE da cidade.';
  if (!hasRequiredText(form.descricaoCidade)) return 'Informe a cidade da empresa.';
  if (form.estado.trim().length !== 2) return 'Informe a UF com 2 letras (ex.: PR).';
  if (!hasRequiredText(form.email)) {
    return 'Informe o e-mail da empresa (obrigatório no cadastro fiscal).';
  }
  if (!isValidEmail(form.email)) {
    return 'Informe um e-mail válido (ex.: contato@empresa.com.br).';
  }
  if (!form.nfseAtivo && !form.nfeAtivo && !form.nfceAtivo) {
    return 'Selecione pelo menos um tipo de nota fiscal (NFS-e, NF-e ou NFC-e).';
  }
  if (form.nfceAtivo) {
    return 'NFC-e exige CSC/SEFAZ configurado no emissor. Desative NFC-e por agora para salvar e testar apenas NF-e.';
  }
  if (!Number.isFinite(form.rpsLote) || form.rpsLote < 1) {
    return 'Lote RPS deve ser um número inteiro maior ou igual a 1.';
  }
  if (!Number.isFinite(form.rpsNumero) || form.rpsNumero < 1) {
    return 'Número inicial do RPS deve ser um inteiro maior ou igual a 1.';
  }
  if (!String(form.rpsSerie ?? '').trim()) {
    return 'Informe a série do RPS (ex.: 1).';
  }
  return null;
}

export function buildPlugNotasEmpresaPayload({
  cnpj,
  certificadoId,
  form,
}: {
  cnpj: string;
  certificadoId: string;
  form: PlugNotasCompanyForm;
}): Record<string, unknown> {
  const endereco: Record<string, unknown> = {
    tipoLogradouro: form.tipoLogradouro.trim() || 'Rua',
    logradouro: form.logradouro.trim(),
    numero: form.numero.trim(),
    bairro: form.bairro.trim(),
    codigoPais: '1058',
    descricaoPais: 'Brasil',
    codigoCidade: form.codigoCidade.trim(),
    descricaoCidade: form.descricaoCidade.trim(),
    estado: form.estado.trim().toUpperCase(),
    cep: normalizeDoc(form.cep).slice(0, 8),
  };
  if (form.complemento.trim()) {
    endereco.complemento = form.complemento.trim();
  }

  // Limitação do PlugNotas: campos opcionais (email, IM, IE) só podem ser
  // SUBSTITUÍDOS por outro valor válido, não LIMPOS via PATCH. Enviar null
  // ou string vazia é silenciosamente ignorado. Por isso só incluímos no
  // payload quando há valor — preserva o valor anterior se o usuário deixou
  // em branco.
  const email = form.email.trim();
  const im = form.inscricaoMunicipal.trim();
  const ie = form.inscricaoEstadual.trim();

  const payload: Record<string, unknown> = {
    cpfCnpj: cnpj,
    razaoSocial: form.razaoSocial.trim(),
    nomeFantasia: form.nomeFantasia.trim() || form.razaoSocial.trim(),
    regimeTributario: Number(form.regimeTributario || '1'),
    simplesNacional: true,
    ...(resolveAppOrigin() !== 'focosimples'
      && form.regimeTributario === '1'
      && form.simplesNacional
      ? { regimeTributarioEspecial: PLUGNOTAS_REGIME_ESPECIAL_MEI }
      : {}),
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
      config: {
        producao: true,
        serie: 1,
        numero: 1,
      },
    },
    nfce: {
      ativo: Boolean(form.nfceAtivo),
      tipoContrato: 0,
      config: { producao: true, serie: 1, numero: 1 },
    },
    /** Espelha permissões já definidas (admin); o utilizador não altera isto na UI. */
    documentosAtivos: {
      nfse: Boolean(form.nfseAtivo),
      nfe: Boolean(form.nfeAtivo),
      nfce: Boolean(form.nfceAtivo),
    },
    rps: {
      lote: clampRpsInt(form.rpsLote, 1),
      numeracao: [
        {
          numero: clampRpsInt(form.rpsNumero, 1),
          serie: String(form.rpsSerie ?? '1').trim() || '1',
        },
      ],
    },
  };
  const certId = String(certificadoId || '').trim();
  if (certId) {
    payload.certificado = certId;
  }
  if (email) payload.email = email;
  if (im) payload.inscricaoMunicipal = im;
  // PlugNotas exige IE com NF-e/NFC-e; vazio → ISENTO (alinhado ao helper da UI)
  payload.inscricaoEstadual = ie || 'ISENTO';

  return payload;
}
