import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.SERPRO_API_BASE_URL = process.env.SERPRO_API_BASE_URL || 'https://serpro.example';
process.env.SERPRO_OAUTH_TOKEN_URL = process.env.SERPRO_OAUTH_TOKEN_URL || 'https://serpro.example/oauth/token';
process.env.SERPRO_CONSUMER_KEY = process.env.SERPRO_CONSUMER_KEY || 'consumer-key';
process.env.SERPRO_CONSUMER_SECRET = process.env.SERPRO_CONSUMER_SECRET || 'consumer-secret';
process.env.SERPRO_OAUTH_TOKEN_NO_MTLS = process.env.SERPRO_OAUTH_TOKEN_NO_MTLS || 'true';

test('mei-guide usa cache local para marcar períodos pagos sem chamar SERPRO', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  let createCalls = 0;

  const items = await __buildPeriodsFromPdfForTests('user-1', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async ({ competencias }) => competencias,
    createGuideByCnpjFn: async () => {
      createCalls += 1;
      return {};
    }
  });

  assert.equal(createCalls, 0);
  assert.equal(items.length, 12);
  assert.equal(items.every((item) => item.status === 'pago'), true);
});

test('mei-guide classifica timeout da SERPRO como erro técnico no histórico', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  let persistedPaid = 0;

  const items = await __buildPeriodsFromPdfForTests('user-2', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    createGuideByCnpjFn: async () => {
      throw new Error('timeout de rede');
    },
    markCompetenciaAsPaidFn: async () => {
      persistedPaid += 1;
    }
  });

  assert.equal(persistedPaid, 0);
  assert.equal(items.length, 12);
  assert.equal(items.every((item) => item.status === 'erro'), true);
  assert.equal(items.every((item) => String(item.errorMessage || '').includes('timeout')), true);
});

test('mei-guide classifica erro de autorização como erro técnico', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  let persistedPaid = 0;

  const items = await __buildPeriodsFromPdfForTests('user-2b', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    createGuideByCnpjFn: async () => {
      throw new Error('Não autorizado pela Serpro');
    },
    markCompetenciaAsPaidFn: async () => {
      persistedPaid += 1;
    }
  });

  assert.equal(persistedPaid, 0);
  assert.equal(items.length, 12);
  assert.equal(items.every((item) => item.status === 'erro'), true);
  assert.equal(items.every((item) => String(item.errorMessage || '').toLowerCase().includes('não autorizado')), true);
});

test('mei-guide persiste pago quando erro indica período quitado', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  let persistedPaid = 0;

  const items = await __buildPeriodsFromPdfForTests('user-3', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    createGuideByCnpjFn: async () => {
      throw new Error('Guia já foi pago para o período');
    },
    markCompetenciaAsPaidFn: async () => {
      persistedPaid += 1;
    }
  });

  assert.equal(items.length, 12);
  assert.equal(items.every((item) => item.status === 'pago'), true);
  assert.equal(persistedPaid, items.length);
});

test('mei-guide marca indisponível quando SERPRO indica não optante', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  let persistedPaid = 0;

  const items = await __buildPeriodsFromPdfForTests('user-nao-opt', {
    cnpj: '65805583000173',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    createGuideByCnpjFn: async () => {
      const err = new Error('DAS MEI indisponível (02/2026): neste período a empresa ainda não era optante pelo Simples (MEI).');
      err.errors = { code: 'MEI_DAS_PERIODO_INDISPONIVEL' };
      throw err;
    },
    markCompetenciaAsPaidFn: async () => {
      persistedPaid += 1;
    }
  });

  assert.equal(persistedPaid, 0);
  assert.equal(items.filter((item) => item.status === 'indisponivel').length, 0);
  assert.equal(items.filter((item) => item.status === 'pago').length, 0);
});

test('mei-guide marca período como pago quando resposta vem sem PDF', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  let persistedPaid = 0;

  const items = await __buildPeriodsFromPdfForTests('user-3b', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    createGuideByCnpjFn: async () => {
      throw new Error('PDF do DAS não retornado');
    },
    markCompetenciaAsPaidFn: async () => {
      persistedPaid += 1;
    }
  });

  assert.equal(items.length, 12);
  assert.equal(items.every((item) => item.status === 'pago'), true);
  assert.equal(persistedPaid, items.length);
});

test('mei-guide consulta SERPRO na listagem (skipLocalPdf) e marca pago quando não há débito', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  const calls = [];

  const items = await __buildPeriodsFromPdfForTests('user-skip-local', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    createGuideByCnpjFn: async (_userId, payload) => {
      calls.push(payload);
      throw new Error('Não há débitos para o período informado');
    },
    markCompetenciaAsPaidFn: async () => {}
  });

  assert.equal(calls.length, 12);
  assert.equal(calls.every((payload) => payload?.skipLocalPdf === true), true);
  assert.equal(items.every((item) => item.status === 'pago'), true);
});

test('mei-guide marca pago quando SERPRO retorna MSG_23018', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  let persistedPaid = 0;

  const items = await __buildPeriodsFromPdfForTests('user-23018', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    createGuideByCnpjFn: async () => {
      throw new Error(
        'DAS MEI indisponível (03/2026): Requisição efetuada com sucesso. 23018-Já foi efetuado pagamento para este PA. Não será gerado DAS.'
      );
    },
    markCompetenciaAsPaidFn: async () => {
      persistedPaid += 1;
    }
  });

  assert.equal(items.every((item) => item.status === 'pago'), true);
  assert.equal(persistedPaid, items.length);
});

test('mei-guide classifica SERPRO indisponível como indisponivel após retentativas', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  const { serviceUnavailable } = await import('../src/utils/errors.js');
  const { MEI_GUIDE_SERPRO_UNAVAILABLE } = await import('../src/constants/mei-guide-error-codes.js');
  let calls = 0;

  const items = await __buildPeriodsFromPdfForTests('user-serpro-down', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    createGuideByCnpjFn: async () => {
      calls += 1;
      throw serviceUnavailable(
        'O serviço da Receita Federal está temporariamente indisponível. Tente novamente em alguns minutos.',
        { code: MEI_GUIDE_SERPRO_UNAVAILABLE }
      );
    },
    markCompetenciaAsPaidFn: async () => {}
  });

  // Períodos indisponíveis não entram na lista pública (filtro em buildPeriodsFromPdf).
  assert.equal(items.length, 0);
  assert.equal(calls, 12 * 3);
});

test('mei-guide usa status pago local quando SERPRO indisponível', async () => {
  const { __buildPeriodsFromPdfForTests } = await import('../src/services/mei-guide.service.js');
  const { serviceUnavailable } = await import('../src/utils/errors.js');
  const { MEI_GUIDE_SERPRO_UNAVAILABLE } = await import('../src/constants/mei-guide-error-codes.js');

  const items = await __buildPeriodsFromPdfForTests('user-serpro-fallback-pago', {
    cnpj: '12345678000199',
    useCertificate: false
  }, {
    listPaidCompetenciasFn: async () => [],
    getKnownCompetenciaPeriodStatusFn: async () => 'pago',
    createGuideByCnpjFn: async () => {
      throw serviceUnavailable('Receita indisponível', { code: MEI_GUIDE_SERPRO_UNAVAILABLE });
    },
    markCompetenciaAsPaidFn: async () => {}
  });

  assert.equal(items.length, 12);
  assert.equal(items.every((item) => item.status === 'pago'), true);
});

test('downloadGuide devolve PDF armazenado quando período já está pago', async () => {
  const { downloadGuide } = await import('../src/services/mei-guide.service.js');
  const stored = Buffer.from('%PDF-test').toString('base64');
  let createCalls = 0;

  const file = await downloadGuide({
    userId: 'user-4',
    cnpj: '12345678000199',
    periodoApuracao: '202601'
  }, {
    isCompetenciaPaidFn: async () => true,
    getDasBase64Fn: async () => stored,
    createGuideByCnpjFn: async () => {
      createCalls += 1;
      return null;
    }
  });

  assert.equal(createCalls, 0);
  assert.equal(file.filename, 'DAS-2026-01.pdf');
  assert.equal(file.buffer.toString(), '%PDF-test');
});

test('downloadGuide busca na SERPRO quando pago sem PDF armazenado', async () => {
  const { downloadGuide } = await import('../src/services/mei-guide.service.js');
  const storedPdf = Buffer.from('%PDF-new').toString('base64');
  let createCalls = 0;

  const file = await downloadGuide({
    userId: 'user-4b',
    cnpj: '12345678000199',
    // Competência ainda no prazo (vence dia 20 do mês seguinte) — evita regenerate.
    periodoApuracao: '202606'
  }, {
    isCompetenciaPaidFn: async () => true,
    getDasBase64Fn: async () => null,
    regenerateDasPdfFn: async () => null,
    createGuideByCnpjFn: async () => {
      createCalls += 1;
      return {
        pdfBase64: storedPdf,
        id: '202606',
        filename: 'das-mei-202606.pdf',
      };
    }
  });

  assert.equal(createCalls, 1);
  assert.equal(file.filename, 'das-mei-202606.pdf');
  assert.equal(file.buffer.toString(), '%PDF-new');
});

test('downloadGuide regenera PDF quando competência vencida e a pagar', async () => {
  const { downloadGuide } = await import('../src/services/mei-guide.service.js');
  const refreshedPdf = Buffer.from('%PDF-refreshed').toString('base64');
  let regenerateCalls = 0;
  let createCalls = 0;

  const file = await downloadGuide({
    userId: 'user-vencida',
    cnpj: '12345678000199',
    periodoApuracao: '202601',
  }, {
    isCompetenciaPaidFn: async () => false,
    getDasBase64Fn: async () => Buffer.from('%PDF-old').toString('base64'),
    regenerateDasPdfFn: async () => {
      regenerateCalls += 1;
      return {
        pdfBase64: refreshedPdf,
        filename: 'das-mei-202601.pdf',
        id: '202601',
      };
    },
    createGuideByCnpjFn: async () => {
      createCalls += 1;
      return null;
    },
  });

  assert.equal(regenerateCalls, 1);
  assert.equal(createCalls, 0);
  assert.equal(file.refreshed, true);
  assert.equal(file.vencida, true);
  assert.equal(file.buffer.toString(), '%PDF-refreshed');
});

test('downloadGuide persiste pago quando SERPRO retorna período quitado', async () => {
  const { downloadGuide } = await import('../src/services/mei-guide.service.js');
  let persistedPaid = 0;

  await assert.rejects(
    () => downloadGuide({
      userId: 'user-5',
      cnpj: '12345678000199',
      periodoApuracao: '202606'
    }, {
      isCompetenciaPaidFn: async () => false,
      getDasBase64Fn: async () => null,
      regenerateDasPdfFn: async () => null,
      createGuideByCnpjFn: async () => {
        throw new Error('Não há débitos para o período informado');
      },
      markCompetenciaAsPaidFn: async () => {
        persistedPaid += 1;
      }
    }),
    /já está pago|Período já consta como pago/i
  );

  assert.equal(persistedPaid, 1);
});

test('downloadGuide persiste pago quando SERPRO responde sem PDF', async () => {
  const { downloadGuide } = await import('../src/services/mei-guide.service.js');
  let persistedPaid = 0;

  await assert.rejects(
    () => downloadGuide({
      userId: 'user-6',
      cnpj: '12345678000199',
      periodoApuracao: '202606'
    }, {
      isCompetenciaPaidFn: async () => false,
      getDasBase64Fn: async () => null,
      regenerateDasPdfFn: async () => null,
      createGuideByCnpjFn: async () => {
        throw new Error('PDF do DAS não retornado');
      },
      markCompetenciaAsPaidFn: async () => {
        persistedPaid += 1;
      }
    }),
    /já está pago|Período já consta como pago/i
  );

  assert.equal(persistedPaid, 1);
});
