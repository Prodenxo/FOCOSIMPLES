/** Ilustração de estado vazio — documento, relógio e nuvens. */
export function NoMovementsIllustration({ className = '' }) {
  return (
    <svg
      width="150"
      height="100"
      viewBox="0 0 150 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Nuvens ao fundo */}
      <ellipse cx="38" cy="36" rx="20" ry="11" fill="var(--illustration-fill)" />
      <ellipse cx="52" cy="32" rx="15" ry="8" fill="var(--illustration-fill)" />
      <ellipse cx="112" cy="30" rx="18" ry="10" fill="var(--illustration-fill)" />
      <ellipse cx="124" cy="26" rx="13" ry="7" fill="var(--illustration-fill)" />

      {/* Documento */}
      <rect
        x="50"
        y="16"
        width="50"
        height="62"
        rx="7"
        fill="var(--card-bg)"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.5"
      />
      <line
        x1="60"
        y1="32"
        x2="90"
        y2="32"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.75"
      />
      <line
        x1="60"
        y1="42"
        x2="84"
        y2="42"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
      <line
        x1="60"
        y1="52"
        x2="88"
        y2="52"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Relógio sobreposto */}
      <circle
        cx="94"
        cy="70"
        r="15"
        fill="var(--card-bg)"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.5"
      />
      <circle cx="94" cy="70" r="1.75" fill="var(--illustration-stroke)" />
      <line
        x1="94"
        y1="70"
        x2="94"
        y2="61"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <line
        x1="94"
        y1="70"
        x2="101"
        y2="73"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
