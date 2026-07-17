import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('normalizeNfseServicoCodigoForLength remove mascara e mantem alfanumericos ASCII', async () => {
  const { normalizeNfseServicoCodigoForLength } = await import('../src/services/mei-notas.service.js');

  assert.equal(normalizeNfseServicoCodigoForLength('01.01'), '0101');
  assert.equal(normalizeNfseServicoCodigoForLength('12.34-56'), '123456');
  assert.equal(normalizeNfseServicoCodigoForLength('  Ab_9-x  '), 'Ab9x');
  assert.equal(normalizeNfseServicoCodigoForLength(''), '');
});

test('assertNfseServicoCodigosMinLength ignora item sem codigo ou codigo vazio', async () => {
  const { assertNfseServicoCodigosMinLength } = await import('../src/services/mei-notas.service.js');

  assert.doesNotThrow(() => assertNfseServicoCodigosMinLength({ servico: [{ id: 'x' }] }));
  assert.doesNotThrow(() => assertNfseServicoCodigosMinLength({ servico: [{ codigo: '' }] }));
  assert.doesNotThrow(() => assertNfseServicoCodigosMinLength({ servico: [{ codigo: '   ' }] }));
});

test('assertNfseServicoCodigosMinLength rejeita codigo curto apos normalizacao', async () => {
  const { assertNfseServicoCodigosMinLength } = await import('../src/services/mei-notas.service.js');

  assert.throws(
    () => assertNfseServicoCodigosMinLength({
      servico: [{ codigo: '01.01' }]
    }),
    (err) => err.status === 400
      && /pelo menos 6 caracteres alfanuméricos/.test(err.message)
      && /serviço 1/.test(err.message)
  );

  assert.throws(
    () => assertNfseServicoCodigosMinLength({
      servico: [{ codigo: '12345' }]
    }),
    (err) => err.status === 400
  );
});

test('assertNfseServicoCodigosMinLength aponta o indice correto com varios servicos', async () => {
  const { assertNfseServicoCodigosMinLength } = await import('../src/services/mei-notas.service.js');

  assert.throws(
    () => assertNfseServicoCodigosMinLength({
      servico: [
        { codigo: '010101' },
        { codigo: '01.01' }
      ]
    }),
    (err) => err.status === 400
      && /serviço 2/.test(err.message)
  );
});

test('assertNfseServicoCodigosMinLength permite codigo com 6 ou mais alfanumericos', async () => {
  const { assertNfseServicoCodigosMinLength } = await import('../src/services/mei-notas.service.js');

  assert.doesNotThrow(() => assertNfseServicoCodigosMinLength({
    servico: [{ codigo: '01.02.03' }]
  }));
  assert.doesNotThrow(() => assertNfseServicoCodigosMinLength({
    servico: [{ codigo: '123456' }]
  }));
});

test('mei-notas emitirNota NFSe rejeita codigo de servico com menos de 6 alfanumericos', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      prestadorCpfCnpj: '12345678000199',
      prestadorEndereco: {
        logradouro: 'Rua Teste',
        numero: '123',
        codigoCidade: '3304557',
        cep: '20040-002'
      },
      tomadorCpfCnpj: '12345678901',
      tomadorRazaoSocial: 'Cliente teste',
      servico: {
        codigo: '01.01',
        cnae: '6201500',
        discriminacao: 'Servico teste',
        aliquota: 2,
        valorServico: 100
      }
    }),
    /pelo menos 6 caracteres alfanuméricos/
  );
});
