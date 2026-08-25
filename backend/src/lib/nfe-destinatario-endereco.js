/**
 * Enriquece endereço do destinatário NF-e via CEP (IBGE/UF/cidade corretos).
 */
import { lookupCepBrasilApi, lookupCepViaCep } from '../services/cnpj-lookup.service.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

const padIbge = (value) => {
  const digits = onlyDigits(value, 7);
  if (digits.length !== 7) return '';
  return digits.padStart(7, '0');
};

/**
 * @param {Record<string, unknown> | null | undefined} endereco
 * @returns {Promise<Record<string, string>>}
 */
export const enrichDestinatarioEnderecoForNfeEmit = async (endereco) => {
  const base = endereco && typeof endereco === 'object' && !Array.isArray(endereco)
    ? { ...endereco }
    : {};
  const cep = onlyDigits(base.cep, 8);
  if (cep.length !== 8) return base;

  const brasil = await lookupCepBrasilApi(cep);
  const via = brasil ? null : await lookupCepViaCep(cep);

  const ibge = padIbge(brasil?.city_ibge_code)
    || padIbge(via?.ibge)
    || padIbge(base.codigoCidade);

  return {
    ...base,
    cep,
    logradouro: String(base.logradouro || brasil?.street || via?.logradouro || '').trim(),
    numero: String(base.numero || '').trim() || 'S/N',
    bairro: String(base.bairro || brasil?.neighborhood || via?.bairro || '').trim(),
    descricaoCidade: String(
      base.descricaoCidade || base.cidade || brasil?.city || via?.localidade || '',
    ).trim(),
    estado: String(base.estado || base.uf || brasil?.state || via?.uf || '')
      .trim()
      .toUpperCase()
      .slice(0, 2),
    ...(ibge ? { codigoCidade: ibge } : {}),
  };
};
