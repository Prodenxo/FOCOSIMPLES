import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('mei-notas valida payload de emissao antes de integrar', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      servico: {
        codigo: '010101',
        cnae: '6201500',
        discriminacao: 'Servico teste',
        aliquota: 2,
        valorServico: 100
      }
    }),
    /CNPJ do prestador é obrigatório/
  );
});

test('mei-notas normaliza payload.servico objeto unico antes da validacao', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      payload: {
        servico: {
          codigo: '010101',
          cnae: '6201500',
          discriminacao: 'Servico teste',
          aliquota: 2,
          valor: { servico: 100 }
        }
      }
    }),
    /CNPJ do prestador é obrigatório/
  );
});

test('mei-notas rejeita tomador com documento invalido', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      prestadorCpfCnpj: '12345678000199',
      prestadorEndereco: {
        logradouro: 'Rua Teste',
        numero: '123',
        codigoCidade: '3304557',
        cep: '20040002'
      },
      tomadorCpfCnpj: '12345',
      servico: {
        codigo: '010101',
        cnae: '6201500',
        discriminacao: 'Servico teste',
        aliquota: 2,
        valorServico: 100
      }
    }),
    /CPF\/CNPJ do tomador inválido/
  );
});

test('mei-notas exige documento do tomador na emissao NFSe', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      prestadorCpfCnpj: '12345678000199',
      prestadorEndereco: {
        logradouro: 'Rua Teste',
        numero: '123',
        codigoCidade: '3304557',
        cep: '20040002'
      },
      tomadorRazaoSocial: 'Cliente teste',
      servico: {
        codigo: '010101',
        cnae: '6201500',
        discriminacao: 'Servico teste',
        aliquota: 2,
        valorServico: 100
      }
    }),
    /CPF\/CNPJ do tomador é obrigatório/
  );
});

test('mei-notas exige razao social do tomador na emissao NFSe', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      prestadorCpfCnpj: '12345678000199',
      prestadorEndereco: {
        logradouro: 'Rua Teste',
        numero: '123',
        codigoCidade: '3304557',
        cep: '20040002'
      },
      tomadorCpfCnpj: '12345678901',
      servico: {
        codigo: '010101',
        cnae: '6201500',
        discriminacao: 'Servico teste',
        aliquota: 2,
        valorServico: 100
      }
    }),
    /Razão social do tomador é obrigatória/
  );
});

test('mei-notas exige endereco minimo do prestador na emissao NFSe', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      prestadorCpfCnpj: '12345678000199',
      tomadorCpfCnpj: '12345678901',
      tomadorRazaoSocial: 'Cliente teste',
      servico: {
        codigo: '010101',
        cnae: '6201500',
        discriminacao: 'Servico teste',
        aliquota: 2,
        valorServico: 100
      }
    }),
    /Logradouro do prestador é obrigatório/
  );
});

test('mei-notas valida endereco do prestador e segue para regras do servico', async () => {
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
        codigo: '010101',
        cnae: '',
        discriminacao: '',
        aliquota: 2,
        valorServico: 100
      }
    }),
    /Serviço da NFSe está incompleto/
  );
});

test('mei-notas rejeita webhook sem identificadores', async () => {
  const { processarWebhook } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => processarWebhook({}),
    /Webhook sem identificadores da nota fiscal/
  );
});

test('mei-notas rejeita atualização sem campos editáveis', async () => {
  const { atualizarNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => atualizarNota('user-1', 'nfse-1', {}),
    /Informe ao menos um campo editável/
  );
});

test('mei-notas rejeita operações sem ID', async () => {
  const { atualizarNota, cancelarNota, arquivarNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => atualizarNota('user-1', '', { descricaoInterna: 'teste' }),
    /ID da nota fiscal é obrigatório/
  );
  await assert.rejects(
    () => cancelarNota('user-1', '', {}),
    /ID da nota fiscal é obrigatório/
  );
  await assert.rejects(
    () => arquivarNota('user-1', '', {}),
    /ID da nota fiscal é obrigatório/
  );
});

test('mei-notas rejeita documentType inválido', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      documentType: 'ABC',
      payload: {}
    }),
    /documentType inválido/
  );
});

test('mei-notas valida payload mínimo para NFe e NFCe', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      documentType: 'NFE',
      payload: {
        emitente: { cpfCnpj: '12345678000199' }
      }
    }),
    /CPF\/CNPJ do destinatário da NF-e é obrigatório/
  );

  await assert.rejects(
    () => emitirNota('user-1', {
      documentType: 'NFE',
      payload: {
        emitente: { cpfCnpj: '12345678000199' },
        destinatario: { cpfCnpj: '12345678901', razaoSocial: 'Cliente teste' }
      }
    }),
    /Itens da NF-e são obrigatórios/
  );

  await assert.rejects(
    () => emitirNota('user-1', {
      documentType: 'NFCE',
      payload: {
        emitente: { cpfCnpj: '12345678000199' },
        itens: [{ codigo: 'A1', descricao: 'Produto', valor: 10 }],
        destinatario: { cpfCnpj: '123' }
      }
    }),
    /CPF\/CNPJ do destinatário da NFC-e inválido/
  );
});

test('mei-notas valida campos fiscais mínimos de item para NFe/NFCe', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      documentType: 'NFE',
      payload: {
        emitente: { cpfCnpj: '12345678000199' },
        destinatario: { cpfCnpj: '12345678901', razaoSocial: 'Cliente teste' },
        itens: [
          {
            codigo: 'A1',
            descricao: 'Produto teste',
            cfop: '5102',
            quantidade: 1,
            valorUnitario: 10,
            tributos: {
              icms: { cst: '00', aliquota: 18, valor: 1.8 },
              pis: { cst: '01' },
              cofins: { cst: '01' }
            }
          }
        ]
      }
    }),
    /Item 1 da NF-e: NCM deve ter 8 dígitos/
  );

  await assert.rejects(
    () => emitirNota('user-1', {
      documentType: 'NFCE',
      payload: {
        emitente: { cpfCnpj: '12345678000199' },
        destinatario: { cpfCnpj: '12345678901', razaoSocial: 'Consumidor teste' },
        itens: [
          {
            codigo: 'B1',
            descricao: 'Produto teste',
            ncm: '12345678',
            cfop: '5102',
            unidade: 'UN',
            quantidade: 1,
            valorUnitario: 20,
            tributos: {
              icms: { aliquota: 18, valor: 3.6 },
              pis: { cst: '01' },
              cofins: { cst: '01' }
            }
          }
        ]
      }
    }),
    /Item 1 da NFC-e: informe CST ou CSOSN do ICMS/
  );
});

test('mei-notas extrai plugnotas_id e idIntegracao de resposta com data array', async () => {
  const { extractPlugNotasId, extractIntegracaoId } = await import('../src/services/mei-notas.service.js');
  const response = { data: [{ id: 'id-123', idIntegracao: 'int-1' }] };
  assert.equal(extractPlugNotasId(response), 'id-123');
  assert.equal(extractIntegracaoId(response), 'int-1');
});

test('mei-notas extrai plugnotas_id de resposta com data objeto único', async () => {
  const { extractPlugNotasId } = await import('../src/services/mei-notas.service.js');
  const response = { data: { id: 'id-456' } };
  assert.equal(extractPlugNotasId(response), 'id-456');
});

test('mei-notas valida coerência de modelo por documentType', async () => {
  const { emitirNota } = await import('../src/services/mei-notas.service.js');

  await assert.rejects(
    () => emitirNota('user-1', {
      documentType: 'NFE',
      payload: {
        modelo: '65',
        emitente: { cpfCnpj: '12345678000199' },
        destinatario: { cpfCnpj: '12345678901', razaoSocial: 'Cliente teste' },
        itens: [
          {
            codigo: 'A1',
            descricao: 'Produto teste',
            ncm: '12345678',
            cfop: '5102',
            unidade: 'UN',
            quantidade: 1,
            valorUnitario: 10,
            tributos: {
              icms: { cst: '00' },
              pis: { cst: '01' },
              cofins: { cst: '01' }
            }
          }
        ]
      }
    }),
    /Modelo inválido para NF-e. Informe 55/
  );

  await assert.rejects(
    () => emitirNota('user-1', {
      documentType: 'NFCE',
      payload: {
        modelo: '55',
        emitente: { cpfCnpj: '12345678000199' },
        destinatario: { cpfCnpj: '12345678901', razaoSocial: 'Consumidor teste' },
        itens: [
          {
            codigo: 'A1',
            descricao: 'Produto teste',
            ncm: '12345678',
            cfop: '5102',
            unidade: 'UN',
            quantidade: 1,
            valorUnitario: 10,
            tributos: {
              icms: { cst: '00' },
              pis: { cst: '01' },
              cofins: { cst: '01' }
            }
          }
        ]
      }
    }),
    /Modelo inválido para NFC-e. Informe 65/
  );
});

test('mei-notas: emissao NFE bloqueada quando MEI_NFE_NFCE_EMIT_ENABLED=false (FR-GUIA-FISC-16)', async () => {
  const prev = process.env.MEI_NFE_NFCE_EMIT_ENABLED;
  process.env.MEI_NFE_NFCE_EMIT_ENABLED = 'false';
  try {
    const { emitirNota } = await import('../src/services/mei-notas.service.js');
    await assert.rejects(
      () =>
        emitirNota('user-1', {
          documentType: 'NFE',
          payload: {}
        }),
      (err) => err.status === 403 && /indispon/i.test(String(err.message))
    );
  } finally {
    if (prev === undefined) {
      delete process.env.MEI_NFE_NFCE_EMIT_ENABLED;
    } else {
      process.env.MEI_NFE_NFCE_EMIT_ENABLED = prev;
    }
  }
});
