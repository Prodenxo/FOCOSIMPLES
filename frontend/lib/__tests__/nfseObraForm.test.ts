import { describe, expect, it } from '@jest/globals';
import {
  getNfseObraValidationMessage,
  mergeObraWhenServicoRequires,
  requiresNfseObraForServicoCodigo,
} from '../nfseObraForm';

describe('nfseObraForm', () => {
  it('detecta código 070602 como obra obrigatória', () => {
    expect(requiresNfseObraForServicoCodigo('070602')).toBe(true);
    expect(requiresNfseObraForServicoCodigo('140101')).toBe(false);
  });

  it('valida endereço da obra via tomador', () => {
    const msg = getNfseObraValidationMessage('070602', { usarEnderecoTomador: true }, {
      cep: '14000000',
      logradouro: 'Rua A',
      numero: '10',
      bairro: 'Centro',
      codigoCidade: '3543402',
      estado: 'SP',
      descricaoCidade: 'Ribeirão Preto',
    });
    expect(msg).toBeNull();
  });

  it('mergeObraWhenServicoRequires copia endereço do tomador', () => {
    const merged = mergeObraWhenServicoRequires(
      { codigo: '070602', discriminacao: 'Gesso', cnae: '4330403', valorServico: '100' },
      {
        cep: '14000000',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        codigoCidade: '3543402',
        estado: 'SP',
      },
    );
    expect(merged?.obra?.endereco?.logradouro).toBe('Rua A');
  });
});
