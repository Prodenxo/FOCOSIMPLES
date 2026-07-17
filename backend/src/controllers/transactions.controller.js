import * as transactionsService from '../services/transactions.service.js';
import { sendSuccess } from '../utils/response.js';

export const listTransactions = async (req, res, next) => {
  try {
    const data = await transactionsService.listTransactions(req.user.id);
    return sendSuccess(res, data, 'Transações listadas');
  } catch (error) {
    return next(error);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const data = await transactionsService.createTransaction(req.user.id, req.body);
    return sendSuccess(res, data, 'Transação criada');
  } catch (error) {
    return next(error);
  }
};

export const updateTransaction = async (req, res, next) => {
  try {
    const data = await transactionsService.updateTransaction(req.user.id, req.body);
    return sendSuccess(res, data, 'Transação atualizada');
  } catch (error) {
    return next(error);
  }
};

export const deleteTransaction = async (req, res, next) => {
  try {
    await transactionsService.deleteTransaction(req.user.id, req.body, req.query);
    return sendSuccess(res, { success: true }, 'Transação removida');
  } catch (error) {
    return next(error);
  }
};
