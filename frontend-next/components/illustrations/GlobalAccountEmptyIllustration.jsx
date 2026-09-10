'use client';

import { useId } from 'react';

/** Globo + moedas $/€ — estado vazio (aproximação da referência aprovada). */
export function GlobalAccountEmptyIllustration({ className = '' }) {
  const uid = useId().replace(/:/g, '');
  const glowId = `ge-${uid}`;

  return (
    <svg
      width="220"
      height="160"
      viewBox="0 0 220 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="110" cy="72" rx="88" ry="68" fill={`url(#${glowId})`} />
      <circle cx="48" cy="118" r="4" fill="var(--accent-soft)" opacity="0.8" />
      <circle cx="172" cy="44" r="3" fill="var(--accent-soft)" opacity="0.65" />
      <circle cx="188" cy="96" r="2.5" fill="var(--accent)" opacity="0.25" />

      {/* Globo */}
      <circle cx="110" cy="72" r="46" fill="var(--accent-soft)" opacity="0.55" />
      <circle cx="110" cy="72" r="46" stroke="var(--accent)" strokeWidth="1.5" opacity="0.45" />
      <ellipse cx="110" cy="72" rx="46" ry="16" stroke="var(--accent)" strokeWidth="1" opacity="0.35" />
      <ellipse cx="110" cy="72" rx="46" ry="28" stroke="var(--accent)" strokeWidth="1" opacity="0.28" />
      <line x1="64" y1="72" x2="156" y2="72" stroke="var(--accent)" strokeWidth="1" opacity="0.3" />
      <path d="M110 26 C 88 42 88 102 110 118 C 132 102 132 42 110 26 Z" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.3" />

      {/* Moeda $ */}
      <circle cx="78" cy="108" r="18" fill="var(--card-bg)" stroke="var(--accent)" strokeWidth="1.5" />
      <text x="78" y="114" textAnchor="middle" fill="var(--accent)" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif">
        $
      </text>

      {/* Moeda € */}
      <circle cx="142" cy="98" r="18" fill="var(--card-bg)" stroke="#3b82f6" strokeWidth="1.5" />
      <text x="142" y="104" textAnchor="middle" fill="#3b82f6" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif">
        €
      </text>
    </svg>
  );
}
