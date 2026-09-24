import test from 'node:test';
import assert from 'node:assert/strict';

const {
  isWhatsappBotPhone,
  listWhatsappBotPhones,
} = await import('../src/utils/whatsapp-bot-phone.js');

const BOT = '5521984503232';

test('listWhatsappBotPhones aceita lista por vírgula e normaliza', () => {
  assert.deepEqual(
    listWhatsappBotPhones(' +55 (21) 98450-3232 , 5584988247714 '),
    ['5521984503232', '5584988247714'],
  );
  assert.deepEqual(listWhatsappBotPhones(''), []);
  assert.deepEqual(listWhatsappBotPhones(undefined), []);
});

test('isWhatsappBotPhone pega o número do robô em qualquer formato', () => {
  assert.equal(isWhatsappBotPhone(BOT, BOT), true);
  assert.equal(isWhatsappBotPhone('+55 21 98450-3232', BOT), true);
  assert.equal(isWhatsappBotPhone('21984503232', BOT), true);
  // Painel às vezes mostra sem o nono dígito.
  assert.equal(isWhatsappBotPhone('552184503232', BOT), true);
});

test('isWhatsappBotPhone não confunde o telefone de um cliente', () => {
  assert.equal(isWhatsappBotPhone('5584988247714', BOT), false);
  assert.equal(isWhatsappBotPhone('5521996185328', BOT), false);
});

test('sem a env configurada o guard fica inerte', () => {
  assert.equal(isWhatsappBotPhone(BOT, ''), false);
  assert.equal(isWhatsappBotPhone(BOT, '   '), false);
});
