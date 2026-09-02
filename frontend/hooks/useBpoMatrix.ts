import { useCallback, useEffect, useState } from 'react';
import {
  fetchCategoryBudgetsDreMatrix,
  fetchUserCategories,
  type DreMatrixCell,
} from '../lib/categoryService';
import type { BpoCategory } from '../lib/bpoMatrix';

export function useBpoMatrix(userId: string | null, year: number) {
  const [categories, setCategories] = useState<BpoCategory[]>([]);
  const [cells, setCells] = useState<DreMatrixCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [cats, matrix] = await Promise.all([
        fetchUserCategories(userId),
        fetchCategoryBudgetsDreMatrix(userId, year),
      ]);

      const normalized: BpoCategory[] = (cats || [])
        .map((row) => ({
          id: Number(row.id),
          nome: String(row.nome || ''),
          tipo: String(row.tipo || ''),
        }))
        .filter((row) => row.id > 0 && row.nome);

      setCategories(normalized);
      setCells(matrix);
    } catch (err: unknown) {
      console.error('Erro ao carregar matriz BPO:', err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível carregar a matriz BPO.'
      );
    } finally {
      setLoading(false);
    }
  }, [userId, year]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { categories, cells, loading, error, refetch };
}
