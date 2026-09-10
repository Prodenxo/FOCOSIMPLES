export function SettingsSectionCard({ icon: Icon, title, description, children, className = '' }) {
  return (
    <section
      className={`rounded-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-[var(--shadow-card)] sm:p-6 ${className}`}
    >
      <div className="mb-4 flex items-start gap-3">
        {Icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
