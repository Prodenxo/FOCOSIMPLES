export type ManagedUserSearchable = {
  id?: string | null;
  email?: string | null;
  displayName?: string | null;
  phone?: string | null;
  empresaName?: string | null;
  role?: string | null;
};

export function matchManagedUserSearch(
  user: ManagedUserSearchable,
  rawTerm: string,
): boolean {
  const term = rawTerm.trim();
  if (!term) return true;

  const lower = term.toLowerCase();
  const digits = term.replace(/\D/g, '');

  const textFields = [
    user.displayName,
    user.email,
    user.empresaName,
    user.role,
    user.phone,
    user.id,
  ];

  if (textFields.some((field) => String(field || '').toLowerCase().includes(lower))) {
    return true;
  }

  if (digits.length >= 2) {
    const phoneDigits = String(user.phone || '').replace(/\D/g, '');
    if (phoneDigits.includes(digits)) return true;

    return textFields.some((field) =>
      String(field || '').replace(/\D/g, '').includes(digits),
    );
  }

  return false;
}
