import { type PropsWithChildren } from 'react'
import { APP_BRAND_NAME } from '@/lib/appBrand'
import { MF_WEB_BOOT_SCRIPT, MF_WEB_DOCUMENT_STYLES, MF_STATIC_LEGAL_FOOTER_HTML } from '@/lib/webShellDocument'

/**
 * Shell HTML para `web.output: "static"` (opcional).
 * Em produção atual (SPA), o Dockerfile usa scripts/patch-web-index.mjs.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR" translate="no" className="notranslate">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="google" content="notranslate" />
        <title>{APP_BRAND_NAME}</title>
        <link rel="icon" type="image/png" sizes="32x32" href="/fm-mark.png?v=4" />
        <link rel="shortcut icon" href="/fm-mark.png?v=4" />
        <link rel="apple-touch-icon" href="/favicon-48.png?v=4" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap"
          rel="stylesheet"
        />
        <style id="expo-reset" dangerouslySetInnerHTML={{ __html: MF_WEB_DOCUMENT_STYLES }} />
      </head>
      <body translate="no" className="notranslate">
        <noscript>You need to enable JavaScript to run this app.</noscript>
        <div id="mf-boot-splash" aria-live="polite" aria-busy="true">
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid #e2e8f0',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'mf-spin 0.8s linear infinite',
            }}
          />
          <span>Carregando {APP_BRAND_NAME}…</span>
        </div>
        <div id="mf-portal-root" />
        {children}
        <div dangerouslySetInnerHTML={{ __html: MF_STATIC_LEGAL_FOOTER_HTML }} />
        <script dangerouslySetInnerHTML={{ __html: MF_WEB_BOOT_SCRIPT }} />
      </body>
    </html>
  )
}
