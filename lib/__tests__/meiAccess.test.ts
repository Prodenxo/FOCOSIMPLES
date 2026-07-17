import { canAccessMeiArea } from '../meiAccess';

describe('canAccessMeiArea (paridade web)', () => {
  it('permite superadmin independentemente de mei', () => {
    expect(canAccessMeiArea('superadmin', false)).toBe(true);
    expect(canAccessMeiArea('superadmin', true)).toBe(true);
    expect(canAccessMeiArea('superadmin', null)).toBe(true);
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

  it('nega sem role ou role sem privilégio MEI', () => {
    expect(canAccessMeiArea(null, true)).toBe(false);
    expect(canAccessMeiArea(null, false)).toBe(false);
  });

  it('nega outsider independentemente de mei', () => {
    expect(canAccessMeiArea('outsider', true)).toBe(false);
    expect(canAccessMeiArea('outsider', false)).toBe(false);
    expect(canAccessMeiArea('outsider', null)).toBe(false);
  });
});
