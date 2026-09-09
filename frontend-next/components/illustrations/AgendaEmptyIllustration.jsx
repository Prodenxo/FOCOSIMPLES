export default function AgendaEmptyIllustration({ size = 150, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 210"
      width={size}
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
    >
      <circle cx="99" cy="85" r="65" fill="#DDF4EC" />
      <circle cx="158" cy="100" r="49" fill="#C9EEE2" opacity=".6" />
      <circle cx="51" cy="147" r="27" fill="#DDF4EC" opacity=".75" />
      <circle cx="213" cy="116" r="12" fill="#C9EEE2" opacity=".6" />
      <ellipse cx="125" cy="187" rx="82" ry="8" fill="#8295A9" opacity=".1" />
      <rect x="57" y="70" width="123" height="115" rx="12" fill="#CFD9E2" opacity=".55" />
      <rect x="57" y="63" width="123" height="115" rx="12" fill="#FFFFFF" stroke="#C6D2DE" strokeWidth="1.5" />
      <path d="M69 63H168C174.6 63 180 68.4 180 75V94H57V75C57 68.4 62.4 63 69 63Z" fill="#00856A" />
      <path d="M69 65H166" stroke="#35AA8E" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      <rect x="83" y="51" width="8" height="27" rx="4" fill="#075C4C" />
      <rect x="144" y="51" width="8" height="27" rx="4" fill="#075C4C" />
      <path d="M85 54V71M146 54V71" stroke="#359B83" strokeWidth="2" strokeLinecap="round" />
      {[106, 126, 146].map((y, row) =>
        [72, 93, 114, 135, 156].map((x, column) => (
          <rect
            key={`${row}-${column}`}
            x={x}
            y={y}
            width="13"
            height="13"
            rx="3"
            fill={row === 1 && column === 1 ? '#9CDEC7' : '#E2E8EE'}
          />
        )),
      )}
      <circle cx="180" cy="159" r="32" fill="#396C76" stroke="#254E59" strokeWidth="1.5" />
      <circle cx="180" cy="159" r="25.5" fill="#FFFFFF" stroke="#C8E1E3" strokeWidth="2" />
      <path d="M180 144V160H191" stroke="#254E59" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="180" cy="160" r="3" fill="#254E59" />
      <path d="M180 138V140M180 178V180M159 159H161M199 159H201" stroke="#B5C9D1" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
