import { forbidden } from '../utils/errors.js';
import { getRequesterContext } from '../services/users.service.js';

let getRequesterContextRef = getRequesterContext;

export const __setGetRequesterContextForTests = (resolver) => {
  getRequesterContextRef = resolver || getRequesterContext;
};

export const requireMeiEnabled = async (req, _res, next) => {
  try {
    const context = await getRequesterContextRef(req.accessToken, req.user);
    const isSuperadmin = context?.role === 'superadmin';
    if (!isSuperadmin && context?.mei !== true) {
      return next(forbidden('Acesso MEI desabilitado'));
    }
    req.requesterContext = context;
    return next();
  } catch (error) {
    return next(error);
  }
};
