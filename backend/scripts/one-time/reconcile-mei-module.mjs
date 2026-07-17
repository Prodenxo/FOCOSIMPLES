#!/usr/bin/env node
/**
 * Corrige MEI “fantasma” (max_mei:1 do cadastro) sem SQL manual.
 *
 * Uso (pasta Site/backend, .env de produção):
 *   node scripts/one-time/reconcile-mei-module.mjs --scope-file=scripts/one-time/scopes/mei-cadastro-bug-2026-06.json
 *   node scripts/one-time/reconcile-mei-module.mjs --scope-file=... --apply
 *   node scripts/one-time/reconcile-mei-module.mjs --empresa-id=UUID [--apply]
 *
 * Sem --scope-file nem --empresa-id: todas as empresas (evitar em produção).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseClient } from '../../src/config/supabase.js';
import { reconcileMeiModuleConsistency } from '../../src/services/users.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const empresaArg = args.find((arg) => arg.startsWith('--empresa-id='));
const scopedEmpresaId = empresaArg ? empresaArg.split('=')[1]?.trim() : '';
const scopeFileArg = args.find((arg) => arg.startsWith('--scope-file='));
const scopeFilePath = scopeFileArg ? scopeFileArg.split('=').slice(1).join('=').trim() : '';

const adminClient = createSupabaseClient({ useServiceRole: true });

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const normalizeCnpjList = (list) =>
  Array.from(new Set((list || []).map(onlyDigits).filter((c) => c.length === 14)));

const normalizeEmailList = (list) =>
  Array.from(
    new Set(
      (list || [])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

const loadScopeFromFile = (relativeOrAbsolute) => {
  const resolved = path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.resolve(process.cwd(), relativeOrAbsolute);
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    descricao: parsed.descricao || resolved,
    cnpjs: normalizeCnpjList(parsed.cnpjs),
    emails: normalizeEmailList(parsed.emails)
  };
};

const findEmpresaIdsByCnpj = async (cnpjs) => {
  const found = [];
  const missing = [];

  for (const cnpj of cnpjs) {
    const { data, error } = await adminClient
      .from('empresas')
      .select('id, empresa, cnpj, max_mei')
      .eq('cnpj', cnpj)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.id) {
      found.push({
        id: data.id,
        label: data.empresa || data.cnpj,
        cnpj: data.cnpj,
        maxMei: data.max_mei
      });
    } else {
      const { data: fuzzy } = await adminClient
        .from('empresas')
        .select('id, empresa, cnpj, max_mei')
        .ilike('cnpj', `%${cnpj}%`)
        .limit(2);

      if (fuzzy?.length === 1) {
        found.push({
          id: fuzzy[0].id,
          label: fuzzy[0].empresa || fuzzy[0].cnpj,
          cnpj: fuzzy[0].cnpj,
          maxMei: fuzzy[0].max_mei
        });
      } else {
        missing.push(cnpj);
      }
    }
  }

  return { found, missing };
};

const findUserIdByEmail = async (email) => {
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data?.users || [];
    const match = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (match?.id) return match.id;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
};

const findEmpresaIdsByEmails = async (emails) => {
  const found = [];
  const missing = [];

  for (const email of emails) {
    const userId = await findUserIdByEmail(email);
    if (!userId) {
      missing.push({ email, reason: 'usuario_nao_encontrado' });
      continue;
    }

    const { data: byRequester, error: reqErr } = await adminClient
      .from('empresas')
      .select('id, empresa, cnpj, max_mei')
      .eq('requested_by', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reqErr) throw new Error(reqErr.message);

    if (byRequester?.id) {
      found.push({
        id: byRequester.id,
        label: byRequester.empresa || email,
        cnpj: byRequester.cnpj,
        maxMei: byRequester.max_mei,
        email
      });
      continue;
    }

    const { data: linkRow, error: linkErr } = await adminClient
      .from('role_x_user_x_empresa')
      .select('empresas_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkErr) throw new Error(linkErr.message);

    if (!linkRow?.empresas_id) {
      missing.push({ email, reason: 'empresa_nao_vinculada' });
      continue;
    }

    const { data: empresa, error: empErr } = await adminClient
      .from('empresas')
      .select('id, empresa, cnpj, max_mei')
      .eq('id', linkRow.empresas_id)
      .maybeSingle();

    if (empErr) throw new Error(empErr.message);
    if (!empresa?.id) {
      missing.push({ email, reason: 'empresa_nao_encontrada' });
      continue;
    }

    found.push({
      id: empresa.id,
      label: empresa.empresa || email,
      cnpj: empresa.cnpj,
      maxMei: empresa.max_mei,
      email
    });
  }

  return { found, missing };
};

const loadEmpresaIds = async () => {
  if (scopedEmpresaId) {
    return {
      descricao: `empresa-id=${scopedEmpresaId}`,
      entries: [{ id: scopedEmpresaId, label: scopedEmpresaId }],
      missing: []
    };
  }

  if (scopeFilePath) {
    const scope = loadScopeFromFile(scopeFilePath);
    const byCnpj = await findEmpresaIdsByCnpj(scope.cnpjs);
    const byEmail = await findEmpresaIdsByEmails(scope.emails);

    const dedup = new Map();
    for (const row of [...byCnpj.found, ...byEmail.found]) {
      dedup.set(row.id, row);
    }

    return {
      descricao: scope.descricao,
      entries: Array.from(dedup.values()),
      missing: {
        cnpjs: byCnpj.missing,
        emails: byEmail.missing
      }
    };
  }

  const ids = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await adminClient
      .from('empresas')
      .select('id, empresa, cnpj, max_mei')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = data || [];
    for (const row of batch) {
      if (row.id) {
        ids.push({
          id: row.id,
          label: row.empresa || row.id,
          cnpj: row.cnpj,
          maxMei: row.max_mei
        });
      }
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return {
    descricao: 'TODAS as empresas (cuidado)',
    entries: ids,
    missing: []
  };
};

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
};

const main = async () => {
  const scope = await loadEmpresaIds();
  const empresaIds = scope.entries.map((e) => e.id);

  if (empresaIds.length === 0) {
    console.log('Nenhuma empresa no escopo.');
    return;
  }

  console.log(`Modo: ${apply ? 'APLICAR' : 'DRY-RUN (simulação)'}`);
  console.log(`Escopo: ${scope.descricao}`);
  console.log(`Empresas resolvidas: ${empresaIds.length}`);

  console.log('\n--- Empresas no escopo ---');
  for (const entry of scope.entries) {
    console.log(
      `- ${entry.label} | cnpj=${entry.cnpj || '—'} | max_mei=${entry.maxMei ?? '—'}${entry.email ? ` | ${entry.email}` : ''}`
    );
  }

  if (scope.missing && (scope.missing.cnpjs?.length || scope.missing.emails?.length)) {
    console.log('\n--- Não encontradas (revisar) ---');
    if (scope.missing.cnpjs?.length) {
      for (const cnpj of scope.missing.cnpjs) console.log(`CNPJ: ${cnpj}`);
    }
    if (scope.missing.emails?.length) {
      for (const row of scope.missing.emails) {
        console.log(`Email: ${row.email} (${row.reason})`);
      }
    }
  }

  let totalCleared = 0;
  let totalReset = 0;
  const allDetails = [];

  for (const batch of chunk(empresaIds, 50)) {
    const result = await reconcileMeiModuleConsistency(adminClient, batch, {
      dryRun: !apply
    });
    totalCleared += result.clearedLinks;
    totalReset += result.resetEmpresas;
    allDetails.push(...result.details);
  }

  console.log('\n--- Resumo ---');
  console.log(`Vínculos a corrigir (mei→false): ${totalCleared}`);
  console.log(`Empresas com max_mei a zerar: ${totalReset}`);

  if (allDetails.length > 0) {
    console.log('\n--- Alterações previstas/aplicadas ---');
    for (const detail of allDetails) {
      console.log(JSON.stringify(detail));
    }
  } else {
    console.log('\nNenhuma alteração necessária neste escopo.');
  }

  if (!apply) {
    console.log('\nNada foi alterado. Rode com --apply para persistir.');
  } else {
    console.log('\nCorreções aplicadas só no escopo acima. Peça logout/login aos clientes.');
  }
};

main().catch((error) => {
  console.error('Falha:', error?.message || error);
  process.exit(1);
});
