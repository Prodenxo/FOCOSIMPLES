import * as invitesService from '../services/empresa-invites.service.js';
import { sendSuccess } from '../utils/response.js';

export const createInvite = async (req, res, next) => {
  try {
    const result = await invitesService.createInvite(req.accessToken, req.body || {}, req);
    return sendSuccess(res, result, 'Convite criado');
  } catch (error) {
    return next(error);
  }
};

export const listInvites = async (req, res, next) => {
  try {
    const result = await invitesService.listPendingInvites(req.accessToken, req.query || {});
    return sendSuccess(res, result, 'Convites pendentes');
  } catch (error) {
    return next(error);
  }
};

export const revokeInvite = async (req, res, next) => {
  try {
    const result = await invitesService.revokeInvite(req.accessToken, req.params.inviteId);
    return sendSuccess(res, result, 'Convite revogado');
  } catch (error) {
    return next(error);
  }
};

/** POST /invites/accept — autenticado; corpo `{ "token": "<raw>" }` (US-INV-03). */
export const acceptInvite = async (req, res, next) => {
  try {
    const token = req.body?.token;
    const bodyMei = req.body?.mei;
    const deps =
      typeof bodyMei === 'boolean'
        ? { mei: bodyMei }
        : {};
    const result = await invitesService.acceptInvite(
      req.accessToken,
      typeof token === 'string' ? token : undefined,
      deps
    );
    return sendSuccess(res, result, 'Convite aceito');
  } catch (error) {
    return next(error);
  }
};

/** GET /invites/validate?token= */
export const validateInviteGet = async (req, res, next) => {
  try {
    const token = req.query?.token;
    const result = await invitesService.validateInviteToken(
      typeof token === 'string' ? token : undefined
    );
    return res.status(200).json({ success: true, data: result, message: 'OK', errors: null });
  } catch (error) {
    return next(error);
  }
};

/** POST /invites/validate { "token": "..." } */
export const validateInvitePost = async (req, res, next) => {
  try {
    const token = req.body?.token;
    const result = await invitesService.validateInviteToken(
      typeof token === 'string' ? token : undefined
    );
    return res.status(200).json({ success: true, data: result, message: 'OK', errors: null });
  } catch (error) {
    return next(error);
  }
};
