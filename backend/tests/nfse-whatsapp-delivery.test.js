import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENCLAW_NFSE_META,
  buildNotaTerminalFailureMessage,
  isOpenclawNfseAutoWhatsappEnabled,
} from '../src/services/nfse-whatsapp-delivery.service.js';

test('buildNotaTerminalFailureMessage — rejeição avisa o utilizador com o motivo', () => {
  const msg = buildNotaTerminalFailureMessage(
    'rejeitado',
    'E0714 — Arquivo enviado com erro na assinatura.',
  );
  assert.match(msg, /rejeitada pela prefeitura/);
  assert.match(msg, /Motivo: E0714/);
});

test('buildNotaTerminalFailureMessage — E0312 sai limpo e com o que fazer', () => {
  const msg = buildNotaTerminalFailureMessage(
    'rejeitado',
    'Erro desconhecido: Erro ao realizar a requisição. '
    + '[{"Codigo":"E0312","Descricao":"O código de tributação nacional informado não está administrado pelo município."}]',
  );
  assert.match(msg, /Motivo: E0312 — O código de tributação nacional/);
  assert.doesNotMatch(msg, /Erro desconhecido/);
  assert.doesNotMatch(msg, /"Codigo"/);
  assert.match(msg, /edite o serviço e use um código da lista nacional/);
});

test('buildNotaTerminalFailureMessage — formato ISSNET (codigo-descricao) vira lista com ação', () => {
  const msg = buildNotaTerminalFailureMessage(
    'rejeitado',
    'E0370-O grupo de informações de obra é obrigatório quando o código de tributação nacional '
    + 'pertencer a um dos subitens 07.02.01 (regra do validador.) | '
    + 'EM062-O Cód. Tributação Nacional, NBS, Cód. Ind. Operação e Classificação Tributária '
    + 'precisam estar correlacionados. (Acesse a tabela oficial.)',
  );
  assert.match(msg, /E0370 — O grupo de informações de obra é obrigatório/);
  assert.match(msg, /EM062 — O Cód\. Tributação Nacional/);
  assert.doesNotMatch(msg, /regra do validador/);
  assert.match(msg, /endereço do local da obra/);
});

test('buildNotaTerminalFailureMessage — sem motivo não inventa linha vazia', () => {
  const msg = buildNotaTerminalFailureMessage('cancelado');
  assert.match(msg, /foi cancelada/);
  assert.doesNotMatch(msg, /Motivo:/);
});

test('buildNotaTerminalFailureMessage — status desconhecido tem texto seguro', () => {
  assert.match(buildNotaTerminalFailureMessage('xpto'), /não foi autorizada/);
});

test('isOpenclawNfseAutoWhatsappEnabled — lê env', () => {
  const prev = process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED;
  process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED = 'false';
  assert.equal(isOpenclawNfseAutoWhatsappEnabled(), false);
  process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED = 'true';
  assert.equal(isOpenclawNfseAutoWhatsappEnabled(), true);
  process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED = prev;
});

test('OPENCLAW_NFSE_META chaves estáveis', () => {
  assert.equal(OPENCLAW_NFSE_META.PENDING, 'openclawWhatsappPdfPending');
  assert.equal(OPENCLAW_NFSE_META.PHONE, 'openclawWhatsappPhone');
  assert.equal(OPENCLAW_NFSE_META.SENT_AT, 'openclawWhatsappPdfSentAt');
  assert.equal(OPENCLAW_NFSE_META.SENDING_AT, 'openclawWhatsappPdfSendingAt');
});
