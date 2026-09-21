/**
 * Gera `src/data/nfse-correlacao-reforma.js` a partir da planilha oficial de correlação
 * (cTribNac × cNBS × cClassTrib × CST × cIndOp) citada nas rejeições EM062 da NFS-e.
 *
 * Uso:
 *   node scripts/one-time/gerar-correlacao-reforma.mjs [caminho-da-planilha.xlsx]
 *
 * Sem argumento, baixa a planilha da fonte oficial.
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTE = 'https://www.notacontrol.com.br/download/nfse/Correlacao_TribNac_NBS_cClassTribIBSCBS_CSTIBSCBS_IndOp.xlsx';
const DESTINO = resolve(__dirname, '..', '..', 'src', 'data', 'nfse-correlacao-reforma.js');

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

const readPlanilha = async (argPath) => {
  if (argPath) return XLSX.readFile(argPath);
  const resp = await fetch(FONTE);
  if (!resp.ok) throw new Error(`Falha ao baixar a planilha oficial: HTTP ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  return XLSX.read(buffer, { type: 'buffer' });
};

const wb = await readPlanilha(process.argv[2]);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
if (!rows.length) throw new Error('Planilha sem linhas.');

const porTribNac = new Map();
const descricoesNbs = new Map();
const descricoesTribNac = new Map();

for (const row of rows) {
  const cTribNac = onlyDigits(row.cTribNac).padStart(6, '0');
  const cNBS = onlyDigits(row.cNBS);
  const cClassTrib = onlyDigits(row.cClassTrib).padStart(6, '0');
  const cst = onlyDigits(row.CST).padStart(3, '0');
  const cIndOp = onlyDigits(row.cIndOp).padStart(6, '0');
  if (cTribNac.length !== 6 || cNBS.length !== 9) continue;

  if (!porTribNac.has(cTribNac)) porTribNac.set(cTribNac, []);
  const lista = porTribNac.get(cTribNac);
  const chave = `${cNBS}|${cClassTrib}|${cst}|${cIndOp}`;
  if (!lista.some((item) => item.join('|') === chave)) {
    lista.push([cNBS, cClassTrib, cst, cIndOp]);
  }

  if (!descricoesNbs.has(cNBS)) {
    descricoesNbs.set(cNBS, String(row.xNBS ?? '').trim().slice(0, 110));
  }
  if (!descricoesTribNac.has(cTribNac)) {
    descricoesTribNac.set(cTribNac, String(row.xTribNac ?? '').trim().slice(0, 110));
  }
}

const sortedEntries = (map) => [...map.entries()].sort(([a], [b]) => a.localeCompare(b));

const serializeCombos = (lista) => lista
  .map(([nbs, cct, cst, indOp]) => `    ['${nbs}', '${cct}', '${cst}', '${indOp}'],`)
  .join('\n');

const blocosCorrelacao = sortedEntries(porTribNac)
  .map(([cTribNac, lista]) => `  '${cTribNac}': [\n${serializeCombos(lista)}\n  ],`)
  .join('\n');

const blocosNbs = sortedEntries(descricoesNbs)
  .map(([nbs, descricao]) => `  '${nbs}': ${JSON.stringify(descricao)},`)
  .join('\n');

const blocosTribNac = sortedEntries(descricoesTribNac)
  .map(([codigo, descricao]) => `  '${codigo}': ${JSON.stringify(descricao)},`)
  .join('\n');

const conteudo = `/**
 * ARQUIVO GERADO — não editar à mão.
 * Origem: ${FONTE}
 * Gerador: scripts/one-time/gerar-correlacao-reforma.mjs
 *
 * Tabela oficial de correlação da NFS-e (Reforma Tributária). A rejeição EM062
 * ("cTribNac, cNBS, cClassTrib e cIndOp não possuem correlação") aponta para ela.
 */

/** Fonte oficial da tabela. */
export const NFSE_CORRELACAO_REFORMA_FONTE = '${FONTE}';

/** Data de geração deste arquivo (ISO). */
export const NFSE_CORRELACAO_REFORMA_GERADO_EM = '${new Date().toISOString().slice(0, 10)}';

/**
 * Combinações válidas por código de tributação nacional (LC 116 com 6 dígitos).
 * Cada item: [cNBS, cClassTrib, CST, cIndOp].
 * @type {Readonly<Record<string, ReadonlyArray<readonly [string, string, string, string]>>>}
 */
export const NFSE_CORRELACAO_REFORMA_POR_TRIBNAC = Object.freeze({
${blocosCorrelacao}
});

/** Descrição oficial de cada NBS (para mensagens de erro). */
export const NFSE_CORRELACAO_NBS_DESCRICOES = Object.freeze({
${blocosNbs}
});

/** Descrição oficial de cada código de tributação nacional. */
export const NFSE_CORRELACAO_TRIBNAC_DESCRICOES = Object.freeze({
${blocosTribNac}
});
`;

fs.writeFileSync(DESTINO, conteudo, 'utf8');
console.log(`Gerado ${DESTINO}`);
console.log(`cTribNac: ${porTribNac.size} | combinações: ${rows.length} | NBS distintos: ${descricoesNbs.size}`);
