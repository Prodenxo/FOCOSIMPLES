import { canAccessMeiArea } from '../meiAccess';

describe('canAccessMeiArea', () => {
  it('exige mei=true mesmo para superadmin (aba Notas só com liberação)', () => {
    expect(canAccessMeiArea('superadmin', false)).toBe(false);
    expect(canAccessMeiArea('superadmin', true)).toBe(true);
    expect(canAccessMeiArea('superadmin', null)).toBe(false);
  });

  it('exige mei=true para admin', () => {
    expect(canAccessMeiArea('admin', true)).toBe(true);
    expect(canAccessMeiArea('admin', false)).toBe(false);
    expect(canAccessMeiArea('admin', null)).toBe(false);
  });

  it('exige mei=true para usuario', () => {
    expect(canAccessMeiArea('usuario', true)).toBe(true);
    expect(canAccessMeiArea('usuario', false)).toBe(false);
    expect(canAccessMeiArea('usuario', null)).toBe(false);
  });

  it('nega sem role ou outsider', () => {
    expect(canAccessMeiArea(null, true)).toBe(false);
    expect(canAccessMeiArea('outsider', true)).toBe(false);
  });
});
