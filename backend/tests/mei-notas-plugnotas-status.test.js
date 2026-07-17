import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPlugNotasStatus,
  resolveStatusAfterPlugnotasSync,
} from '../src/services/mei-notas.service.js';

test('extractPlugNotasStatus — retorno AUTORIZADA vence status PROCESSANDO no topo', () => {
  const status = extractPlugNotasStatus({
    status: 'PROCESSANDO',
    message: 'Nota(as) em processamento',
    retorno: {
      situacao: 'AUTORIZADA',
      numeroNfse: '45',
      dataAutorizacao: '2026-05-26T20:20:17.000Z',
    },
  });
  assert.equal(status, 'concluido');
});

test('extractPlugNotasStatus — situacao em xml.retorno', () => {
  const status = extractPlugNotasStatus({
    status: 'processando',
    xml: {
      retorno: {
        situacao: 'CONCLUIDA',
      },
    },
  });
  assert.equal(status, 'concluido');
});

test('extractPlugNotasStatus — mantém processando quando não há autorização', () => {
  const status = extractPlugNotasStatus({
    status: 'PROCESSANDO',
    message: 'Aguardando prefeitura',
  });
  assert.equal(status, 'processando');
});

test('extractPlugNotasStatus — CANCELADA vence AUTORIZADA na mesma resposta', () => {
  const status = extractPlugNotasStatus({
    status: 'AUTORIZADA',
    retorno: { situacao: 'CANCELADA' },
  });
  assert.equal(status, 'cancelado');
});

test('resolveStatusAfterPlugnotasSync — não reverte cancelamento_pendente para concluido', () => {
  const status = resolveStatusAfterPlugnotasSync(
    { status: 'cancelamento_pendente', metadata_json: { cancelamento: { requestedAt: '2026-05-26T12:00:00.000Z' } } },
    'concluido'
  );
  assert.equal(status, 'cancelamento_pendente');
});

test('resolveStatusAfterPlugnotasSync — promove para cancelado quando emissor confirma', () => {
  const status = resolveStatusAfterPlugnotasSync(
    { status: 'cancelamento_pendente', metadata_json: { cancelamento: { requestedAt: '2026-05-26T12:00:00.000Z' } } },
    'cancelado'
  );
  assert.equal(status, 'cancelado');
});

test('resolvePlugnotasProviderIdForRecord — ignora protocolo igual ao id interno', async () => {
  const { resolvePlugnotasProviderIdForRecord } = await import('../src/services/mei-notas.service.js');
  const internalId = '4585a66d-51e8-48db-b40e-1c3a281a81ca';
  let consultouIntegracao = false;
  const adapter = {
    consultarPorIntegracao: async () => {
      consultouIntegracao = true;
      return { id: 'plugnotas-remoto-123', retorno: { situacao: 'AUTORIZADA' } };
    },
    consultarPorIdOuProtocolo: async () => ({ id: 'nao-deve-usar' }),
  };
  const resolved = await resolvePlugnotasProviderIdForRecord(
    {
      id: internalId,
      protocol: internalId,
      id_integracao: 'mei-user-1-123',
      cnpj_prestador: '17422651000172',
    },
    adapter,
  );
  assert.equal(consultouIntegracao, true);
  assert.equal(resolved, 'plugnotas-remoto-123');
});
