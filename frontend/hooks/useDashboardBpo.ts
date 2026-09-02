import { useState, useEffect, useCallback } from 'react';
import { fetchCategoryBudgetsYearly } from '../lib/categoryService';

export function useDashboardBpo(userId: string | null, bpoYear: number) {
  const [bpoBudgetRows, setBpoBudgetRows] = useState<unknown[]>([]);
  const [bpoLoading, setBpoLoading] = useState(false);

  const loadBpoBudgets = useCallback(async () => {
    if (!userId) {
      setBpoBudgetRows([]);
      return;
    }
    setBpoLoading(true);
    const rows = await fetchCategoryBudgetsYearly(userId, bpoYear);
    setBpoBudgetRows(Array.isArray(rows) ? rows : []);
    setBpoLoading(false);
  }, [userId, bpoYear]);

  useEffect(() => {
    loadBpoBudgets();
  }, [loadBpoBudgets]);

  return { bpoBudgetRows, bpoLoading };
}
