import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getAuthPalette } from '@/components/auth/authTokens';
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '@/lib/legalUrls';

/**
 * Rodapé legal em HTML puro (web). Um único bloco innerHTML com <a href>
 * para o crawler do Google OAuth e sem quebra de layout do React Native Web.
 */
export function AuthLegalFooter() {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const palette = getAuthPalette(isDarkMode);
  const linkColor = palette.linkText ?? '#2563EB';
  const textColor = palette.subtitleText;

  const html = useMemo(() => {
    const link = (href: string, label: string) =>
      `<a href="${href}" style="color:${linkColor};font-weight:600;text-decoration:underline">${label}</a>`;
    return `Ao clicar em Entrar, você concorda com nossa ${link(LEGAL_PRIVACY_PATH, 'Política de Privacidade')} e os ${link(LEGAL_TERMS_PATH, 'Termos de Uso')}.`;
  }, [linkColor]);

  return (
    <div
      className="auth-legal-footer"
      style={{
        marginTop: 4,
        marginBottom: 0,
        padding: '0 8px',
        fontSize: 12,
        lineHeight: '20px',
        textAlign: 'center',
        color: textColor,
        width: '100%',
        maxWidth: 420,
        marginLeft: 'auto',
        marginRight: 'auto',
        boxSizing: 'border-box',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
