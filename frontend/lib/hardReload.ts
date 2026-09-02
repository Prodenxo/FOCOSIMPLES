import { Platform } from 'react-native'

const CHUNK_AUTO_RELOAD_KEY = 'mf_chunk_auto_reload'
const DOM_AUTO_RELOAD_KEY = 'mf_dom_auto_reload'
const RELOAD_QUERY = '_mf_reload'

/** Mensagens típicas quando o index.html em cache aponta para chunks que já não existem no servidor. */
const STALE_CHUNK_PATTERN =
  /chunk|Loading CSS|Failed to fetch dynamically imported module|imported module|Loading module/i

export function isStaleChunkErrorMessage(message: string): boolean {
  return STALE_CHUNK_PATTERN.test(String(message || ''))
}

/** Erro típico quando o DOM foi alterado fora do React (splash dentro de #root, tradutor, extensões). */
export function isDomReconciliationErrorMessage(message: string): boolean {
  const msg = String(message || '')
  return /removeChild|insertBefore|not a child of this node/i.test(msg)
}

/** Esconde a barra legal estática do index.html (links passam para o rodapé React). */
export function hideStaticLegalBar(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  const bar = document.getElementById('mf-oauth-homepage-legal')
  if (!bar) return
  bar.style.display = 'none'
}

/** Esconde o splash estático após o React montar (web). */
export function hideBootSplash(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  const splash = document.getElementById('mf-boot-splash')
  if (!splash) return
  splash.style.display = 'none'
  splash.setAttribute('aria-busy', 'false')
  hideStaticLegalBar()
}

/** Container dedicado para portals — não usar `document.body` direto com RN Web. */
export function getWebPortalRoot(): HTMLElement | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null
  return (
    document.getElementById('mf-portal-root')
    || document.getElementById('root')
    || document.body
  )
}

/**
 * Recarrega forçando bypass de cache (query única + replace).
 * Em web, `location.reload()` sozinho mantém o index.html antigo em alguns navegadores/CDNs.
 */
export function hardReloadWithCacheBust(options: { clearStorage?: boolean } = {}): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return

  if (options.clearStorage) {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  }

  const url = new URL(window.location.href)
  url.searchParams.delete(RELOAD_QUERY)
  url.searchParams.set(RELOAD_QUERY, String(Date.now()))
  window.location.replace(url.toString())
}

/** Remove parâmetro de reload da URL após boot bem-sucedido. */
export function clearHardReloadQueryFromUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CHUNK_AUTO_RELOAD_KEY)
    sessionStorage.removeItem(DOM_AUTO_RELOAD_KEY)
    const url = new URL(window.location.href)
    if (!url.searchParams.has(RELOAD_QUERY)) return
    url.searchParams.delete(RELOAD_QUERY)
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, '', next)
  } catch {
    /* ignore */
  }
}

/**
 * Tenta um reload automático (uma vez por sessão) antes de mostrar UI manual.
 * Retorna true se disparou reload.
 */
function tryAutoHardReloadOnce(storageKey: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  try {
    const count = Number.parseInt(sessionStorage.getItem(storageKey) || '0', 10)
    if (count >= 1) return false
    sessionStorage.setItem(storageKey, String(count + 1))
    hardReloadWithCacheBust()
    return true
  } catch {
    return false
  }
}

export function tryAutoHardReloadForStaleChunk(): boolean {
  return tryAutoHardReloadOnce(CHUNK_AUTO_RELOAD_KEY)
}

export function tryAutoHardReloadForDomReconciliation(): boolean {
  return tryAutoHardReloadOnce(DOM_AUTO_RELOAD_KEY)
}

function readErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'string') return reason
  return ''
}

export function installWebStaleChunkRecovery(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return

  const onGlobalError = (message: string) => {
    if (isDomReconciliationErrorMessage(message)) {
      tryAutoHardReloadForDomReconciliation()
      return
    }
    if (isStaleChunkErrorMessage(message)) {
      tryAutoHardReloadForStaleChunk()
    }
  }

  window.addEventListener(
    'error',
    (ev) => {
      onGlobalError((ev as ErrorEvent).message || '')
    },
    true,
  )

  window.addEventListener('unhandledrejection', (ev) => {
    onGlobalError(readErrorMessage(ev.reason))
  })
}
