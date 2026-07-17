import type { Recorrencia } from '../store/recorrenciaStore';

/**
 * Projeções virtuais de recorrências.
 *
 * Estratégia: o banco guarda apenas (a) a recorrência (template) e (b) os lançamentos
 * reais que o usuário materializou. As listagens combinam ambos: para cada mês exibido,
 * geramos linhas virtuais a partir das recorrências ativas que ainda não foram
 * materializadas naquele mês.
 *
 * Linhas projetadas são marcadas com `__projecao: true` e usam o id sintético
 * `proj_<recorrencia.id>_<ano-mes>` para que a UI possa distingui-las.
 */

export type ProjectedTransaction = {
  id: string; // sintético: "proj_<rec_id>_<YYYY-MM>"
  user_id: string;
  data: string; // YYYY-MM-DD
  tipo: string;
  valor: number;
  classificacao: string;
  status: string;
  obs?: string | null;
  categoria?: string | null;
  recorrencia_id: string;
  recorrencia_ano_mes: string;
  __projecao: true;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function buildSafeDate(year: number, month: number, dia: number): string {
  // Garante que o dia não exceda o último dia do mês (ex: dia 31 em fev → 28/29).
  const lastDay = new Date(year, month, 0).getDate();
  const dayClamped = Math.min(Math.max(dia, 1), lastDay);
  return `${year}-${pad2(month)}-${pad2(dayClamped)}`;
}

function diffMonths(fromYear: number, fromMonth: number, toYear: number, toMonth: number): number {
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/**
 * Gera projeções de recorrências para um intervalo [startYearMonth, endYearMonth] inclusivo.
 *
 * @param recurrences Recorrências ativas do usuário.
 * @param realTransactions Transações reais já materializadas (necessário para deduplicar).
 *                         Deve conter pelo menos os campos `recorrencia_id` e `recorrencia_ano_mes`.
 * @param range Período coberto pela view atual.
 * @param skips Ocorrências canceladas explicitamente pelo usuário (via "Apenas este
 *              lançamento"). Sem isso, ao deletar o lançamento real perdemos a chave
 *              de deduplicação e a projeção volta a aparecer.
 */
export function projectRecurrences(
  recurrences: Recorrencia[],
  realTransactions: Array<{
    recorrencia_id?: string | null;
    recorrencia_ano_mes?: string | null;
    classificacao?: string;
    tipo?: string;
    data?: string | null;
  }>,
  range: { startYear: number; startMonth: number; endYear: number; endMonth: number },
  skips: Array<{ recorrencia_id: string; ano_mes: string }> = []
): ProjectedTransaction[] {
  if (!recurrences?.length) return [];

  // Index dos lançamentos reais por (recorrencia_id, ano_mes) para dedupe O(1).
  const materializedKeys = new Set<string>();

  // Dedup auxiliar para transações ÓRFÃS (sem recorrencia_id) — criadas antes do
  // vínculo automático. Match por (classificacao, tipo normalizado, ano_mes).
  const orphanMatchKeys = new Set<string>();

  // Ocorrências canceladas explicitamente: tratamos como "já resolvidas" para
  // efeito de dedupe, igual a um lançamento real materializado.
  const skippedKeys = new Set<string>();
  for (const s of skips) {
    if (s.recorrencia_id && s.ano_mes) {
      skippedKeys.add(`${s.recorrencia_id}|${s.ano_mes}`);
    }
  }

  const normalizeTipoLocal = (tipo?: string) => {
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

  const totalMonths = diffMonths(range.startYear, range.startMonth, range.endYear, range.endMonth) + 1;
  if (totalMonths <= 0) return [];

  const out: ProjectedTransaction[] = [];

  for (const rec of recurrences) {
    if (!rec.ativo) continue;

    const limit = rec.max_ocorrencias ?? null;

    const criadoMes = rec.criado_em ? String(rec.criado_em).slice(0, 7) : null;
    // Componentes do mês de criação para cálculo de ocorrência absoluta.
    const criadoYear = criadoMes ? Number(criadoMes.slice(0, 4)) : null;
    const criadoMonth = criadoMes ? Number(criadoMes.slice(5, 7)) : null;

    for (let offset = 0; offset < totalMonths; offset++) {
      const year = range.startYear + Math.floor((range.startMonth - 1 + offset) / 12);
      const monthIdx = ((range.startMonth - 1 + offset) % 12) + 1;
      const anoMes = `${year}-${pad2(monthIdx)}`;

      // Não projeta meses anteriores ao mês de criação da recorrência.
      if (criadoMes && anoMes < criadoMes) continue;

      // Ocorrência absoluta (1-based) desde o mês de criação. Esta é a verdadeira
      // posição desta projeção no cronograma da recorrência — independe do que já
      // foi materializado ou skipado.
      const occurrenceNumber =
        criadoYear != null && criadoMonth != null
          ? (year - criadoYear) * 12 + (monthIdx - criadoMonth) + 1
          : offset + 1;

      // Se tem limite e esta ocorrência ultrapassa o limite, encerra. Como o loop
      // itera ano-mês em ordem crescente, todas as ocorrências futuras também
      // estariam fora do limite — break é seguro.
      if (limit != null && occurrenceNumber > limit) break;

      // Se já existe lançamento real desta recorrência neste mês, pula.
      if (materializedKeys.has(`${rec.id}|${anoMes}`)) continue;

      // Se o usuário cancelou explicitamente esta ocorrência ("Apenas este
      // lançamento"), pula — não regenera projeção.
      if (skippedKeys.has(`${rec.id}|${anoMes}`)) continue;

      // Fallback: lançamento órfão (sem recorrencia_id) com mesma classificação/tipo neste mês.
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

/** Detecta se uma transação é uma projeção virtual. */
export function isProjecao(t: { __projecao?: boolean; id?: string }): boolean {
  return Boolean(t.__projecao) || (typeof t.id === 'string' && t.id.startsWith('proj_'));
}

/**
 * Quando o usuário interage com uma projeção (clica pra editar/pagar), a UI deve
 * materializar — converter a projeção em lançamento real no banco. Esta função
 * devolve apenas o payload do INSERT; o caller decide quando/como persistir.
 */
export function buildMaterializationPayload(p: ProjectedTransaction) {
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
