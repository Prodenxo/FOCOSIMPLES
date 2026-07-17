import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLUGNOTAS_GATEWAY_UPSTREAM_PUBLIC_MESSAGE_PT,
  getPlugnotasGatewayUpstreamCode,
  isLikelyGatewayHtmlBody,
  resolvePlugnotasGatewayUpstreamForClient,
  shouldNormalizePlugnotasGatewayError,
  summarizePlugnotasErrorLogBody,
} from '../src/services/plugnotas/plugnotas-gateway-upstream-error.js';

test('shouldNormalizePlugnotasGatewayError só para 502/503/504', () => {
  assert.equal(shouldNormalizePlugnotasGatewayError(502), true);
  assert.equal(shouldNormalizePlugnotasGatewayError(503), true);
  assert.equal(shouldNormalizePlugnotasGatewayError(504), true);
  assert.equal(shouldNormalizePlugnotasGatewayError(400), false);
  assert.equal(shouldNormalizePlugnotasGatewayError(500), false);
});

test('getPlugnotasGatewayUpstreamCode mapeia status', () => {
  assert.equal(getPlugnotasGatewayUpstreamCode(502), 'plugnotas_gateway_502');
  assert.equal(getPlugnotasGatewayUpstreamCode(503), 'plugnotas_gateway_503');
  assert.equal(getPlugnotasGatewayUpstreamCode(504), 'plugnotas_gateway_504');
});

test('resolvePlugnotasGatewayUpstreamForClient devolve mensagem canónica e código', () => {
  const r = resolvePlugnotasGatewayUpstreamForClient(502);
  assert.ok(r);
  assert.equal(r.publicMessage, PLUGNOTAS_GATEWAY_UPSTREAM_PUBLIC_MESSAGE_PT);
  assert.equal(r.plugnotasCode, 'plugnotas_gateway_502');
  assert.equal(resolvePlugnotasGatewayUpstreamForClient(400), null);
});

test('summarizePlugnotasErrorLogBody omite HTML e trunca texto longo', () => {
  const html = '<html><head></head><body>502 Bad Gateway</body></html>';
  assert.equal(
    summarizePlugnotasErrorLogBody(html, 'text/html'),
    `[html_error_body omitted ${html.length} chars]`
  );
  const long = 'x'.repeat(900);
  const sum = summarizePlugnotasErrorLogBody(long, 'text/plain');
  assert.equal(sum.slice(0, 800), 'x'.repeat(800));
  assert.match(sum, /truncated 100 chars/);
  assert.equal(summarizePlugnotasErrorLogBody('curto', ''), 'curto');
});

test('isLikelyGatewayHtmlBody detecta HTML típico de proxy', () => {
  assert.equal(
    isLikelyGatewayHtmlBody('<html><title>502 Bad Gateway</title></html>', 'text/html'),
    true
  );
  assert.equal(
    isLikelyGatewayHtmlBody('<html><body>502 Bad Gateway</body></html>', ''),
    true
  );
  assert.equal(isLikelyGatewayHtmlBody('<html><body>genérico</body></html>', ''), false);
  assert.equal(isLikelyGatewayHtmlBody('{"error":"x"}', 'application/json'), false);
});
