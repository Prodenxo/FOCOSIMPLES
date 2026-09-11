'use client';

/** Etiquetas empilhadas — modelo aprovado (viewBox 160×160). */
export function CategoryTagsIllustration({ size = 64, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="80" cy="80" r="72" fill="#E5F7F2" />
      <circle cx="80" cy="80" r="55" fill="#DEF4ED" opacity="0.45" />

      <g transform="rotate(-22 106 93)">
        <path
          d="M91 57H111L124 71V121Q124 125 120 125H91Q87 125 87 121V61Q87 57 91 57Z"
          fill="#A9D2FA"
        />
        <path
          d="M111 57L124 71H115Q111 71 111 67V57Z"
          fill="#C7E2FC"
        />
        <circle cx="104" cy="70" r="4" fill="#EAF6FE" />
      </g>

      <path
        d="M88 56C90 41 108 43 110 54C112 64 103 70 97 67"
        stroke="#538C99"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      <g transform="rotate(25 88 94)">
        <path
          d="M75 56H93L106 70V126Q106 130 102 130H72Q68 130 68 126V70L75 56Z"
          fill="#294C64"
          opacity="0.22"
          transform="translate(0 2)"
        />
        <path
          d="M75 56H93L106 70V126Q106 130 102 130H72Q68 130 68 126V70L75 56Z"
          fill="#F8BBB8"
        />
        <path
          d="M75 56H93L106 70H68L75 56Z"
          fill="#FFCECA"
          opacity="0.7"
        />
        <circle cx="87" cy="68" r="4" fill="#FFF0EB" />
      </g>

      <path
        d="M76 43C73 31 87 23 94 32C100 40 94 48 88 51"
        stroke="#398E80"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      <g transform="rotate(43 61 75)">
        <path
          d="M46 34H75L85 48V108Q85 112 81 112H42Q38 112 38 108V48L46 34Z"
          fill="#48A995"
          opacity="0.16"
          transform="translate(0 2)"
        />
        <path
          d="M46 34H75L85 48V108Q85 112 81 112H42Q38 112 38 108V48L46 34Z"
          fill="#75CDB8"
        />
        <path
          d="M46 34H75L85 48V61L38 91V48L46 34Z"
          fill="#91DDCB"
          opacity="0.45"
        />
        <path
          d="M38 93L85 64V108Q85 112 81 112H42Q38 112 38 108V93Z"
          fill="#55BBA4"
          opacity="0.22"
        />
        <circle cx="61.5" cy="47" r="5" fill="#449C8B" opacity="0.3" />
        <circle cx="61.5" cy="45.5" r="4.3" fill="#EDF9F4" />
        <path
          d="M60 42.5L63 43"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
