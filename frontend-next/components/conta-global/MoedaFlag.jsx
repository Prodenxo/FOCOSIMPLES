'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMoedaCountryIso } from '@/lib/moedaCountryIso';
import { getMoedaFlagUrls } from '@/lib/moedaFlagSources';

export function MoedaFlag({ moeda, size = 36, label }) {
  const countryIso = useMemo(() => getMoedaCountryIso(moeda), [moeda]);
  const urls = useMemo(() => getMoedaFlagUrls(moeda, countryIso, size), [moeda, countryIso, size]);
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [moeda, countryIso]);

  const currentUrl = urls[urlIndex] ?? null;
  const alt = label ?? moeda;
  const showFallback = !countryIso || urlIndex >= urls.length || !currentUrl;

  if (showFallback) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--canvas)] font-bold text-[var(--text-muted)]"
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.28) }}
        aria-label={alt}
        role="img"
      >
        {(countryIso ?? moeda).slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--card-border)]"
      style={{ width: size, height: size }}
      aria-label={alt}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentUrl}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={() => setUrlIndex((i) => i + 1)}
      />
    </span>
  );
}
