import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  payloadItemCsosnIsSt,
  sanitizeNfeLikePayloadForEmit,
  sanitizeNfeLikePayloadItemForEmit,
} from '../src/lib/nfe-like-payload-sanitize.js';

describe('nfe-like-payload-sanitize', () => {
  it('payloadItemCsosnIsSt só quando csosn explícito é 500', () => {
    assert.equal(payloadItemCsosnIsSt({ tributos: { icms: { csosn: '500' } } }), true);
    assert.equal(payloadItemCsosnIsSt({ tributos: { icms: { csosn: '102' } } }), false);
    assert.equal(
      payloadItemCsosnIsSt({ tributos: { icms: { cst: '500' } } }),
      false,
    );
    assert.equal(
      payloadItemCsosnIsSt({ tributos: { icms: { csosn: '102', cst: '500' } } }),
      false,
    );
  });

  it('sanitize força 102 e remove cest quando não ST', () => {
    const item = sanitizeNfeLikePayloadItemForEmit({
      ncm: '61091000',
      cest: '0300100',
      tributos: { icms: { cst: '500' } },
    });
    assert.equal(item.cest, undefined);
    assert.equal(item.tributos.icms.csosn, '102');
    assert.equal(item.tributos.icms.cst, '102');
  });

  it('sanitizeNfeLikePayloadForEmit aplica em todos os itens', () => {
    const out = sanitizeNfeLikePayloadForEmit({
      itens: [{
        ncm: '61091000',
        tributos: { icms: { csosn: '102', cst: '500' } },
      }],
    });
    assert.equal(out.itens[0].tributos.icms.csosn, '102');
    assert.equal(out.itens[0].tributos.icms.cst, '102');
  });
});
