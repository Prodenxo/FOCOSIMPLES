import { forbidden } from '../utils/errors.js';
import { getRequesterContext } from '../services/users.service.js';

export const requireSuperAdmin = async (req, _res, next) => {
  try {
    const context = await getRequesterContext(req.accessToken, req.user);
    if (context?.role === 'superadmin') {
      req.requesterContext = context;
      return next();
    }

    // Ao acessar uma empresa como cliente, o JWT assinado carrega o ator original.
    // Não confiar só no texto do claim: confirma no banco que o ator continua superadmin.
    const actorId = req.user?.app_metadata?.impersonated_by;
    const claimedRole = req.user?.app_metadata?.impersonator_role;
    if (actorId && claimedRole === 'superadmin') {
      const actorContext = await getRequesterContext(null, { id: actorId });
      if (actorContext?.role === 'superadmin') {
        req.requesterContext = actorContext;
        req.impersonatedUserContext = context;
        return next();
      }
    }

    return next(forbidden());
  } catch (error) {
    return next(error);
  }
};
