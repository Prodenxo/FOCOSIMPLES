'use client';

/** Ilustração de certificado digital com selo — aba Certificado. */
export function CertificateIllustration({ size = 120, className = '' }) {
  return (
    <svg
      width={size}
      height={size * (140 / 160)}
      viewBox="0 0 160 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="76" cy="60" r="52" fill="#DDF4EC" />
      <circle cx="124" cy="44" r="20" fill="#C9EEE2" opacity="0.6" />
      <ellipse cx="80" cy="128" rx="50" ry="6" fill="#8196AB" opacity="0.09" />

      <path
        d="M48 30H100L112 42V96C112 100 109 103 105 103H48C44 103 41 100 41 96V37C41 33 44 30 48 30Z"
        fill="#FFFFFF"
        stroke="#BCCCDD"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path
        d="M100 30V40C100 42 102 44 104 44H112"
        fill="#F0F5F9"
        stroke="#BCCCDD"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <rect x="52" y="52" width="36" height="4.5" rx="2.25" fill="#DEE6EF" />
      <rect x="52" y="62" width="28" height="4.5" rx="2.25" fill="#E8EDF3" />
      <rect x="52" y="72" width="42" height="4.5" rx="2.25" fill="#DEE6EF" />
      <rect x="52" y="82" width="22" height="4.5" rx="2.25" fill="#E8EDF3" />

      {/* Selo circular sobreposto */}
      <circle cx="108" cy="100" r="22" fill="#168D72" stroke="#075C4C" strokeWidth="1.5" />
      <circle cx="108" cy="100" r="17" fill="#FFFFFF" stroke="#168D72" strokeWidth="1.5" />

      <path
        d="M108 90V100L115 105"
        stroke="#168D72"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="108" cy="100" r="2.5" fill="#168D72" />

      <path
        d="M130 18L134 14M140 24L144 20M132 28L136 24"
        stroke="#70C7AC"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
