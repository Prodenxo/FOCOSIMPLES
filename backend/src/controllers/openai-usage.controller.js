import { sendSuccess } from '../utils/response.js';
import { getOpenAiUsageDashboard } from '../services/openai-usage.service.js';

export const getOpenAiUsage = async (req, res, next) => {
  try {
    const period = String(req.query?.period || 'month').trim().toLowerCase();
    const dashboard = await getOpenAiUsageDashboard({ period });
    return sendSuccess(res, dashboard, 'ok');
  } catch (error) {
    return next(error);
  }
};
