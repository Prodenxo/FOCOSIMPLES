import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPrefeituraIbgeOnlyBlockPolicy,
  isPrefeituraSomenteCodigoIbge,
  parsePrefeituraIbgeOnlyBlockCodes,
  PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_CODE,
  PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_MESSAGE
} from '../src/services/plugnotas/prefeituraIbgeOnlyBlock.js';

const origEn = process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED;
const origCodes = process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES;

test.afterEach(() => {
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED = origEn;
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES = origCodes;
});

test('parsePrefeituraIbgeOnlyBlockCodes ignora ruído e aceita vírgulas', () => {
  const s = parsePrefeituraIbgeOnlyBlockCodes(' 3550308 , 3304557;1234567');
  assert.equal(s.has('3550308'), true);
  assert.equal(s.has('3304557'), true);
  assert.equal(s.has('1234567'), true);
  assert.equal(s.size, 3);
});

test('isPrefeituraSomenteCodigoIbge — só IBGE ou login/senha vazios', () => {
  assert.equal(isPrefeituraSomenteCodigoIbge({ codigoIbge: '3550308' }), true);
  assert.equal(
    isPrefeituraSomenteCodigoIbge({ codigoIbge: '3550308', login: '', senha: '' }),
    true
  );
  assert.equal(isPrefeituraSomenteCodigoIbge({ codigoIbge: '3550308', login: 'x' }), false);
  assert.equal(isPrefeituraSomenteCodigoIbge({ codigoIbge: '3550308', foo: 'bar' }), false);
});

test('flag desligada — não bloqueia mesmo com lista', () => {
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED = 'false';
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES = '3550308';
  const payload = {
    nfse: {
      ativo: true,
      config: { producao: true, prefeitura: { codigoIbge: '3550308' } }
    }
  };
  assert.doesNotThrow(() => applyPrefeituraIbgeOnlyBlockPolicy(payload));
});

test('flag ligada e lista vazia — não bloqueia (sem falsos positivos globais)', () => {
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED = 'true';
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES = '';
  const payload = {
    nfse: {
      ativo: true,
      config: { producao: true, prefeitura: { codigoIbge: '3550308' } }
    }
  };
  assert.doesNotThrow(() => applyPrefeituraIbgeOnlyBlockPolicy(payload));
});

test('flag ligada — bloqueia IBGE na lista com prefeitura só codigoIbge', () => {
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED = 'true';
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES = '3550308';
  const payload = {
    nfse: {
      ativo: true,
      config: { producao: true, prefeitura: { codigoIbge: '3550308' } }
    }
  };
  assert.throws(
    () => applyPrefeituraIbgeOnlyBlockPolicy(payload),
    (err) =>
      err.status === 400
      && err.message === PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_MESSAGE
      && err.errors?.plugnotasCode === PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_CODE
  );
});

test('flag ligada — IBGE fora da lista deixa passar (trilho B)', () => {
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED = 'true';
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES = '3550308';
  const payload = {
    nfse: {
      ativo: true,
      config: { producao: true, prefeitura: { codigoIbge: '4106902' } }
    }
  };
  assert.doesNotThrow(() => applyPrefeituraIbgeOnlyBlockPolicy(payload));
});

test('nfse inativo — não aplica bloqueio', () => {
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED = 'true';
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES = '3550308';
  const payload = {
    nfse: {
      ativo: false,
      config: { producao: true, prefeitura: { codigoIbge: '3550308' } }
    }
  };
  assert.doesNotThrow(() => applyPrefeituraIbgeOnlyBlockPolicy(payload));
});
