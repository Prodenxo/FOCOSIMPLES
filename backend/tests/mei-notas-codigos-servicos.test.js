import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

const TABLE = 'codigosservicos';

const matchesIlikeSubstring = (text, pctPattern) => {
  const inner = String(pctPattern || '')
    .replace(/^%/, '')
    .replace(/%$/, '')
    .toLowerCase();
  return String(text || '').toLowerCase().includes(inner);
};

/**
 * Simula `from().select().order().limit()` + `applyCatalogSearch` (`.or()` opcional).
 * @param {{ rows: { codigo: string, descricao: string }[], capture?: Record<string, unknown> }} opts
 */
function createCodigosServicosMock({ rows, capture = {} }) {
  const sorted = [...rows].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'));
  return {
    from(table) {
      assert.equal(table, TABLE);
      return {
        select() {
          return {
            order(col, opts) {
              assert.equal(col, 'codigo');
              assert.equal(opts?.ascending, true);
              return {
                limit(n) {
                  capture.limit = n;
                  const tail = {
                    or(filterStr) {
                      capture.or = filterStr;
                      const parts = String(filterStr).split(',');
                      const likeRaw = parts[0]?.split('.ilike.')[1] ?? '';
                      const filtered = sorted.filter(
                        (r) => matchesIlikeSubstring(r.codigo, likeRaw)
                          || matchesIlikeSubstring(r.descricao, likeRaw)
                      );
                      const out = filtered.slice(0, n);
                      return Promise.resolve({ data: out, error: null });
                    },
                    then(onFulfilled, onRejected) {
                      return Promise.resolve({ data: sorted.slice(0, n), error: null }).then(
                        onFulfilled,
                        onRejected
                      );
                    }
                  };
                  return tail;
                }
              };
            }
          };
        }
      };
    }
  };
}

afterEach(async () => {
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__resetGetDbForTests();
});

test('listarCodigosServicosReferencia — q vazio devolve até limit ordenado por codigo', async () => {
  const rows = [
    { codigo: '02.01', descricao: 'Beta' },
    { codigo: '01.01', descricao: 'Alpha' }
  ];
  const capture = {};
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => createCodigosServicosMock({ rows, capture }));

  const data = await mod.listarCodigosServicosReferencia({ q: '', limit: 20 });
  assert.equal(capture.limit, 20);
  assert.equal(data.length, 2);
  assert.equal(data[0].codigo, '01.01');
  assert.equal(data[1].codigo, '02.01');
});

test('listarCodigosServicosReferencia — q com texto filtra código ou descrição (ilike)', async () => {
  const rows = [
    { codigo: '10.05', descricao: 'Manutenção elétrica' },
    { codigo: '99.99', descricao: 'Outro' }
  ];
  const capture = {};
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => createCodigosServicosMock({ rows, capture }));

  const data = await mod.listarCodigosServicosReferencia({ q: 'manuten', limit: 20 });
  assert.ok(String(capture.or || '').includes('ilike'));
  assert.equal(data.length, 1);
  assert.equal(data[0].codigo, '10.05');
});

test('listarCodigosServicosReferencia — limit 50 (teto parseCatalogLimit)', async () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({
    codigo: String(i + 1).padStart(3, '0'),
    descricao: `Item ${i}`
  }));
  const capture = {};
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => createCodigosServicosMock({ rows, capture }));

  const data = await mod.listarCodigosServicosReferencia({ q: '', limit: 50 });
  assert.equal(capture.limit, 50);
  assert.equal(data.length, 50);
});

test('extractCodigosServicoSearchTokens — remove stopwords e acentos', async () => {
  const mod = await import('../src/services/mei-notas.service.js');
  const tokens = mod.extractCodigosServicoSearchTokens(
    'Desenvolvimento e licenciamento de programas de computador',
  );
  // "desenvolvimento" é fraco; tokens fortes / mais longos vêm primeiro
  assert.ok(tokens.includes('licenciamento'));
  assert.ok(tokens.includes('programas'));
  assert.ok(tokens.includes('computador'));
});

test('extractCodigosServicoSearchTokens — prioriza token forte (treinamento)', async () => {
  const mod = await import('../src/services/mei-notas.service.js');
  const tokens = mod.extractCodigosServicoSearchTokens(
    'Treinamento em desenvolvimento profissional e gerencial',
  );
  assert.equal(tokens[0], 'treinamento');
  assert.ok(!tokens.includes('desenvolvimento') || tokens.indexOf('treinamento') < tokens.indexOf('desenvolvimento'));
});
