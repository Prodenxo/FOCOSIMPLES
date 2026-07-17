import { sendSuccess } from '../utils/response.js';
import {
  getRatesToBrl,
  listFrankfurterCurrencies,
} from '../services/frankfurter.service.js';

export const listCurrencies = async (_req, res, next) => {
  try {
    const currencies = await listFrankfurterCurrencies();
    return sendSuccess(res, { currencies });
  } catch (error) {
    return next(error);
  }
};

export const getCotacoes = async (req, res, next) => {
  try {
    const raw = String(req.query?.codes || req.query?.moedas || '').trim();
    const codes = raw
      ? raw.split(/[,\s]+/).map((c) => c.trim()).filter(Boolean)
      : ['USD', 'EUR'];
    const rates = await getRatesToBrl(codes);
    return sendSuccess(res, { base: 'BRL', rates, updatedAt: new Date().toISOString() });
  } catch (error) {
    return next(error);
  }
};
