import { forbidden } from '../utils/errors.js';
import { getRequesterContext } from '../services/users.service.js';

export const requireAdmin = async (req, _res, next) => {
  try {
    const context = await getRequesterContext(req.accessToken, req.user);
    if (!context?.role || (context.role !== 'admin' && context.role !== 'superadmin')) {
      return next(forbidden());
    }

    req.requesterContext = context;
    return next();
  } catch (error) {
    return next(error);
  }
};
