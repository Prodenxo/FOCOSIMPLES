/**
 * Formulário e validação de "Dados da obra" na NFS-e (E0370).
 */

import { normalizeCodigoServicoInput } from './meiCatalogoProdutoForm';
import type { EmitirNfseInput } from '../services/meiNotasService';
import {
  getDefaultNfeDestinatarioEndereco,
  getDestinatarioEnderecoValidationMessage,
  type NfeDestinatarioEnderecoForm,
} from './meiNfeDestinatarioEndereco';

/** Subitens LC 116 que exigem grupo obra (espelha backend). */
const NFSE_OBRA_REQUIRED_LC116_KEYS = new Set([
  '070201', '070202',
  '070401',
  '070501', '070502',
  '070601', '070602',
  '070701',
  '070801',
  '071701',
  '071901',
  '141403', '141404',
]);

const normalizeDoc = (value: string) => value.replace(/\D/g, '');

export const normalizeNfseServicoCodigoKey = (codigo: unknown): string => {
  const digits = normalizeDoc(String(codigo ?? ''));
  if (!digits) return '';
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.padStart(6, '0');
};

export const requiresNfseObraForServicoCodigo = (codigo: unknown): boolean => (
  NFSE_OBRA_REQUIRED_LC116_KEYS.has(normalizeNfseServicoCodigoKey(codigo))
);

export type NfseObraEnderecoForm = NfeDestinatarioEnderecoForm;

export interface NfseObraForm {
  /** Default true — usa endereço do tomador como local da obra. */
  usarEnderecoTomador?: boolean;
  cno?: string;
  cei?: string;
  art?: string;
  codigoObra?: string;
  endereco?: NfseObraEnderecoForm;
}

export const getDefaultNfseObraForm = (): NfseObraForm => ({
  usarEnderecoTomador: true,
  cno: '',
  cei: '',
  art: '',
  codigoObra: '',
  endereco: getDefaultNfeDestinatarioEndereco(),
});

export const buildNfseObraFormFromTomadorEndereco = (
  tomadorEndereco?: EmitirNfseInput['tomadorEndereco'],
): NfseObraForm => ({
  ...getDefaultNfseObraForm(),
  usarEnderecoTomador: true,
  endereco: {
    ...getDefaultNfeDestinatarioEndereco(),
    ...(tomadorEndereco || {}),
  },
});

export const resolveNfseObraEnderecoForValidation = (
  obra: NfseObraForm | undefined,
  tomadorEndereco?: EmitirNfseInput['tomadorEndereco'],
): NfseObraEnderecoForm => {
  if (obra?.usarEnderecoTomador !== false) {
    return {
      ...getDefaultNfeDestinatarioEndereco(),
      ...(tomadorEndereco || {}),
    };
  }
  return {
    ...getDefaultNfeDestinatarioEndereco(),
    ...(obra?.endereco || {}),
  };
};

export const getNfseObraValidationMessage = (
  codigo: unknown,
  obra: NfseObraForm | undefined,
  tomadorEndereco?: EmitirNfseInput['tomadorEndereco'],
): string | null => {
  if (!requiresNfseObraForServicoCodigo(codigo)) return null;

  const endereco = resolveNfseObraEnderecoForValidation(obra, tomadorEndereco);
  const enderecoMsg = getDestinatarioEnderecoValidationMessage(endereco, 'obra');
  if (enderecoMsg) return enderecoMsg.replace('destinatário', 'obra').replace('Destinatário', 'Obra');

  return null;
};

export const mergeObraWhenServicoRequires = (
  servico: EmitirNfseInput['servico'],
  tomadorEndereco?: EmitirNfseInput['tomadorEndereco'],
): EmitirNfseInput['servico'] => {
  const codigo = servico?.codigo;
  if (!requiresNfseObraForServicoCodigo(codigo)) {
    const { obra: _removed, ...rest } = servico || { codigo: '', discriminacao: '', cnae: '', valorServico: '' };
    return rest as EmitirNfseInput['servico'];
  }
  const currentObra = servico?.obra ?? getDefaultNfseObraForm();
  return {
    ...servico!,
    codigo: normalizeCodigoServicoInput(String(codigo ?? '')) || servico?.codigo,
    obra: {
      ...currentObra,
      endereco: currentObra.usarEnderecoTomador !== false
        ? buildNfseObraFormFromTomadorEndereco(tomadorEndereco).endereco
        : {
            ...getDefaultNfeDestinatarioEndereco(),
            ...(currentObra.endereco || {}),
          },
    },
  };
};
