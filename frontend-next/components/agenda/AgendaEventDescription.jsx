'use client';

import { useMemo, useState } from 'react';
import { plainTextFromEventDescription } from '@/lib/agendaText';

const COLLAPSE_AT = 280;

export function AgendaEventDescription({ text, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const formatted = useMemo(() => plainTextFromEventDescription(text), [text]);

  if (!formatted) return null;

  const isLong = formatted.length > COLLAPSE_AT;
  const visible = expanded || !isLong ? formatted : `${formatted.slice(0, COLLAPSE_AT).trim()}…`;

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-muted)]">{visible}</p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-semibold text-[var(--accent)] hover:underline"
        >
          {expanded ? 'Ver menos' : 'Ver texto completo'}
        </button>
      ) : null}
    </div>
  );
}
