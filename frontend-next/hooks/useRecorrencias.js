'use client';

import { useCallback, useState } from 'react';
import {
  addRecorrenciaSkip,
  createRecorrencia,
  deleteRecorrencia,
  fetchRecorrenciaSkips,
  fetchRecorrencias,
  updateRecorrencia,
} from '@/lib/recorrenciasApi';

export function useRecorrencias() {
  const [recorrencias, setRecorrencias] = useState([]);
  const [skips, setSkips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, skipRows] = await Promise.all([
        fetchRecorrencias(),
        fetchRecorrenciaSkips().catch(() => []),
      ]);
      setRecorrencias(recs);
      setSkips(skipRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recorrências');
    } finally {
      setLoading(false);
    }
  }, []);

  const addSkip = useCallback(async (recorrenciaId, anoMes) => {
    await addRecorrenciaSkip(recorrenciaId, anoMes);
    setSkips((prev) => {
      if (prev.some((s) => s.recorrencia_id === recorrenciaId && s.ano_mes === anoMes)) {
        return prev;
      }
      return [...prev, { recorrencia_id: recorrenciaId, ano_mes: anoMes }];
    });
  }, []);

  const addRecorrencia = useCallback(async (row) => {
    setError(null);
    try {
      const created = await createRecorrencia(row);
      await loadAll();
      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar recorrência';
      setError(msg);
      return null;
    }
  }, [loadAll]);

  const updateRecorrenciaById = useCallback(async (id, patch) => {
    setError(null);
    try {
      await updateRecorrencia(id, patch);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar recorrência');
    }
  }, [loadAll]);

  const removeRecorrencia = useCallback(async (id) => {
    setError(null);
    try {
      const result = await deleteRecorrencia(id);
      await loadAll();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir recorrência';
      setError(msg);
      return { ok: false, error: msg };
    }
  }, [loadAll]);

  return {
    recorrencias,
    skips,
    loading,
    error,
    loadAll,
    addSkip,
    addRecorrencia,
    updateRecorrencia: updateRecorrenciaById,
    deleteRecorrencia: removeRecorrencia,
  };
}
