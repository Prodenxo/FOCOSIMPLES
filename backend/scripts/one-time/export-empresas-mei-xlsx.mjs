#!/usr/bin/env node
/**
 * Exporta empresas com módulo MEI ativo (XLSX).
 *
 * Uso (pasta Site/backend):
 *   node scripts/one-time/export-empresas-mei-xlsx.mjs
 *   node scripts/one-time/export-empresas-mei-xlsx.mjs --output=./mei-empresas.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { createSupabaseClient } from '../../src/config/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const includeInactive = args.includes('--include-inactive');
const outputArg = args.find((arg) => arg.startsWith('--output='));
const defaultOutput = path.resolve(
  __dirname,
  `exports/empresas-mei-${new Date().toISOString().slice(0, 10)}.xlsx`
);
const outputPath = outputArg
  ? path.resolve(process.cwd(), outputArg.split('=').slice(1).join('=').trim())
  : defaultOutput;

const adminClient = createSupabaseClient({ useServiceRole: true });

const COLUMNS = [
  { key: 'empresa', label: 'Empresa' },
  { key: 'nome_fantasia', label: 'Nome fantasia' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'max_mei', label: 'Vagas MEI' },
  { key: 'mei_em_uso', label: 'MEI em uso' },
  { key: 'mei_disponivel', label: 'MEI disponível' },
  { key: 'stripe_mei_slots', label: 'Vagas Stripe' },
  { key: 'legacy_mei_slots_pix', label: 'Vagas PIX legado' },
  { key: 'mei_ativo', label: 'MEI ativo' },
  { key: 'created_at', label: 'Criada em' },
  { key: 'empresa_id', label: 'ID empresa' }
];

const normalizeMaxMei = (value) => {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const fetchAllEmpresas = async () => {
  const rows = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    const { data, error } = await adminClient
      .from('empresas')
      .select('id, empresa, nome_fantasia, cnpj, max_mei, legacy_mei_slots_pix, created_at')
      .order('empresa', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
};

const countMeiUsersByEmpresa = async (empresaIds) => {
  const counts = new Map(empresaIds.map((id) => [id, 0]));
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await adminClient
      .from('role_x_user_x_empresa')
      .select('empresas_id')
      .in('empresas_id', empresaIds)
      .eq('status', true)
      .eq('mei', true)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    for (const row of batch) {
      const id = row?.empresas_id;
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return counts;
};

const sumStripeMeiByEmpresa = async (empresaIds) => {
  const sums = new Map();
  const { data, error } = await adminClient
    .from('empresa_mei_subscription_lines')
    .select('empresa_id, mei_slots')
    .in('empresa_id', empresaIds)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    const id = row?.empresa_id;
    if (id) sums.set(id, (sums.get(id) || 0) + Number(row.mei_slots || 0));
  }
  return sums;
};

const writeXlsx = (rows, filePath) => {
  const sheetRows = [
    COLUMNS.map((col) => col.label),
    ...rows.map((row) => COLUMNS.map((col) => row[col.key] ?? ''))
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet['!cols'] = COLUMNS.map((col) => ({
    wch: Math.max(col.label.length, col.key === 'empresa_id' ? 36 : 18)
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Empresas MEI');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  XLSX.writeFile(workbook, filePath);
};

const main = async () => {
  const empresas = await fetchAllEmpresas();
  const empresaIds = empresas.map((e) => e.id).filter(Boolean);
  const [meiUsedByEmpresa, stripeByEmpresa] = await Promise.all([
    countMeiUsersByEmpresa(empresaIds),
    sumStripeMeiByEmpresa(empresaIds)
  ]);

  const rows = empresas
    .map((empresa) => {
      const maxMei = Math.max(
        normalizeMaxMei(empresa.max_mei),
        stripeByEmpresa.get(empresa.id) || 0
      );
      const meiEmUso = meiUsedByEmpresa.get(empresa.id) || 0;
      const meiAtivo = maxMei > 0 || meiEmUso > 0;
      return {
        empresa_id: empresa.id,
        empresa: empresa.empresa || '',
        nome_fantasia: empresa.nome_fantasia || '',
        cnpj: empresa.cnpj || '',
        max_mei: maxMei,
        mei_em_uso: meiEmUso,
        mei_disponivel: Math.max(0, maxMei - meiEmUso),
        stripe_mei_slots: stripeByEmpresa.get(empresa.id) || 0,
        legacy_mei_slots_pix: normalizeMaxMei(empresa.legacy_mei_slots_pix),
        mei_ativo: meiAtivo ? 'sim' : 'nao',
        created_at: empresa.created_at || ''
      };
    })
    .filter((row) => (includeInactive ? true : row.mei_ativo === 'sim'))
    .sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'));

  const resolvedOutput = outputPath.toLowerCase().endsWith('.xlsx')
    ? outputPath
    : `${outputPath}.xlsx`;

  writeXlsx(rows, resolvedOutput);

  console.log(`Empresas exportadas: ${rows.length}`);
  console.log(`Total vagas MEI: ${rows.reduce((s, r) => s + r.max_mei, 0)}`);
  console.log(`Total MEI em uso: ${rows.reduce((s, r) => s + r.mei_em_uso, 0)}`);
  console.log(`Arquivo: ${resolvedOutput}`);
};

main().catch((error) => {
  console.error('Falha:', error?.message || error);
  process.exit(1);
});
