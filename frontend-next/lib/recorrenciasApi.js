import { apiClient } from './apiClient';

function normalizeRow(r) {
  return {
    id: String(r.id ?? ''),
    user_id: String(r.user_id ?? ''),
    dia_do_mes: Number(r.dia_do_mes ?? 0),
    valor: typeof r.valor === 'string' ? parseFloat(r.valor) : Number(r.valor),
    classificacao: String(r.classificacao ?? ''),
    tipo: String(r.tipo ?? ''),
    status: String(r.status ?? 'pago'),
    obs: r.obs != null ? String(r.obs) : null,
    categoria: r.categoria != null ? String(r.categoria) : null,
    ativo: Boolean(r.ativo),
    max_ocorrencias: r.max_ocorrencias != null ? Number(r.max_ocorrencias) : null,
    ocorrencias_geradas: r.ocorrencias_geradas != null ? Number(r.ocorrencias_geradas) : 0,
    criado_em: String(r.criado_em ?? ''),
    atualizado_em: String(r.atualizado_em ?? ''),
  };
}

export async function fetchRecorrencias() {
  const data = await apiClient.get('/recorrencias');
  return (data || []).map((r) => normalizeRow(r));
}

export async function fetchRecorrenciaSkips() {
  const data = await apiClient.get('/recorrencias/skips');
  return (data || []).map((row) => ({
    recorrencia_id: String(row.recorrencia_id ?? ''),
    ano_mes: String(row.ano_mes ?? ''),
  }));
}

export async function addRecorrenciaSkip(recorrenciaId, anoMes) {
  await apiClient.post('/recorrencias/skips', {
    recorrencia_id: recorrenciaId,
    ano_mes: anoMes,
  });
}

export async function createRecorrencia(row) {
  const payload = {
    ...row,
    valor: typeof row.valor === 'number' ? row.valor : parseFloat(String(row.valor)),
  };
  const data = await apiClient.post('/recorrencias', payload);
  return data ? normalizeRow(data) : null;
}

export async function updateRecorrencia(id, patch) {
  const data = { ...patch };
  if (patch.valor != null) {
    data.valor =
      typeof patch.valor === 'number' ? patch.valor : parseFloat(String(patch.valor));
  }
  await apiClient.put(`/recorrencias/${encodeURIComponent(id)}`, data);
}

export async function deleteRecorrencia(id) {
  const result = await apiClient.delete(`/recorrencias/${encodeURIComponent(id)}`);
  return { ok: true, mode: result?.mode === 'soft' ? 'soft' : 'hard' };
}

export { normalizeRow as normalizeRecorrenciaRow };
