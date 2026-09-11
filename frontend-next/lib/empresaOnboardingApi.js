import { apiClient } from '@/lib/apiClient';
import { isValidCnpjDigits } from '@/lib/validateCnpj';

export async function fetchEmpresaCnpjOnboardingStatus() {
  try {
    return await apiClient.get('/users/empresas/current/cnpj-onboarding');
  } catch {
    return null;
  }
}

export async function getCurrentEmpresa() {
  try {
    const res = await apiClient.get('/users/empresas/current');
    return res?.empresa ?? null;
  } catch {
    return null;
  }
}

export async function completeEmpresaCnpjOnboarding(input) {
  const res = await apiClient.post('/users/empresas/current/cnpj-onboarding', input);
  if (!res?.empresa) throw new Error('Resposta inválida ao salvar CNPJ da empresa');
  return res.empresa;
}

export async function lookupEmpresaCnpj(cnpj) {
  const digits = String(cnpj || '').replace(/\D/g, '');
  if (digits.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.');
  if (!isValidCnpjDigits(digits)) {
    throw new Error('CNPJ inválido. Verifique os dígitos informados.');
  }
  return apiClient.get(`/users/empresas/cnpj-lookup/${digits}`);
}
