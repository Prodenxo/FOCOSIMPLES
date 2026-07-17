import { getSupabaseAuthMessagePt } from '../authErrors';

describe('getSupabaseAuthMessagePt', () => {
  it('mapeia e-mail já cadastrado', () => {
    expect(
      getSupabaseAuthMessagePt({ message: 'User already registered', code: 'user_already_exists' } as any)
    ).toMatch(/já está cadastrado/i);
  });

  it('mapeia senha fraca', () => {
    expect(getSupabaseAuthMessagePt({ message: 'Password should be at least 6 characters', code: 'weak_password' } as any)).toMatch(
      /6 caracteres/i
    );
  });

  it('mapeia credenciais inválidas', () => {
    expect(getSupabaseAuthMessagePt({ message: 'Invalid login credentials' } as any)).toMatch(/incorretos/i);
  });

  it('fallback para mensagem curta desconhecida', () => {
    expect(getSupabaseAuthMessagePt(new Error('Algo estranho'))).toBe('Algo estranho');
  });
});
