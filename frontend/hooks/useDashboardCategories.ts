import { useState, useEffect, useCallback } from 'react';
import { normalizarTipo } from '../lib/dashboardUtils';
import { fetchUserCategories } from '../lib/categoryService';

export function useDashboardCategories(userId: string | null) {
  const [categoriasMap, setCategoriasMap] = useState<Record<string, string>>({});
  const [categoriasTipoMap, setCategoriasTipoMap] = useState<Record<string, 'entrada' | 'saida'>>({});

  const fetchCategories = useCallback(async () => {
    if (!userId) {
      setCategoriasMap({});
      setCategoriasTipoMap({});
      return;
    }
    try {
      const data = await fetchUserCategories(userId);
      const nameMap: Record<string, string> = {};
      const typeMap: Record<string, 'entrada' | 'saida'> = {};
      data.forEach((cat) => {
        const catId = String(cat.id ?? '');
        const nome = String(cat.nome ?? '');
        const tipo = normalizarTipo(String(cat.tipo ?? ''));
        nameMap[catId] = nome;
        typeMap[catId] = tipo;
      });
      setCategoriasMap(nameMap);
      setCategoriasTipoMap(typeMap);
    } catch {
      setCategoriasMap({});
      setCategoriasTipoMap({});
    }
  }, [userId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categoriasMap, categoriasTipoMap, fetchCategories };
}
