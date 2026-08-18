import { getRequesterContext } from '../services/users.service.js';
import { forbidden } from '../utils/errors.js';
import { listAccountantClients } from '../services/accountant/accountant-access.service.js';
import {
  listClientProducts,
  createClientProduct,
  updateClientProduct,
  listClientEstablishments,
} from '../services/accountant/accountant-catalog.service.js';

const ROLE_ALLOWED = new Set(['admin', 'superadmin']);

let getRequesterContextRef = getRequesterContext;

/** @internal testes */
export const __setAccountantControllerDepsForTests = (deps = {}) => {
  getRequesterContextRef = deps.getRequesterContext ?? getRequesterContext;
};

/** @internal testes */
export const __resetAccountantControllerDepsForTests = () => {
  getRequesterContextRef = getRequesterContext;
};

const assertAccountantRole = async (req) => {
  const context = await getRequesterContextRef(req.accessToken, req.user);
  if (!ROLE_ALLOWED.has(context.role)) {
    throw forbidden('Acesso restrito a contadores e administradores');
  }
  return context;
};

export const listClients = async (req, res, next) => {
  try {
    const context = await assertAccountantRole(req);
    const clients = await listAccountantClients(context.userId);
    return res.json({ clients });
  } catch (err) {
    return next(err);
  }
};

export const listProducts = async (req, res, next) => {
  try {
    const context = await assertAccountantRole(req);
    const products = await listClientProducts(context.userId, req.params.empresaId, {
      q: req.query.q,
      limit: req.query.limit,
      documentType: req.query.documentType ?? 'NFE',
    });
    return res.json({ products });
  } catch (err) {
    return next(err);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const context = await assertAccountantRole(req);
    const product = await createClientProduct(context.userId, req.params.empresaId, req.body);
    return res.status(201).json({ product });
  } catch (err) {
    return next(err);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const context = await assertAccountantRole(req);
    const product = await updateClientProduct(
      context.userId,
      req.params.empresaId,
      req.params.productId,
      req.body,
    );
    return res.json({ product });
  } catch (err) {
    return next(err);
  }
};

export const listEstablishments = async (req, res, next) => {
  try {
    const context = await assertAccountantRole(req);
    const result = await listClientEstablishments(context.userId, req.params.empresaId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};
