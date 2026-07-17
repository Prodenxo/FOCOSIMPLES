import React, { useMemo } from 'react';

import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '@/lib/legalUrls';

/** HTML estático na homepage — requisito Google OAuth (crawler + revisor humano). */
export function LegalHomepageStrip() {
  const html = useMemo(
    () =>
      `<a href="${LEGAL_PRIVACY_PATH}" style="color:#2563EB;font-weight:600;text-decoration:underline">Política de Privacidade</a>` +
      ' <span aria-hidden="true">·</span> ' +
      `<a href="${LEGAL_TERMS_PATH}" style="color:#2563EB;font-weight:600;text-decoration:underline">Termos de Uso</a>`,
    [],
  );

  return (
    <nav
      className="auth-legal-footer mf-homepage-legal"
      aria-label="Informações legais"
      style={{
        display: 'block',
        marginTop: 16,
        fontSize: 13,
        lineHeight: '20px',
        textAlign: 'left',
        color: '#64748B',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
