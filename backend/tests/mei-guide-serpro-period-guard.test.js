import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSerproDasPeriodoDisponivel,
  isPeriodoIndisponivelSerproMessage,
  isPeriodoPagoSerproMessage,
  MEI_DAS_PERIODO_INDISPONIVEL_CODE
} from '../src/services/mei-guide-serpro-period-guard.js';

test('MSG_23018 com pagamento efetuado é pago, não indisponível', () => {
  const msg =
    'Requisição efetuada com sucesso. 23018-Já foi efetuado pagamento para este PA. Não será gerado DAS.';
  assert.equal(isPeriodoPagoSerproMessage(msg), true);
  assert.equal(isPeriodoIndisponivelSerproMessage(msg), false);
});

test('mensagem liquidado é tratada como pago', () => {
  assert.equal(isPeriodoPagoSerproMessage('Período liquidado na Receita Federal'), true);
});

test('isSerproUnavailableError detecta código MEI_GUIDE_SERPRO_UNAVAILABLE', async () => {
  const { isSerproUnavailableError } = await import('../src/services/mei-guide-serpro-period-guard.js');
  const { serviceUnavailable } = await import('../src/utils/errors.js');
  const { MEI_GUIDE_SERPRO_UNAVAILABLE } = await import('../src/constants/mei-guide-error-codes.js');
  const err = serviceUnavailable('O serviço da Receita Federal está temporariamente indisponível.', {
    code: MEI_GUIDE_SERPRO_UNAVAILABLE
  });
  assert.equal(isSerproUnavailableError(err), true);
});

test('assertSerproDasPeriodoDisponivel lança erro de pago para MSG_23018', () => {
  assert.throws(
    () => assertSerproDasPeriodoDisponivel({
      raw: {
        mensagens: [
          'Requisição efetuada com sucesso. 23018-Já foi efetuado pagamento para este PA. Não será gerado DAS.'
        ]
      }
    }, '03/2026'),
    (err) => {
      assert.match(String(err.message), /23018/i);
      assert.match(String(err.message), /pagamento/i);
      return true;
    }
  );
});

test('detecta contribuinte não optante (MSG_23008)', () => {
  assert.equal(
    isPeriodoIndisponivelSerproMessage('Contribuinte não optante pelo SIMEI'),
    true
  );
  assert.equal(
    isPeriodoIndisponivelSerproMessage('[EntradaIncorreta-PGMEI-MSG_23008]'),
    true
  );
});

test('assertSerproDasPeriodoDisponivel lança 400 com código MEI_DAS_PERIODO_INDISPONIVEL', () => {
  assert.throws(
    () => assertSerproDasPeriodoDisponivel({
      raw: {
        mensagens: ['[EntradaIncorreta-PGMEI-MSG_23008] Contribuinte não optante pelo SIMEI']
      }
    }, '02/2026'),
    (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.errors?.code, MEI_DAS_PERIODO_INDISPONIVEL_CODE);
      assert.match(String(err.message), /n[aã]o era optante/i);
      return true;
    }
  );
});
