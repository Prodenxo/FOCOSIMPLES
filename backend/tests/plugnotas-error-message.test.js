import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildErrorMessageFromBody,
  messageFromPlugnotasParsedBody
} from '../src/services/plugnotas/plugnotas-error-message.js';

test('buildErrorMessageFromBody concatena message com errors', () => {
  const msg = buildErrorMessageFromBody({
    message: 'Falha na validação do JSON de Empresa',
    errors: [{ field: 'endereco.logradouro', error: 'muito curto' }]
  });
  assert.match(msg, /Falha na validação do JSON de Empresa/);
  assert.match(msg, /endereco\.logradouro/);
  assert.match(msg, /muito curto/);
});

test('buildErrorMessageFromBody aceita errors como mapa por campo', () => {
  const msg = buildErrorMessageFromBody({
    message: 'Erro',
    errors: { 'endereco.cep': ['CEP inválido'] }
  });
  assert.match(msg, /endereco\.cep/);
  assert.match(msg, /CEP inválido/);
});

/** Formato adicional: detalhes somente em error.data (mapa campo -> mensagens), comum em APIs REST. */
test('buildErrorMessageFromBody agrega error.data com chaves de campo (nao apenas data.fields)', () => {
  const msg = buildErrorMessageFromBody({
    message: 'Falha na validação do JSON',
    error: {
      code: 'VALIDATION_ERROR',
      data: {
        'tomador.cpfCnpj': ['campo obrigatório'],
        prestador: { endereco: { cep: ['deve conter 8 dígitos'] } }
      }
    }
  });
  assert.match(msg, /Falha na validação do JSON/);
  assert.match(msg, /tomador\.cpfCnpj/);
  assert.match(msg, /campo obrigatório/);
  assert.match(msg, /prestador\.endereco\.cep/);
  assert.match(msg, /8 dígitos/);
});

/** violations / issues em nivel raiz (ex.: Bean Validation style). */
test('buildErrorMessageFromBody agrega violations e issues', () => {
  const fromViolations = buildErrorMessageFromBody({
    message: 'Falha na validação do JSON',
    violations: [{ field: 'emitente.cpfCnpj', message: 'CNPJ inválido' }]
  });
  assert.match(fromViolations, /emitente\.cpfCnpj/);
  assert.match(fromViolations, /CNPJ inválido/);

  const fromIssues = buildErrorMessageFromBody({
    message: 'Erro',
    issues: ['discriminacao: muito curta']
  });
  assert.match(fromIssues, /discriminacao/);
});

/** data raiz com errors aninhados (alguns gateways retornam assim). */
test('buildErrorMessageFromBody agrega payload.data com erros', () => {
  const msg = buildErrorMessageFromBody({
    message: 'Request inválido',
    data: {
      errors: [{ field: 'itens[0].ncm', error: 'NCM inválido' }]
    }
  });
  assert.match(msg, /itens\[0\]\.ncm/);
  assert.match(msg, /NCM inválido/);
});

test('messageFromPlugnotasParsedBody alinha com buildErrorMessageFromBody (paridade NFSe / parsePlugnotasErrorResponse)', () => {
  const payload = {
    message: 'Falha na validação do JSON',
    errors: [{ field: 'x', error: 'y' }]
  };
  assert.equal(
    messageFromPlugnotasParsedBody(payload, 'Bad Request'),
    buildErrorMessageFromBody(payload, 'Bad Request')
  );
  assert.equal(messageFromPlugnotasParsedBody('texto puro', 'ST'), 'texto puro');
});
