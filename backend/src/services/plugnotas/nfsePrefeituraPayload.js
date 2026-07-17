/**
 * Trilho B (P0) — derivação opcional de `nfse.config.prefeitura` a partir do endereço (código IBGE 7 dígitos).
 *
 * Documentação pública Plugnotas (exemplo TecnoSpeed) usa frequentemente `prefeitura.login` / `prefeitura.senha`
 * para NFS-e municipal. O ramo **codigoIbge** abaixo destina-se a ambientes onde o validador aceita identificação
 * municipal só pelo IBGE no objecto `prefeitura`, ou como complemento quando o cliente já enviou credenciais sem código.
 * Confirmar com NFR-PREF-EV-01 / operação antes de activar em produção.
 *
 * @see docs/stories/story-fr-cons-p0-plugnotas-empresa-backend-trilho-b-nfse-prefeitura.md
 * @see docs/adr/ADR-plugnotas-empresa-payload-apenas-nfse.md
 */

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * @param {unknown} value
 * @returns {string} só dígitos
 */
const onlyDigits = (value) => {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
};

/**
 * Quando activo, garante `nfse.config.prefeitura.codigoIbge` a partir de `endereco.codigoCidade` (7 dígitos).
 * Não remove nem sobrescreve `login` / `senha` já enviados pelo cliente.
 *
 * @param {Record<string, unknown>} payload — mutado in-place
 * @param {{ derivePrefeituraIbge?: boolean }} [options]
 * @returns {boolean} `true` se o payload foi alterado
 */
export function applyNfseConfigPrefeituraDeriveIbge(payload, options = {}) {
  if (options.derivePrefeituraIbge !== true) return false;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;

  const nfse = payload.nfse;
  if (!nfse || typeof nfse !== 'object' || Array.isArray(nfse)) return false;
  if (nfse.ativo === false) return false;

  const endereco = payload.endereco;
  if (!endereco || typeof endereco !== 'object' || Array.isArray(endereco)) return false;

  const codigo = onlyDigits(endereco.codigoCidade);
  if (codigo.length !== 7) return false;

  const baseConfig =
    nfse.config && typeof nfse.config === 'object' && !Array.isArray(nfse.config)
      ? { ...nfse.config }
      : { producao: true };

  if (hasOwn(baseConfig, 'prefeitura')) {
    const existingPref = baseConfig.prefeitura;
    if (existingPref != null && (typeof existingPref !== 'object' || Array.isArray(existingPref))) {
      return false;
    }
    if (existingPref != null) {
      const merged = { ...existingPref };
      const currentIbge = merged.codigoIbge;
      const ibgeEmpty =
        currentIbge == null
        || (typeof currentIbge === 'string' && currentIbge.trim() === '')
        || (typeof currentIbge === 'number' && !Number.isFinite(currentIbge));
      if (!ibgeEmpty) return false;
      merged.codigoIbge = codigo;
      baseConfig.prefeitura = merged;
      nfse.config = baseConfig;
      payload.nfse = nfse;
      return true;
    }
  }

  baseConfig.prefeitura = { codigoIbge: codigo };
  nfse.config = baseConfig;
  payload.nfse = nfse;
  return true;
}
