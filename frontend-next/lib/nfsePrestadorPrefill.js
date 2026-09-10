/**
 * Prefill do prestador/emitente a partir do certificado PFX (user_mei_certificates)
 * e dados da empresa no Plugnotas.
 */

import { maskCep, maskCpfCnpj, onlyDigits } from '@/lib/fiscalEmit';

export const PRESTADOR_PREFILL_MSG_EMPTY =
  'Não há cadastro fiscal ativo para preencher automaticamente. Complete o certificado ou preencha o prestador manualmente.';

export const PRESTADOR_PREFILL_MSG_ERROR =
  'Não foi possível carregar os dados do certificado. Preencha o prestador manualmente ou tente novamente.';

/** @param {Record<string, unknown>|null|undefined} empresa */
export function empresaFiscalToPrestadorPrefill(empresa) {
  if (!empresa) {
    return {
      prestadorCpfCnpj: null,
      prestadorRazaoSocial: null,
      prestadorEmail: null,
      prestadorInscricaoMunicipal: null,
      prestadorEndereco: null,
    };
  }
  const endereco = empresa?.endereco || null;
  return {
    prestadorCpfCnpj: empresa?.cpfCnpj || empresa?.cnpj || null,
    prestadorRazaoSocial: empresa?.razaoSocial || empresa?.nomeFantasia || null,
    prestadorEmail: empresa?.email || null,
    prestadorInscricaoMunicipal: empresa?.inscricaoMunicipal || null,
    prestadorEndereco: endereco
      ? {
        logradouro: endereco?.logradouro ?? null,
        numero: endereco?.numero ?? null,
        codigoCidade: endereco?.codigoCidade != null ? String(endereco.codigoCidade) : null,
        cep: endereco?.cep ?? null,
        complemento: endereco?.complemento ?? null,
        bairro: endereco?.bairro ?? null,
        estado: endereco?.estado ?? null,
        descricaoCidade: endereco?.descricaoCidade ?? null,
      }
      : null,
  };
}

/** @param {Record<string, unknown>} prefill */
export function isNfsePrestadorPrefillEffectivelyEmpty(prefill) {
  const cnpj = onlyDigits(prefill?.prestadorCpfCnpj || '');
  if (cnpj.length >= 11) return false;
  if (String(prefill?.prestadorRazaoSocial ?? '').trim()) return false;
  if (String(prefill?.prestadorEmail ?? '').trim()) return false;
  if (String(prefill?.prestadorInscricaoMunicipal ?? '').trim()) return false;
  const e = prefill?.prestadorEndereco;
  if (e && typeof e === 'object') {
    const parts = [
      e.logradouro, e.numero, e.codigoCidade, e.cep,
      e.complemento, e.bairro, e.estado, e.descricaoCidade,
    ];
    if (parts.some((x) => String(x ?? '').trim() !== '')) return false;
  }
  return true;
}

/** @param {string|null|undefined} certDocumento @param {Record<string, unknown>} prefill */
export function isPrestadorPrefillStaleForCert(certDocumento, prefill) {
  const cert = onlyDigits(certDocumento || '');
  const pre = onlyDigits(prefill?.prestadorCpfCnpj || '');
  return cert.length === 14 && pre.length === 14 && cert !== pre;
}

function takePrestadorField(current, incoming, onlyFillEmpty) {
  const c = String(current ?? '').trim();
  const inc = incoming == null || incoming === '' ? '' : String(incoming).trim();
  if (!inc) return String(current ?? '');
  if (onlyFillEmpty && c !== '') return c;
  return inc;
}

function resolvePrefillCnpjMerge(currentMasked, prefillDigits, onlyFillEmpty) {
  let nextCnpj = String(currentMasked ?? '');
  if (prefillDigits.length !== 14) {
    return { nextCnpj, cnpjUpdated: false };
  }
  const curDigits = onlyDigits(nextCnpj);
  if (!onlyFillEmpty || !curDigits) {
    nextCnpj = maskCpfCnpj(prefillDigits);
    return { nextCnpj, cnpjUpdated: curDigits !== prefillDigits };
  }
  if (curDigits && curDigits !== prefillDigits) {
    nextCnpj = maskCpfCnpj(prefillDigits);
    return { nextCnpj, cnpjUpdated: true };
  }
  return { nextCnpj, cnpjUpdated: false };
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} prefill
 * @param {{ onlyFillEmpty?: boolean }} [options]
 */
export function mergeNfsePrestadorPrefillIntoForm(current, prefill, options = {}) {
  const onlyFillEmpty = options.onlyFillEmpty !== false;
  const pec = current.prestadorEndereco ?? {};
  const pen = prefill?.prestadorEndereco ?? null;

  const preCnpjDigits = onlyDigits(prefill?.prestadorCpfCnpj || '');
  const { nextCnpj, cnpjUpdated } = resolvePrefillCnpjMerge(
    current.prestadorCpfCnpj ?? '',
    preCnpjDigits,
    onlyFillEmpty,
  );
  const fieldOnlyFillEmpty = onlyFillEmpty && !cnpjUpdated;

  let nextIm = current.prestadorInscricaoMunicipal;
  if (prefill?.prestadorInscricaoMunicipal != null && prefill.prestadorInscricaoMunicipal !== '') {
    const cur = String(nextIm ?? '').trim();
    if (!fieldOnlyFillEmpty || cur === '') nextIm = String(prefill.prestadorInscricaoMunicipal).trim();
  }

  const nextRazao = takePrestadorField(
    current.prestadorRazaoSocial,
    prefill?.prestadorRazaoSocial,
    fieldOnlyFillEmpty,
  );
  const nextEmail = takePrestadorField(
    current.prestadorEmail,
    prefill?.prestadorEmail,
    fieldOnlyFillEmpty,
  );

  const cepDigits = pen?.cep != null && String(pen.cep).trim() !== ''
    ? onlyDigits(String(pen.cep)).slice(0, 8)
    : '';
  const curCep = onlyDigits(String(pec.cep ?? '')).slice(0, 8);
  const nextCepRaw = cepDigits.length === 8 && (!fieldOnlyFillEmpty || curCep.length === 0)
    ? cepDigits
    : onlyDigits(String(pec.cep ?? '')).slice(0, 8);
  const nextCep = nextCepRaw ? maskCep(nextCepRaw) : '';

  const nextEstadoRaw = pen?.estado != null ? String(pen.estado).trim().toUpperCase().slice(0, 2) : '';
  const curEst = String(pec.estado ?? '').trim();
  const nextEstado = nextEstadoRaw && (!fieldOnlyFillEmpty || curEst === '')
    ? nextEstadoRaw
    : (pec.estado ?? '');

  const nextEndereco = {
    logradouro: takePrestadorField(pec.logradouro, pen?.logradouro, fieldOnlyFillEmpty),
    numero: takePrestadorField(pec.numero, pen?.numero, fieldOnlyFillEmpty),
    codigoCidade: takePrestadorField(pec.codigoCidade, pen?.codigoCidade, fieldOnlyFillEmpty),
    cep: nextCep,
    complemento: takePrestadorField(pec.complemento, pen?.complemento, fieldOnlyFillEmpty),
    bairro: takePrestadorField(pec.bairro, pen?.bairro, fieldOnlyFillEmpty),
    estado: nextEstado,
    descricaoCidade: takePrestadorField(pec.descricaoCidade, pen?.descricaoCidade, fieldOnlyFillEmpty),
  };

  return {
    ...current,
    prestadorCpfCnpj: nextCnpj,
    ...(nextIm !== undefined && nextIm !== '' ? { prestadorInscricaoMunicipal: nextIm } : {}),
    ...(nextRazao ? { prestadorRazaoSocial: nextRazao } : {}),
    ...(nextEmail ? { prestadorEmail: nextEmail } : {}),
    prestadorEndereco: nextEndereco,
  };
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} prefill
 * @param {{ inscricaoEstadual?: string|null }} [extras]
 * @param {{ onlyFillEmpty?: boolean }} [options]
 */
export function mergeNfeEmitentePrefillIntoForm(current, prefill, extras = {}, options = {}) {
  const onlyFillEmpty = options.onlyFillEmpty !== false;
  const preCnpjDigits = onlyDigits(prefill?.prestadorCpfCnpj || '');
  const { nextCnpj, cnpjUpdated } = resolvePrefillCnpjMerge(
    current.emitenteCpfCnpj ?? '',
    preCnpjDigits,
    onlyFillEmpty,
  );
  const razaoOnlyFillEmpty = onlyFillEmpty && !cnpjUpdated;

  const nextRazao = takePrestadorField(
    current.emitenteRazaoSocial,
    prefill?.prestadorRazaoSocial,
    razaoOnlyFillEmpty,
  );

  let nextIe = String(current.emitenteInscricaoEstadual ?? '');
  const ieRaw = extras.inscricaoEstadual != null ? String(extras.inscricaoEstadual).trim() : '';
  if (ieRaw && (!onlyFillEmpty || !nextIe.trim() || cnpjUpdated)) {
    nextIe = ieRaw;
  }

  return {
    ...current,
    emitenteCpfCnpj: nextCnpj,
    emitenteRazaoSocial: nextRazao,
    ...(nextIe ? { emitenteInscricaoEstadual: nextIe } : {}),
  };
}
