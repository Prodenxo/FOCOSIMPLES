import { forbidden } from '../utils/errors.js'
import { getRequesterContext } from '../services/users.service.js'
import { env } from '../config/env.js'

let getRequesterContextRef = getRequesterContext

export const __setGetRequesterContextForTests = (resolver) => {
  getRequesterContextRef = resolver || getRequesterContext
}

const isFocoSimplesProduct = () =>
  String(env.APP_PRODUCT || process.env.APP_PRODUCT || '')
    .trim()
    .toLowerCase() === 'focosimples'

/**
 * Gate de emissão fiscal:
 * exige liberação explícita (`mei === true` no vínculo); superadmin bypass.
 * Em Foco Simples a mensagem fala em emissão fiscal / Simples Nacional.
 */
export const requireMeiEnabled = async (req, _res, next) => {
  try {
    const context = await getRequesterContextRef(req.accessToken, req.user)
    const isSuperadmin = context?.role === 'superadmin'

    if (!isSuperadmin && context?.mei !== true) {
      const message = isFocoSimplesProduct()
        ? 'Emissão fiscal não liberada para este usuário. Ative o acesso em Gerenciar usuários.'
        : 'Acesso MEI desabilitado'
      return next(forbidden(message))
    }

    req.requesterContext = context
    return next()
  } catch (error) {
    return next(error)
  }
}

/** Alias semântico para Foco Simples (mesmo middleware). */
export const requireSimplesNacional = requireMeiEnabled
