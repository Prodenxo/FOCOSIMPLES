'use client';

export function BudgetEmptyIllustration({ size = 240, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 240"
      width={size}
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
    >
      <circle cx="143" cy="109" r="91" fill="#BFEADF" opacity="0.42" />
      <circle cx="69" cy="99" r="48" fill="#CEEEE6" opacity="0.55" />
      <circle cx="226" cy="155" r="36" fill="#BFEADF" opacity="0.38" />

      <ellipse cx="148" cy="216" rx="100" ry="9" fill="#8196AB" opacity="0.09" />

      <path
        d="M86 57H168L197 86V205C197 211 193 215 187 215H86C80 215 76 211 76 205V67C76 61 80 57 86 57Z"
        fill="#FFFFFF"
        stroke="#BCCCDD"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path
        d="M168 57V80C168 84 170 86 174 86H197"
        fill="#F0F5F9"
        stroke="#BCCCDD"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {[96, 133, 170].map((y) => (
        <g key={y}>
          <rect x="92" y={y} width="23" height="23" rx="6" fill="#D6F3E9" />
          <path
            d={`M98 ${y + 11}L102 ${y + 15}L109 ${y + 7}`}
            stroke="#168D72"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="125" y={y + 5} width="51" height="4.5" rx="2.25" fill="#DEE6EF" />
          <rect x="125" y={y + 14} width="35" height="4.5" rx="2.25" fill="#E8EDF3" />
        </g>
      ))}

      <path
        d="M180 166L210 153C213 152 215 153 216 156L222 174L180 184V166Z"
        fill="#53B79B"
        stroke="#19866B"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path d="M185 166L210 156" stroke="#A2E0CB" strokeWidth="2" strokeLinecap="round" />

      <rect
        x="169"
        y="169"
        width="66"
        height="47"
        rx="6"
        fill="#73CBB0"
        stroke="#19866B"
        strokeWidth="1.6"
      />

      <path
        d="M175 171H229C231 171 233 173 233 176V183L175 208V171Z"
        fill="#9CDEC8"
        opacity="0.42"
      />

      <path
        d="M175 175V209C175 211 176 212 178 212H226"
        stroke="#ACEDD5"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.8"
      />

      <path
        d="M226 183H235V201H226C221 201 217 197 217 192C217 187 221 183 226 183Z"
        fill="#299B7E"
        stroke="#19866B"
        strokeWidth="1.4"
      />

      <circle cx="226" cy="192" r="3.3" fill="#DDF7EC" />

      <circle cx="246" cy="201" r="20" fill="#FFDC77" stroke="#DFA321" strokeWidth="1.5" />

      <circle cx="246" cy="201" r="16" fill="#FFE8A2" stroke="#FFF5D2" strokeWidth="1.5" />

      <path
        d="M251 194C249 191 242 191 241 195C239 200 252 199 251 204C250 209 243 209 240 206M246 188V212"
        stroke="#C58A12"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M235 145L236 137M247 150L253 145M251 160H260"
        stroke="#70C7AC"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
