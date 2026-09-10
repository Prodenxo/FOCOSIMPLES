'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  buildInternationalPhone,
  getPhoneCountryByIso,
  PHONE_COUNTRIES,
  splitInternationalPhone,
} from '@/lib/phoneCountries';
import {
  formatNationalPhoneInput,
  normalizePhoneDigits,
} from '@/lib/internationalPhone';
import { AppSelect } from '@/components/ui/AppSelect';

export function SettingsPhoneField({
  value,
  onChange,
  onSave,
  saving = false,
  disabled = false,
  isLast = false,
}) {
  const parsed = splitInternationalPhone(value);
  const [countryIso, setCountryIso] = useState(parsed.country.iso);
  const [national, setNational] = useState(parsed.nationalDigits);

  useEffect(() => {
    const next = splitInternationalPhone(value);
    setCountryIso(next.country.iso);
    setNational(next.nationalDigits);
  }, [value]);

  const country = getPhoneCountryByIso(countryIso);

  const emitChange = (iso, nationalDigits) => {
    const c = getPhoneCountryByIso(iso);
    onChange(buildInternationalPhone(c, nationalDigits));
  };

  return (
    <div className={`py-3 ${isLast ? '' : 'border-b border-[var(--card-border)]'}`}>
      <label className="mb-2 block text-xs font-medium text-[var(--text-muted)]">Telefone</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          <AppSelect
            ariaLabel="País do telefone"
            value={countryIso}
            onChange={(iso) => {
              setCountryIso(iso);
              emitChange(iso, national);
            }}
            compact
            className="w-[108px] shrink-0"
            options={PHONE_COUNTRIES.map((c) => ({
              value: c.iso,
              label: `${c.flag} +${c.dialCode}`,
            }))}
          />
          <input
            type="tel"
            inputMode="numeric"
            value={formatNationalPhoneInput(countryIso, national)}
            onChange={(e) => {
              const digits = normalizePhoneDigits(e.target.value);
              setNational(digits);
              emitChange(countryIso, digits);
            }}
            placeholder="(21) 99999-0000"
            className="h-10 min-w-0 flex-1 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saving}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
