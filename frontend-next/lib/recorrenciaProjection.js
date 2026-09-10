/**
 * Projeções virtuais de recorrências (paridade com frontend/lib/recorrenciaProjection.ts).
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function buildSafeDate(year, month, dia) {
  const lastDay = new Date(year, month, 0).getDate();
  const dayClamped = Math.min(Math.max(dia, 1), lastDay);
  return `${year}-${pad2(month)}-${pad2(dayClamped)}`;
}

function diffMonths(fromYear, fromMonth, toYear, toMonth) {
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function projectRecurrences(
  recurrences,
  realTransactions,
  range,
  skips = [],
) {
  if (!recurrences?.length) return [];

  const materializedKeys = new Set();
  const orphanMatchKeys = new Set();
  const skippedKeys = new Set();

  for (const s of skips) {
    if (s.recorrencia_id && s.ano_mes) {
      skippedKeys.add(`${s.recorrencia_id}|${s.ano_mes}`);
    }
  }

  const normalizeTipoLocal = (tipo) => {
    const t = String(tipo || '').toLowerCase().trim();
    if (t === 'saída') return 'saida';
    return t;
  };

  for (const t of realTransactions) {
    if (t.recorrencia_id && t.recorrencia_ano_mes) {
      materializedKeys.add(`${t.recorrencia_id}|${t.recorrencia_ano_mes}`);
    } else if (!t.recorrencia_id && t.data && t.classificacao) {
      const anoMes = String(t.data).slice(0, 7);
      const key = `${String(t.classificacao).toLowerCase().trim()}|${normalizeTipoLocal(t.tipo)}|${anoMes}`;
      orphanMatchKeys.add(key);
    }
  }

  const totalMonths =
    diffMonths(range.startYear, range.startMonth, range.endYear, range.endMonth) + 1;
  if (totalMonths <= 0) return [];

  const out = [];

  for (const rec of recurrences) {
    if (!rec.ativo) continue;

    const limit = rec.max_ocorrencias ?? null;
    const criadoMes = rec.criado_em ? String(rec.criado_em).slice(0, 7) : null;
    const criadoYear = criadoMes ? Number(criadoMes.slice(0, 4)) : null;
    const criadoMonth = criadoMes ? Number(criadoMes.slice(5, 7)) : null;

    for (let offset = 0; offset < totalMonths; offset += 1) {
      const year = range.startYear + Math.floor((range.startMonth - 1 + offset) / 12);
      const monthIdx = ((range.startMonth - 1 + offset) % 12) + 1;
      const anoMes = `${year}-${pad2(monthIdx)}`;

      if (criadoMes && anoMes < criadoMes) continue;

      const occurrenceNumber =
        criadoYear != null && criadoMonth != null
          ? (year - criadoYear) * 12 + (monthIdx - criadoMonth) + 1
          : offset + 1;

      if (limit != null && occurrenceNumber > limit) break;
      if (materializedKeys.has(`${rec.id}|${anoMes}`)) continue;
      if (skippedKeys.has(`${rec.id}|${anoMes}`)) continue;

      const orphanKey = `${String(rec.classificacao || '').toLowerCase().trim()}|${normalizeTipoLocal(rec.tipo)}|${anoMes}`;
      if (orphanMatchKeys.has(orphanKey)) continue;

      const dataIso = buildSafeDate(year, monthIdx, rec.dia_do_mes);

      out.push({
        id: `proj_${rec.id}_${anoMes}`,
        user_id: rec.user_id,
        data: dataIso,
        tipo: rec.tipo,
        valor: rec.valor,
        classificacao: rec.classificacao,
        status: rec.status,
        obs: rec.obs ?? null,
        categoria: rec.categoria ?? null,
        recorrencia_id: rec.id,
        recorrencia_ano_mes: anoMes,
        __projecao: true,
      });
    }
  }

  return out;
}

export function isProjecao(t) {
  return Boolean(t?.__projecao) || (typeof t?.id === 'string' && t.id.startsWith('proj_'));
}

export function buildMaterializationPayload(p) {
  return {
    user_id: p.user_id,
    data: p.data,
    tipo: p.tipo,
    valor: p.valor,
    classificacao: p.classificacao,
    status: p.status,
    obs: p.obs,
    categoria: p.categoria,
    recorrencia_id: p.recorrencia_id,
    recorrencia_ano_mes: p.recorrencia_ano_mes,
  };
}
