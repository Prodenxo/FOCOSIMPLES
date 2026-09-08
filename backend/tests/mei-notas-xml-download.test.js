import test from 'node:test';
import assert from 'node:assert/strict';

import {
  downloadXmlViaPlugnotasAdapter,
  extractStoredXmlFromMeiNotaRecord,
  extractStoredXmlString,
} from '../src/services/mei-notas-xml-download.js';

test('extractStoredXmlString encontra XML em response_json aninhado', () => {
  const xml = '<?xml version="1.0"?><NFSe><Numero>1</Numero></NFSe>';
  const found = extractStoredXmlString({
    documents: [{ retorno: { xml: xml } }],
  });
  assert.equal(found, xml);
});

test('extractStoredXmlFromMeiNotaRecord ignora payload_json (JSON de emissão)', () => {
  const found = extractStoredXmlFromMeiNotaRecord({
    payload_json: { servico: [{ valor: { servico: 1 } }] },
    response_json: { message: 'Rejeitada' },
  });
  assert.equal(found, null);
});

test('downloadXmlViaPlugnotasAdapter tenta idIntegracao após falha no plugnotas_id', async () => {
  const calls = [];
  const adapter = {
    downloadXml: async (id) => {
      calls.push(['id', id]);
      throw new Error('400 plugnotas');
    },
    downloadXmlPorIntegracao: async (idIntegracao, cnpj) => {
      calls.push(['integracao', idIntegracao, cnpj]);
      return {
        buffer: Buffer.from('<NFSe/>', 'utf8'),
        contentType: 'application/xml',
      };
    },
  };

  const file = await downloadXmlViaPlugnotasAdapter(adapter, {
    plugnotas_id: 'abc123',
    id_integracao: 'int-1',
    cnpj_prestador: '43581555000187',
  });

  assert.deepEqual(calls, [
    ['id', 'abc123'],
    ['integracao', 'int-1', '43581555000187'],
  ]);
  assert.equal(file.contentType, 'application/xml');
  assert.equal(file.buffer.toString('utf8'), '<NFSe/>');
});

test('downloadXmlViaPlugnotasAdapter propaga último erro quando todas tentativas falham', async () => {
  const adapter = {
    downloadXml: async () => {
      throw new Error('primeira falha');
    },
    downloadXmlPorIntegracao: async () => {
      throw new Error('segunda falha');
    },
  };

  await assert.rejects(
    () => downloadXmlViaPlugnotasAdapter(adapter, {
      plugnotas_id: 'abc123',
      id_integracao: 'int-1',
      cnpj_prestador: '43581555000187',
    }),
    /segunda falha/,
  );
});
