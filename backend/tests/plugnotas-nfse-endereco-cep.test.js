import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTomadorEnderecoMissingUserMessage,
  enderecoFromCepLookupNfse,
  hasCompleteTomadorEndereco,
  listMissingTomadorEnderecoFields,
  resolveTomadorEmitEndereco,
} from '../src/services/plugnotas/plugnotas-nfse-email-resolve.js';

const CEP_21220290 = {
  cep: '21220290',
  state: 'RJ',
  city: 'Rio de Janeiro',
  neighborhood: 'Vila da Penha',
  street: 'Rua Merces',
  city_ibge_code: '3304557',
};

test('enderecoFromCepLookupNfse preenche endereço a partir do CEP', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (String(url).includes('/cep/v2/21220290')) {
      return {
        ok: true,
        async json() {
          return CEP_21220290;
        },
      };
    }
    throw new Error(`fetch inesperado: ${url}`);
  };

  const endereco = await enderecoFromCepLookupNfse('21220-290');
  assert.equal(endereco?.cep, '21220290');
  assert.equal(endereco?.logradouro, 'Rua Merces');
  assert.equal(endereco?.bairro, 'Vila da Penha');
  assert.equal(endereco?.descricaoCidade, 'Rio de Janeiro');
  assert.equal(endereco?.estado, 'RJ');
  assert.equal(endereco?.codigoCidade, '3304557');
});

test('resolveTomadorEmitEndereco completa PJ só com tomadorCep no payload', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (String(url).includes('/cep/v2/21220290')) {
      return {
        ok: true,
        async json() {
          return CEP_21220290;
        },
      };
    }
    return { ok: false, status: 404, async json() { return {}; } };
  };

  const endereco = await resolveTomadorEmitEndereco(
    'user-test',
    '12345678000199',
    { tomadorCep: '21220290' },
  );

  assert.ok(hasCompleteTomadorEndereco(endereco));
  assert.equal(endereco.numero, 'S/N');
});

test('enderecoFromCepLookupNfse usa ViaCEP quando BrasilAPI não traz IBGE', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/cep/v2/21221300')) {
      return {
        ok: true,
        async json() {
          return {
            cep: '21221300',
            state: 'RJ',
            city: 'Rio de Janeiro',
            neighborhood: 'Vila da Penha',
            street: 'Avenida Oliveira Belo',
          };
        },
      };
    }
    if (u.includes('viacep.com.br/ws/21221300')) {
      return {
        ok: true,
        async json() {
          return {
            cep: '21221-300',
            logradouro: 'Avenida Oliveira Belo',
            bairro: 'Vila da Penha',
            localidade: 'Rio de Janeiro',
            uf: 'RJ',
            ibge: '3304557',
          };
        },
      };
    }
    throw new Error(`fetch inesperado: ${url}`);
  };

  const endereco = await enderecoFromCepLookupNfse('21221300', { numero: '94 apt 101' });
  assert.equal(endereco?.codigoCidade, '3304557');
  assert.ok(hasCompleteTomadorEndereco(endereco));
});

test('enderecoFromCepLookupNfse usa tabela IBGE local quando APIs não trazem código', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/cep/v2/21221300')) {
      return {
        ok: true,
        async json() {
          return {
            cep: '21221300',
            state: 'RJ',
            city: 'Rio de Janeiro',
            neighborhood: 'Vila da Penha',
            street: 'Avenida Oliveira Belo',
          };
        },
      };
    }
    if (u.includes('viacep.com.br/ws/21221300')) {
      return {
        ok: true,
        async json() {
          return {
            cep: '21221-300',
            logradouro: 'Avenida Oliveira Belo',
            bairro: 'Vila da Penha',
            localidade: 'Rio de Janeiro',
            uf: 'RJ',
          };
        },
      };
    }
    throw new Error(`fetch inesperado: ${url}`);
  };

  const endereco = await enderecoFromCepLookupNfse('21221300', { numero: '94 apt 101' });
  assert.equal(endereco?.codigoCidade, '3304557');
  assert.ok(hasCompleteTomadorEndereco(endereco));
});

test('listMissingTomadorEnderecoFields detecta só IBGE em falta', () => {
  const endereco = {
    cep: '21221300',
    logradouro: 'Avenida Oliveira Belo',
    numero: '94 apt 101',
    bairro: 'Vila da Penha',
    descricaoCidade: 'Rio de Janeiro',
    estado: 'RJ',
  };
  assert.deepEqual(listMissingTomadorEnderecoFields(endereco), ['codigoCidade']);
  const msg = buildTomadorEnderecoMissingUserMessage('Taure', endereco);
  assert.match(msg, /IBGE/i);
  assert.match(msg, /Taure/);
});
