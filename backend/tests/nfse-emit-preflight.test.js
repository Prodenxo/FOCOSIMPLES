import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNfseEmitPreflight } from '../src/services/nfse-emit-preflight.js';
import { assembleNfsePlugnotasEmitPayload } from '../src/services/nfse-emit-payload-assembler.js';

test('validateNfseEmitPreflight: Ribeirão exige NBS e cIndOp', () => {
  const result = validateNfseEmitPreflight({
    servico: [{ codigo: '071601', iss: { aliquota: 2 } }],
  }, { codigoIbge: '3543402' });
  assert.ok(result.errors.some((e) => e.includes('NBS')));
  assert.ok(result.errors.some((e) => e.includes('cIndOp')));
});

test('assembleNfsePlugnotasEmitPayload: WPM 071601 inclui codigoTributacao 001', () => {
  const out = assembleNfsePlugnotasEmitPayload({
    prestador: { endereco: { codigoCidade: '3543402' } },
    tomador: {
      endereco: {
        codigoCidade: '3543402',
        descricaoCidade: 'RIBEIRAO PRETO',
        cep: '14092210',
        logradouro: 'R DOUTOR ANTONIO CARLOS TINOCO',
        numero: '780',
        bairro: 'JARDIM ANHANGUERA',
        estado: 'SP',
      },
    },
    servico: [{
      codigo: '071601',
      codigoNbs: '119011000',
      cIndOp: '020201',
      cnae: '4222701',
      iss: { aliquota: 2 },
    }],
  }, {
    codigoIbge: '3543402',
    obraContext: { servicosInput: [{ codigo: '071601', obra: { usarEnderecoTomador: true } }] },
  });
  assert.equal(out.servico[0].codigoTributacao, '001');
});
