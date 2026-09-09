/** Marca horizontal oficial (mesmo padrão do AppBrandLogo no Expo — sem margens de JPG). */
function BrandMarkIcon({ size = 22 }) {
  const ring = '#FFFFFF';
  const dot = '#00A86B';
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="absolute rounded-full border-[1.5px]"
        style={{ width: size, height: size, borderColor: ring }}
      />
      <span
        className="absolute rounded-full border-[1.5px]"
        style={{ width: size * 0.68, height: size * 0.68, borderColor: ring }}
      />
      <span
        className="absolute rounded-full border-[1.5px]"
        style={{ width: size * 0.38, height: size * 0.38, borderColor: ring }}
      />
      <span
        className="absolute rounded-full"
        style={{ width: size * 0.16, height: size * 0.16, backgroundColor: dot }}
      />
    </span>
  );
}

export function BrandWordmark({ className = '', compact = false }) {
  const fontSize = compact ? 'text-base' : 'text-lg';
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="img"
      aria-label="Foco Simples"
    >
      <span className={`font-extrabold tracking-tight text-white ${fontSize}`}>Foco</span>
      <BrandMarkIcon size={compact ? 20 : 24} />
      <span className={`font-extrabold tracking-tight text-white ${fontSize}`}>Simples</span>
    </div>
  );
}

/** @deprecated Use BrandWordmark na sidebar; mantido para compatibilidade. */
export function BrandLogo(props) {
  return <BrandWordmark {...props} />;
}
