#!/usr/bin/env node
/**
 * Injeta shell web (splash, portal, anti-tradutor) no index.html do export SPA.
 * O Expo Router em modo `single` ignora web/index.html e app/+html.tsx.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadShellFromTs() {
  const source = readFileSync(path.join(__dirname, '../lib/webShellDocument.ts'), 'utf8')
  const stylesMatch = source.match(
    /export const MF_WEB_DOCUMENT_STYLES = `([\s\S]*?)`\s*\n\s*\/\*\* Rodapé legal/,
  )
  const footerMatch = source.match(
    /export const MF_STATIC_LEGAL_FOOTER_HTML = `([\s\S]*?)`\s*\n\s*export const MF_WEB_BOOT_SCRIPT/,
  )
  const bootMatch = source.match(/export const MF_WEB_BOOT_SCRIPT = `([\s\S]*?)`\s*$/)
  if (!stylesMatch || !footerMatch || !bootMatch) {
    throw new Error('patch-web-index: não foi possível ler lib/webShellDocument.ts')
  }
  return {
    styles: stylesMatch[1],
    footer: footerMatch[1],
    boot: bootMatch[1],
  }
}

function patchIndexHtml(html, { styles, footer, boot }) {
  if (html.includes('id="mf-boot-splash"')) {
    return { html, alreadyPatched: true }
  }

  const headInject = `
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <meta name="google" content="notranslate" />
    <link rel="icon" type="image/png" sizes="32x32" href="/fm-mark.png?v=4" />
    <link rel="shortcut icon" href="/fm-mark.png?v=4" />
    <link rel="apple-touch-icon" href="/favicon-48.png?v=4" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet" />
    <style id="mf-web-shell">${styles}</style>`

  const bodyInject = `
    <div id="mf-boot-splash" aria-live="polite" aria-busy="true">
      <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:mf-spin 0.8s linear infinite"></div>
      <span>Carregando FocoMEI…</span>
    </div>
    <div id="mf-portal-root"></div>`

  const footerInject = footer.trim()

  let next = html
  next = next.replace(/<html lang="en">/, '<html lang="pt-BR" translate="no" class="notranslate">')
  next = next.replace(/<body>/, '<body translate="no" class="notranslate">')
  next = next.replace('</head>', `${headInject}\n  </head>`)
  next = next.replace('<div id="root"></div>', `${bodyInject}\n    <div id="root"></div>\n    ${footerInject}`)
  next = next.replace('</body>', `<script>${boot}</script>\n  </body>`)
  return { html: next, alreadyPatched: false }
}

const indexPath = path.resolve(process.argv[2] || 'dist/index.html')
const shell = loadShellFromTs()
const original = readFileSync(indexPath, 'utf8')
const { html, alreadyPatched } = patchIndexHtml(original, shell)

if (alreadyPatched) {
  console.log(`patch-web-index: já aplicado em ${indexPath}`)
  process.exit(0)
}

writeFileSync(indexPath, html)
console.log(`patch-web-index: shell aplicada em ${indexPath}`)
