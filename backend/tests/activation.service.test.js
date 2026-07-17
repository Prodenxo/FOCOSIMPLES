import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivationSteps,
  computeProgressFromSteps,
  evaluateStepStatus,
  isProfileNameComplete,
  isPhoneWhatsappComplete,
} from '../src/services/activation.service.js';

const fullCtx = {
  hasProfileName: true,
  hasPhone: true,
  accountsCount: 1,
  transactionsCount: 2,
  hasBudgetThisMonth: true,
  hasGoogleCalendar: true,
  hasMeiCertificate: true,
  hasDasActivity: true,
  nfseClientsCount: 1,
};

test('isProfileNameComplete exige pelo menos 2 caracteres', () => {
  assert.equal(isProfileNameComplete('A'), false);
  assert.equal(isProfileNameComplete(' Ana '), true);
});

test('isPhoneWhatsappComplete valida telefone BR canónico', () => {
  assert.equal(isPhoneWhatsappComplete(''), false);
  assert.equal(isPhoneWhatsappComplete('11999998888'), true);
});

test('computeProgressFromSteps conta só passos obrigatórios', () => {
  const steps = [
    { id: 'a', required: true, status: 'completed' },
    { id: 'b', required: true, status: 'pending' },
    { id: 'c', required: false, status: 'completed' },
  ];
  const p = computeProgressFromSteps(steps);
  assert.equal(p.completed, 1);
  assert.equal(p.totalRequired, 2);
  assert.equal(p.percent, 50);
  assert.equal(p.isComplete, false);
  assert.equal(p.isCoreComplete, false);
  assert.equal(p.isFullyComplete, false);
  assert.equal(p.pendingCount, 1);
});

test('computeProgressFromSteps: core completo mas MEI pendente não é fully complete', () => {
  const steps = [
    { id: 'a', required: true, status: 'completed' },
    { id: 'b', required: true, status: 'completed' },
    { id: 'mei_x', required: false, status: 'pending' },
  ];
  const p = computeProgressFromSteps(steps);
  assert.equal(p.isCoreComplete, true);
  assert.equal(p.isComplete, true);
  assert.equal(p.isFullyComplete, false);
  assert.equal(p.hasPendingSteps, true);
  assert.equal(p.pendingCount, 1);
});

test('buildActivationSteps sem MEI não inclui passos mei_*', () => {
  const steps = buildActivationSteps(fullCtx, { showMei: false });
  assert.equal(steps.some((s) => s.id.startsWith('mei_')), false);
  assert.equal(steps.length, 6);
});

test('buildActivationSteps com MEI inclui certificado e DAS', () => {
  const steps = buildActivationSteps(fullCtx, { showMei: true });
  assert.equal(steps.some((s) => s.id === 'mei_certificate'), true);
  assert.equal(steps.filter((s) => s.required).length, 5);
});

test('evaluateStepStatus: first_transaction pendente sem lançamentos', () => {
  const r = evaluateStepStatus('first_transaction', { ...fullCtx, transactionsCount: 0 });
  assert.equal(r.status, 'pending');
});
