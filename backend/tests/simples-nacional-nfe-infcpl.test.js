import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySimplesNacionalInformacoesComplementares,
  SIMPLES_NACIONAL_NFE_INF_CPL_LINES,
} from '../src/lib/simples-nacional-nfe-infcpl.js';

test('aplica as duas frases do Simples quando o campo está vazio', () => {
  const out = applySimplesNacionalInformacoesComplementares({ emitente: { crt: 1 } });
  assert.match(out.informacoesComplementares, /DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL/);
  assert.match(out.informacoesComplementares, /NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI/);
  assert.equal(out.informacoesComplementares, SIMPLES_NACIONAL_NFE_INF_CPL_LINES.join('|'));
  assert.doesNotMatch(out.informacoesComplementares, /\n/);
});

test('mantém texto IBPT e não duplica as frases', () => {
  const first = applySimplesNacionalInformacoesComplementares({
    informacoesComplementares: 'Val Aprox Tributos R$ 19,26 (25,71%) Fonte: IBPT',
  });
  const second = applySimplesNacionalInformacoesComplementares(first);
  const countMe = (second.informacoesComplementares.match(/OPTANTE PELO SIMPLES NACIONAL/g) || []).length;
  const countIpi = (second.informacoesComplementares.match(/CREDITO FISCAL DE IPI|CRÉDITO FISCAL DE IPI/g) || []).length;
  assert.equal(countMe, 1);
  assert.equal(countIpi, 1);
  assert.match(second.informacoesComplementares, /Fonte: IBPT/);
  assert.doesNotMatch(second.informacoesComplementares, /\n/);
});

test('troca quebra de linha comum por pipe da PlugNotas', () => {
  const out = applySimplesNacionalInformacoesComplementares({
    informacoesComplementares: 'DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL\nNÃO GERA DIREITO A CRÉDITO FISCAL DE IPI',
  });
  assert.equal(
    out.informacoesComplementares,
    SIMPLES_NACIONAL_NFE_INF_CPL_LINES.join('|'),
  );
});
