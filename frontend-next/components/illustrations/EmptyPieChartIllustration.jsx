/** Ilustração de gráfico circular em traço fino — estado vazio de orçamento. */
export function EmptyPieChartIllustration({ className = '' }) {
  const cx = 50;
  const cy = 50;
  const r = 36;

  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="var(--illustration-stroke)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`}
        fill="var(--illustration-fill)"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx + r}
        y2={cy}
        stroke="var(--illustration-stroke)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
