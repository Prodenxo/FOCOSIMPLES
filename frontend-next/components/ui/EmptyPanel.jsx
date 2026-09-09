export function EmptyPanel({ icon: Icon, illustration, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      {illustration ? (
        <div className="mb-1">{illustration}</div>
      ) : Icon ? (
        <div className="rounded-full bg-[var(--canvas)] p-4 text-[var(--text-muted)]">
          <Icon className="h-8 w-8" strokeWidth={1.25} aria-hidden />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {description ? (
        <p className="max-w-xs text-sm text-[var(--text-muted)]">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
