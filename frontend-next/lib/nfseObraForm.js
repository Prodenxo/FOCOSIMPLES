/** NFS-e — dados da obra (E0370). Port de frontend/lib/nfseObraForm.ts */

const NFSE_OBRA_REQUIRED_LC116_KEYS = new Set([
  '070201', '070202', '070401', '070501', '070502', '070601', '070602',
  '070701', '070801', '071701', '071901', '141403', '141404',
]);

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

export function normalizeNfseServicoCodigoKey(codigo) {
  const digits = normalizeDoc(String(codigo ?? ''));
  if (!digits) return '';
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.padStart(6, '0');
}

export function requiresNfseObraForServicoCodigo(codigo) {
  return NFSE_OBRA_REQUIRED_LC116_KEYS.has(normalizeNfseServicoCodigoKey(codigo));
}

export function getDefaultNfseObraForm() {
  return {
    usarEnderecoTomador: true,
    cno: '',
    cei: '',
    art: '',
    codigoObra: '',
    endereco: {
      logradouro: '',
      numero: '',
      codigoCidade: '',
      cep: '',
      complemento: '',
      bairro: '',
      estado: '',
      descricaoCidade: '',
    },
  };
}

export function resolveNfseObraEnderecoForValidation(obra, tomadorEndereco) {
  if (obra?.usarEnderecoTomador !== false) {
    return { ...getDefaultNfseObraForm().endereco, ...(tomadorEndereco || {}) };
  }
  return { ...getDefaultNfseObraForm().endereco, ...(obra?.endereco || {}) };
}

export function getNfseObraValidationMessage(codigo, obra, tomadorEndereco) {
  if (!requiresNfseObraForServicoCodigo(codigo)) return null;
  const end = resolveNfseObraEnderecoForValidation(obra, tomadorEndereco);
  if (!String(end.logradouro ?? '').trim()) return 'Informe o logradouro da obra.';
  if (!String(end.numero ?? '').trim()) return 'Informe o número do endereço da obra.';
  if (!String(end.bairro ?? '').trim()) return 'Informe o bairro da obra.';
  if (normalizeDoc(end.cep).length !== 8) return 'Informe um CEP válido da obra (8 dígitos).';
  if (!String(end.codigoCidade ?? '').trim()) return 'Informe o código IBGE da cidade da obra.';
  if (!String(end.descricaoCidade ?? '').trim()) return 'Informe a cidade da obra.';
  if (String(end.estado ?? '').trim().length !== 2) return 'Informe a UF da obra (2 letras).';
  return null;
}
