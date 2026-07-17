/**
 * Shell HTML do export web.
 * - SPA (`expo export`): scripts/patch-web-index.mjs aplica estes trechos no dist/index.html
 * - Static (`web.output: "static"`): app/+html.tsx usa este módulo diretamente
 */

export const MF_WEB_DOCUMENT_STYLES = `
html,
body {
  height: 100%;
}
body {
  overflow: hidden;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#root {
  display: flex;
  height: 100%;
  flex: 1;
}

#mf-boot-splash {
  position: fixed;
  inset: 0;
  z-index: 99998;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #0D2B5E;
  color: rgba(255, 255, 255, 0.72);
  font-family: Inter, system-ui, sans-serif;
  font-size: 15px;
}

#mf-portal-root {
  position: relative;
  z-index: 30000;
}

*,
*::before,
*::after {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

*:focus {
  outline: none !important;
}

[role="button"],
[role="switch"],
[role="tab"],
[role="checkbox"],
button {
  cursor: pointer;
}

:root,
[data-mf-theme="dark"] {
  --mf-scroll-track: #0D2B5E;
  --mf-scroll-thumb: rgba(255, 255, 255, 0.22);
  --mf-scroll-thumb-hover: rgba(255, 255, 255, 0.38);
  --mf-scroll-size: 6px;
}

[data-mf-theme="light"] {
  --mf-scroll-track: #e8eef4;
  --mf-scroll-thumb: #c5d0e0;
  --mf-scroll-thumb-hover: #94a3b8;
  --mf-scroll-size: 8px;
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--mf-scroll-thumb) var(--mf-scroll-track);
}

*::-webkit-scrollbar {
  width: var(--mf-scroll-size);
  height: var(--mf-scroll-size);
}

*::-webkit-scrollbar-track {
  background: var(--mf-scroll-track);
  border-radius: 999px;
}

*::-webkit-scrollbar-thumb {
  background: var(--mf-scroll-thumb);
  border-radius: 999px;
  min-height: 48px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

*::-webkit-scrollbar-thumb:hover {
  background: var(--mf-scroll-thumb-hover);
  background-clip: padding-box;
}

*::-webkit-scrollbar-corner {
  background: var(--mf-scroll-track);
}

.mf-scroll-y {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  scrollbar-width: thin !important;
  scrollbar-color: var(--mf-scroll-thumb) var(--mf-scroll-track) !important;
}

.mf-scroll-y::-webkit-scrollbar {
  width: var(--mf-scroll-size);
  height: var(--mf-scroll-size);
  display: block;
}

.mf-scroll-y::-webkit-scrollbar-track {
  background: var(--mf-scroll-track);
  border-radius: 999px;
}

.mf-scroll-y::-webkit-scrollbar-thumb {
  background: var(--mf-scroll-thumb);
  border-radius: 999px;
  min-height: 48px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.mf-scroll-y::-webkit-scrollbar-thumb:hover {
  background: var(--mf-scroll-thumb-hover);
  background-clip: padding-box;
}

.mf-agenda-events-scroll {
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  align-self: stretch !important;
}

.mf-hide-x-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.mf-hide-x-scrollbar::-webkit-scrollbar {
  display: none;
  height: 0;
  width: 0;
}

.auth-legal-footer {
  display: block !important;
  flex: none !important;
  align-self: center !important;
}

.auth-legal-footer a {
  display: inline !important;
  white-space: nowrap;
}

.app-legal-footer a {
  display: inline !important;
  white-space: nowrap;
}

#mf-oauth-homepage-legal.mf-static-legal-footer {
  margin: 0;
  padding: 10px 16px;
  text-align: center;
  font-size: 12px;
  font-family: Inter, system-ui, sans-serif;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

@keyframes mf-spin {
  to {
    transform: rotate(360deg);
  }
}
`

/** Rodapé legal no HTML inicial (SEO / Google OAuth); oculto quando o React monta. */
export const MF_STATIC_LEGAL_FOOTER_HTML = `<footer id="mf-oauth-homepage-legal" class="mf-static-legal-footer" aria-label="Informações legais">
  <a href="/privacidade.html" style="color:#2563eb;font-weight:600;text-decoration:underline">Política de Privacidade</a>
  ·
  <a href="/termos.html" style="color:#2563eb;font-weight:600;text-decoration:underline">Termos de Uso</a>
</footer>`

export const MF_WEB_BOOT_SCRIPT = `
(function () {
  var CHUNK_AUTO_KEY = 'mf_chunk_auto_reload';
  var DOM_AUTO_KEY = 'mf_dom_auto_reload';

  try {
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    if (document.body) {
      document.body.setAttribute('translate', 'no');
      document.body.classList.add('notranslate');
    }
  } catch (e) {}

  function mfHardReload(clearStorage) {
    if (clearStorage) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
    }
    var url = new URL(window.location.href);
    url.searchParams.delete('_mf_reload');
    url.searchParams.set('_mf_reload', String(Date.now()));
    window.location.replace(url.toString());
  }

  function mfShowStaleCacheUI(clearStorage) {
    var splash = document.getElementById('mf-boot-splash');
    if (!splash) return;
    splash.style.display = 'flex';
    splash.setAttribute('aria-busy', 'false');
    splash.innerHTML =
      '<p style="margin:0 16px;text-align:center;max-width:380px;line-height:1.5;color:#475569">' +
      'Há uma <strong>versão antiga</strong> do site no cache do navegador. ' +
      'Toque abaixo para buscar a versão nova (pode pedir login de novo).</p>' +
      '<button type="button" style="margin-top:12px;padding:10px 18px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer" ' +
      'onclick="window.__mfHardReload(' + (clearStorage ? 'true' : 'false') + ')">Atualizar agora</button>' +
      '<p style="margin:12px 0 0;font-size:12px;color:#94a3b8">Se não resolver: Ctrl+Shift+R ou limpar dados do site no navegador</p>';
  }

  function mfTryAutoReloadOnce(storageKey) {
    try {
      var n = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
      if (n < 1) {
        sessionStorage.setItem(storageKey, String(n + 1));
        mfHardReload(false);
        return true;
      }
    } catch (e) {}
    return false;
  }

  window.__mfHardReload = mfHardReload;

  function mfHandleStaleChunk() {
    if (mfTryAutoReloadOnce(CHUNK_AUTO_KEY)) return;
    mfShowStaleCacheUI(true);
  }

  function mfHandleDomReconciliationError() {
    mfTryAutoReloadOnce(DOM_AUTO_KEY);
  }

  var BOOT_MS = 25000;
  window.setTimeout(function () {
    var splash = document.getElementById('mf-boot-splash');
    if (!splash || splash.style.display === 'none') return;

    // Se o React já montou por baixo do splash, só esconde — não força reload.
    var root = document.getElementById('root');
    if (root && root.childNodes && root.childNodes.length > 0) {
      splash.style.display = 'none';
      splash.setAttribute('aria-busy', 'false');
      return;
    }

    splash.style.display = 'flex';
    splash.setAttribute('aria-busy', 'false');
    splash.innerHTML =
      '<p style="margin:0 16px;text-align:center;max-width:400px;line-height:1.5;color:#e2e8f0">' +
      'O FocoMEI demorou para iniciar. Pode ser rede, env do servidor ou erro no console (F12).</p>' +
      '<button type="button" id="mf-boot-continue" style="margin-top:12px;padding:10px 18px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer">' +
      'Continuar mesmo assim</button>' +
      '<button type="button" id="mf-boot-reload" style="margin-top:10px;padding:10px 18px;border:1px solid rgba(255,255,255,0.35);border-radius:8px;background:transparent;color:#fff;font-weight:600;cursor:pointer">' +
      'Recarregar</button>' +
      '<p style="margin:12px 0 0;font-size:12px;color:rgba(255,255,255,0.55)">Abra F12 → Console e veja se há erro em vermelho</p>';

    var cont = document.getElementById('mf-boot-continue');
    if (cont) {
      cont.onclick = function () {
        splash.style.display = 'none';
        splash.setAttribute('aria-busy', 'false');
      };
    }
    var rel = document.getElementById('mf-boot-reload');
    if (rel) {
      rel.onclick = function () {
        window.__mfHardReload(false);
      };
    }
  }, BOOT_MS);

  window.addEventListener(
    'error',
    function (ev) {
      var msg = (ev && ev.message) || '';
      if (/removeChild|insertBefore|not a child of this node/i.test(msg)) {
        mfHandleDomReconciliationError();
        return;
      }
      if (
        !/chunk|Loading CSS|Failed to fetch dynamically imported module|imported module|Loading module/i.test(
          msg,
        )
      ) {
        return;
      }
      mfHandleStaleChunk();
    },
    true,
  );

  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev && ev.reason;
    var msg =
      reason && reason.message
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : '';
    if (/removeChild|insertBefore|not a child of this node/i.test(msg)) {
      mfHandleDomReconciliationError();
      return;
    }
    if (
      !/chunk|Loading CSS|Failed to fetch dynamically imported module|imported module|Loading module/i.test(
        msg,
      )
    ) {
      return;
    }
    mfHandleStaleChunk();
  });

  function mfHideStaticLegal() {
    var bar = document.getElementById('mf-oauth-homepage-legal');
    if (bar) bar.style.display = 'none';
  }
  window.addEventListener('DOMContentLoaded', mfHideStaticLegal);
  window.setTimeout(mfHideStaticLegal, 0);
})();
`
