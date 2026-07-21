/**
 * OAuth Integra Contador (credenciais + e-CNPJ do contratante da plataforma).
 * O A1 da empresa NÃO entra aqui — só no Autentica Procurador.
 *
 * @see https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/quick_start/
 */
export { getSerproTokens as getPlatformSerproTokens } from './gestao/authProcurador.service.js'
