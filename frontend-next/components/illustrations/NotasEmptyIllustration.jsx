'use client';

/** Ilustração de recibo/nota fiscal — estado vazio da aba Início/Notas fiscais. */
export function NotasEmptyIllustration({ size = 120, className = '' }) {
  return (
    <svg
      width={size}
      height={size * (160 / 120)}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="80" cy="80" r="68" fill="#E5F7F2" />
      <circle cx="118" cy="58" r="22" fill="#C9EEE2" opacity="0.55" />
      <ellipse cx="80" cy="148" rx="56" ry="6" fill="#8196AB" opacity="0.08" />

      <path
        d="M44 36H110L120 46V124C120 128 117 131 113 131H44C40 131 37 128 37 124V43C37 39 40 36 44 36Z"
        fill="#FFFFFF"
        stroke="#BCCCDD"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path
        d="M110 36V44C110 46 112 48 114 48H120"
        fill="#F0F5F9"
        stroke="#BCCCDD"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <rect x="48" y="56" width="46" height="4.5" rx="2.25" fill="#DEE6EF" />
      <rect x="48" y="68" width="36" height="4.5" rx="2.25" fill="#E8EDF3" />
      <rect x="48" y="84" width="56" height="4.5" rx="2.25" fill="#DEE6EF" />
      <rect x="48" y="96" width="40" height="4.5" rx="2.25" fill="#E8EDF3" />

      <rect x="48" y="110" width="22" height="10" rx="3" fill="#D6F3E9" />
      <path
        d="M53 115L57 119L64 111"
        stroke="#168D72"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="120" cy="118" r="12" fill="#75CDB8" />
      <path
        d="M115 118L119 122L126 115"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M138 28L143 24M148 36L153 32M138 36L143 32"
        stroke="#70C7AC"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
