import test from 'node:test';
import assert from 'node:assert/strict';
import { matchQuickWhatsappIntent } from '../src/services/whatsapp-backend-agent-intent.js';

const NOW = new Date('2026-09-03T15:00:00-03:00');

test('pedido de saldo vira get_saldo sem esperar o modelo', () => {
  assert.deepEqual(matchQuickWhatsappIntent('qual meu saldo?', NOW), {
    action: 'get_saldo',
    payload: {},
  });
  assert.deepEqual(matchQuickWhatsappIntent('quanto eu tenho', NOW), {
    action: 'get_saldo',
    payload: {},
  });
});

test('gasto do mês passado consulta o período certo', () => {
  assert.deepEqual(matchQuickWhatsappIntent('Quanto eu gastei mes passado?', NOW), {
    action: 'list_transactions',
    payload: { from: '2026-08-01', to: '2026-08-31', tipo: 'saida' },
  });
});

test('intervalo solto também consulta o período', () => {
  assert.deepEqual(matchQuickWhatsappIntent('01/08 ate 31/08', NOW), {
    action: 'list_transactions',
    payload: { from: '2026-08-01', to: '2026-08-31' },
  });
});

test('lançar gasto com valor não vira consulta', () => {
  assert.equal(matchQuickWhatsappIntent('gastei 50 no mercado', NOW), null);
});

test('DAS, categorias, carteiras e agenda viram a ação certa', () => {
  assert.deepEqual(matchQuickWhatsappIntent('o DAS está pago?', NOW), {
    action: 'get_das_payment_status',
    payload: {},
  });
  assert.deepEqual(matchQuickWhatsappIntent('manda o DAS', NOW), {
    action: 'send_das_whatsapp',
    payload: {},
  });
  assert.deepEqual(matchQuickWhatsappIntent('quais categorias', NOW), {
    action: 'list_categories',
    payload: { minimal: true },
  });
  assert.deepEqual(matchQuickWhatsappIntent('quais carteiras eu tenho', NOW), {
    action: 'list_contas',
    payload: {},
  });
  assert.deepEqual(matchQuickWhatsappIntent('qual o meu proximo compromisso', NOW), {
    action: 'get_next_calendar_event',
    payload: {},
  });
  assert.deepEqual(matchQuickWhatsappIntent('agenda hoje', NOW), {
    action: 'list_agenda_checklist_today',
    payload: {},
  });
});

test('nota e lançamento com valor ficam para o modelo', () => {
  assert.equal(matchQuickWhatsappIntent('emitir nota', NOW), null);
  assert.equal(matchQuickWhatsappIntent('Oi', NOW), null);
});
