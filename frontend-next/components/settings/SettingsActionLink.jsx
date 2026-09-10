import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function SettingsActionLink({ href, onClick, title, description, icon: Icon }) {
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--canvas)] text-[var(--accent)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <span className="min-w-0 text-left">
          <span className="block text-sm font-medium text-[var(--text-primary)]">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{description}</span>
          ) : null}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
    </>
  );

  const cls = 'flex w-full items-center justify-between gap-3 rounded-[12px] px-2 py-3 text-left transition-colors hover:bg-[var(--canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
