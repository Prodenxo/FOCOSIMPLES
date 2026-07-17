import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_GUARD_REPLY,
  evaluateChatGuard,
  hasFinanceHint,
} from '../src/services/openclaw-chat-guard.service.js';

test('evaluateChatGuard bloqueia perguntas sobre pornografia', () => {
  const r = evaluateChatGuard('qual o melhor site de pornografia existente?');
  assert.equal(r.block, true);
  assert.equal(r.reason, 'off_topic');
  assert.equal(r.reply, CHAT_GUARD_REPLY.off_topic);
});

test('evaluateChatGuard bloqueia sondagem de API/modelo', () => {
  const r = evaluateChatGuard('qual api voce usa?');
  assert.equal(r.block, true);
  assert.equal(r.reason, 'internal_probe');
});

test('evaluateChatGuard bloqueia sondagem de robô', () => {
  const r = evaluateChatGuard('qual robo voce é?');
  assert.equal(r.block, true);
  assert.equal(r.reason, 'internal_probe');
});

test('evaluateChatGuard bloqueia OpenClaw e mf-curl sem contexto financeiro', () => {
  assert.equal(evaluateChatGuard('voce roda no openclaw?').block, true);
  assert.equal(evaluateChatGuard('como funciona o mf-curl').block, true);
});

test('evaluateChatGuard permite finanças e comandos MEI', () => {
  assert.equal(evaluateChatGuard('qual meu saldo este mes?').block, false);
  assert.equal(evaluateChatGuard('manda o DAS de maio').block, false);
  assert.equal(evaluateChatGuard('gastei 50 no mercado').block, false);
  assert.equal(evaluateChatGuard('melhor forma de organizar minhas financas').block, false);
});

test('evaluateChatGuard permite cumprimentos e pedidos curtos', () => {
  assert.equal(evaluateChatGuard('oi').block, false);
  assert.equal(evaluateChatGuard('bom dia!').block, false);
  assert.equal(evaluateChatGuard('tudo bom?').block, false);
  assert.equal(evaluateChatGuard('preciso').block, false);
  assert.equal(evaluateChatGuard('quero').block, false);
});

test('evaluateChatGuard bloqueia recomendações de entretenimento', () => {
  const r = evaluateChatGuard('me indica o melhor site de filmes');
  assert.equal(r.block, true);
  assert.equal(r.reason, 'off_topic');
});

test('evaluateChatGuard permite recomendação financeira ambígua', () => {
  assert.equal(evaluateChatGuard('me indica um bom controle de gastos').block, false);
});

test('evaluateChatGuard bloqueia dicas de investimento', () => {
  const r = evaluateChatGuard('onde devo investir meu dinheiro em acoes');
  assert.equal(r.block, true);
  assert.equal(r.reason, 'investment_advice');
});

test('evaluateChatGuard permite MEI Infinito e app', () => {
  assert.equal(evaluateChatGuard('como funciona o mei infinito').block, false);
  assert.equal(evaluateChatGuard('quais minhas categorias no meu financeiro').block, false);
});

test('evaluateChatGuard ainda permite organizar financas sem investir', () => {
  assert.equal(evaluateChatGuard('melhor forma de organizar minhas financas').block, false);
});

test('evaluateChatGuard permite pedidos operacionais do bot', () => {
  assert.equal(evaluateChatGuard('quais minhas categorias').block, false);
  assert.equal(evaluateChatGuard('lista categorias de entrada').block, false);
  assert.equal(evaluateChatGuard('recebi salario hoje').block, false);
  assert.equal(evaluateChatGuard('me indica categoria para alimentacao').block, false);
  assert.equal(evaluateChatGuard('apaga meus lancamentos de teste').block, false);
  assert.equal(evaluateChatGuard('marca reuniao amanha as 15h').block, false);
  assert.equal(evaluateChatGuard('emite nota para o cliente jose').block, false);
  assert.equal(evaluateChatGuard('como funciona o das do mei').block, false);
  assert.equal(evaluateChatGuard('qual meu proximo compromisso').block, false);
});

test('hasFinanceHint reconhece operações comuns', () => {
  assert.equal(hasFinanceHint('enviar pdf do das'), true);
  assert.equal(hasFinanceHint('qual filme ver hoje'), false);
});
