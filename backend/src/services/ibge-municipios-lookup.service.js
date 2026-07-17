import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeIbgeMunicipioCodigo } from '../utils/ibge-municipio-codigo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CSV_PATH = path.resolve(__dirname, '../../data/municipios.csv');
const REPO_ROOT_CSV_PATH = path.resolve(__dirname, '../../../../municipios.csv');

/** @type {Map<string, string>|null} */
let municipioIndex = null;

/**
 * Chave de busca: nome do município sem acento + UF (ex.: `rio de janeiro|RJ`).
 * @param {unknown} name
 * @param {unknown} uf
 * @returns {string}
 */
export const normalizeMunicipioLookupKey = (name, uf) => {
  const city = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const state = String(uf || '').trim().toUpperCase().slice(0, 2);
  if (!city || state.length !== 2) return '';
  return `${city}|${state}`;
};

const padIbge7 = (value) => {
  const digits = normalizeIbgeMunicipioCodigo(value);
  if (digits.length < 6 || digits.length > 7) return '';
  return digits.padStart(7, '0').slice(-7);
};

const readCsvText = (filePath) => {
  const buf = readFileSync(filePath);
  let text = buf.toString('utf8');
  if (text.includes('\uFFFD')) {
    text = buf.toString('latin1');
  }
  return text;
};

const resolveCsvPath = () => {
  const fromEnv = String(process.env.MUNICIPIOS_CSV_PATH || '').trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  if (existsSync(DEFAULT_CSV_PATH)) return DEFAULT_CSV_PATH;
  if (existsSync(REPO_ROOT_CSV_PATH)) return REPO_ROOT_CSV_PATH;
  return DEFAULT_CSV_PATH;
};

const loadMunicipioIndex = () => {
  if (municipioIndex) return municipioIndex;

  const csvPath = resolveCsvPath();
  if (!existsSync(csvPath)) {
    municipioIndex = new Map();
    return municipioIndex;
  }

  const index = new Map();
  const lines = readCsvText(csvPath).split(/\r?\n/).filter((line) => line.trim());

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(';');
    if (cols.length < 5) continue;

    const ibgeCode = padIbge7(cols[1]);
    const municipioTom = String(cols[2] || '').trim();
    const municipioIbge = String(cols[3] || '').trim();
    const uf = String(cols[4] || '').trim().toUpperCase().slice(0, 2);
    if (!ibgeCode || uf.length !== 2) continue;

    const keyIbge = normalizeMunicipioLookupKey(municipioIbge, uf);
    const keyTom = normalizeMunicipioLookupKey(municipioTom, uf);
    if (keyIbge) index.set(keyIbge, ibgeCode);
    if (keyTom && keyTom !== keyIbge) index.set(keyTom, ibgeCode);
  }

  municipioIndex = index;
  return municipioIndex;
};

/** Limpa cache em memória (testes). */
export const resetIbgeMunicipiosLookupCache = () => {
  municipioIndex = null;
};

/**
 * Resolve código IBGE (7 dígitos) a partir do nome do município e UF.
 * Usa tabela local `data/municipios.csv` (código TOM/IBGE PlugNotas).
 * @param {unknown} cidade
 * @param {unknown} uf
 * @returns {string|null}
 */
export const resolveIbgeCodigoFromMunicipio = (cidade, uf) => {
  const key = normalizeMunicipioLookupKey(cidade, uf);
  if (!key) return null;
  const ibge = loadMunicipioIndex().get(key);
  return ibge || null;
};
