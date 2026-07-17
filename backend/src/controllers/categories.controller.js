import * as categoriesService from '../services/categories.service.js';
import { sendSuccess } from '../utils/response.js';

export const listCategories = async (req, res, next) => {
  try {
    const tipoFilter = req.query?.type ?? req.query?.tipo;
    const minimal =
      req.query?.minimal === '1' ||
      req.query?.minimal === 'true' ||
      String(req.query?.minimal || '').toLowerCase() === 'yes';

    const rows = await categoriesService.listCategories(req.user.id, tipoFilter);

    const data = minimal ? categoriesService.mapCategoriesToMinimalRows(rows) : rows;

    return sendSuccess(res, data, 'Categorias listadas');
  } catch (error) {
    return next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const data = await categoriesService.createCategory(req.user.id, req.body);
    return sendSuccess(res, data, 'Categoria criada');
  } catch (error) {
    return next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const data = await categoriesService.updateCategory(req.user.id, req.body);
    return sendSuccess(res, data, 'Categoria atualizada');
  } catch (error) {
    return next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await categoriesService.deleteCategory(req.user.id, req.body, req.query);
    return sendSuccess(res, { success: true }, 'Categoria removida');
  } catch (error) {
    return next(error);
  }
};

export const listCategoryBudgets = async (req, res, next) => {
  try {
    const data = await categoriesService.listCategoryBudgets(req.user.id);
    return sendSuccess(res, data, 'Orçamentos listados');
  } catch (error) {
    return next(error);
  }
};

export const upsertCategoryBudget = async (req, res, next) => {
  try {
    const data = await categoriesService.upsertCategoryBudget(req.user.id, req.body);
    return sendSuccess(res, data, 'Orçamento atualizado');
  } catch (error) {
    return next(error);
  }
};

export const listCategoryBudgetsSummary = async (req, res, next) => {
  try {
    const year = req.query?.year ? Number(req.query.year) : undefined;
    const month = req.query?.month ? Number(req.query.month) : undefined;
    const data = await categoriesService.listCategoryBudgetsSummary(req.user.id, { year, month });
    return sendSuccess(res, data, 'Resumo de orçamento listado');
  } catch (error) {
    return next(error);
  }
};

export const listCategoryBudgetsYearly = async (req, res, next) => {
  try {
    const year = Number(req.query?.year);
    const data = await categoriesService.listCategoryBudgetsYearly(req.user.id, year);
    return sendSuccess(res, data, 'Orçamentos mensais listados');
  } catch (error) {
    return next(error);
  }
};

export const listCategoryBudgetsDreMatrix = async (req, res, next) => {
  try {
    const year = Number(req.query?.year);
    const data = await categoriesService.listCategoryBudgetsDreMatrix(req.user.id, year);
    return sendSuccess(res, data, 'Matriz DRE de orçamento listada');
  } catch (error) {
    return next(error);
  }
};

export const duplicateMonthlyBudgets = async (req, res, next) => {
  try {
    const { year, month } = req.body || {};
    const data = await categoriesService.duplicateMonthlyBudgets(req.user.id, {
      year: Number(year),
      month: Number(month)
    });
    return sendSuccess(res, data, 'Orçamentos duplicados');
  } catch (error) {
    return next(error);
  }
};
