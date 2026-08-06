/**
 * Dicionário comercial — sinônimos de varejo → NCM prioritário.
 * Consultado antes da busca genérica no catálogo fiscal.
 */

const normalizeAliasKey = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const tokenizeAlias = (value) => normalizeAliasKey(value)
  .split(/[^a-z0-9]+/)
  .filter((w) => w.length >= 2);

/** @type {Array<{ codes: string[], terms: string[], hint?: string }>} */
export const NCM_RETAIL_ALIAS_ENTRIES = [
  {
    codes: ['22021000'],
    hint: 'Águas e refrigerantes',
    terms: [
      'refrigerante', 'refrigerantes', 'refri', 'soda', 'refrigerante de cola',
      'coca', 'coca cola', 'cocacola', 'coca-cola', 'pepsi', 'guarana', 'guaraná',
      'fanta', 'sprite', 'schweppes', 'refrigerante guarana',
    ],
  },
  {
    codes: ['22030000'],
    hint: 'Cervejas de malte',
    terms: ['cerveja', 'cervejas', 'chopp', 'chope', 'chopp', 'malte', 'pilsen', 'lager'],
  },
  {
    codes: ['22011000'],
    hint: 'Água mineral',
    terms: [
      'agua', 'água', 'agua mineral', 'água mineral', 'agua de mesa', 'água de mesa',
      'agua sem gas', 'água sem gás', 'agua com gas', 'água com gás',
    ],
  },
  {
    codes: ['19053100'],
    hint: 'Biscoitos e bolachas',
    terms: ['biscoito', 'biscoitos', 'bolacha', 'bolachas', 'cookie', 'cookies'],
  },
  {
    codes: ['34022000'],
    hint: 'Detergentes',
    terms: [
      'detergente', 'detergentes', 'lava louca', 'lava-louça', 'lava louça',
      'detergente liquido', 'detergente líquido', 'detergente em po', 'detergente em pó',
    ],
  },
  {
    codes: ['34011190'],
    hint: 'Sabonetes',
    terms: ['sabao', 'sabão', 'sabonete', 'sabonetes', 'sabonete liquido', 'sabonete líquido'],
  },
  {
    codes: ['24022000'],
    hint: 'Cigarros',
    terms: ['cigarro', 'cigarros', 'tabaco', 'cigarrilha', 'cigarrilhas'],
  },
];

/** Capítulos NCM típicos de varejo alimentício, bebidas e limpeza. */
export const RETAIL_NCM_CHAPTER_PREFIXES = new Set([
  '01', '02', '03', '04', '07', '08', '09', '10', '11', '12', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24',
  '33', '34',
]);

/** Termos que indicam uso industrial/médico — penalizados em buscas de varejo. */
export const INDUSTRIAL_MEDICAL_PENALTY_TERMS = [
  'equipamento', 'equipamentos', 'maquina', 'máquina', 'maquinaria', 'industrial', 'industriais',
  'hospitalar', 'medicinal', 'farmaceut', 'farmacêut', 'uso veterinario', 'uso veterinário',
  'sem fins alimentares', 'destinado a', 'partes e pecas', 'partes e peças', 'reator',
  'refrigerador', 'refrigeradores', 'refrigeracao', 'refrigeração', 'compressor', 'compressores',
  'folha de coca', 'erythroxylum', 'planta de coca', 'coca (planta)', 'insumo quimico', 'insumo químico',
  'laboratorio', 'laboratório', 'protese', 'prótese', 'aparelho', 'aparelhos', 'tubo', 'tubos',
  'valvula', 'válvula', 'motor', 'motores', 'gerador', 'geradores',
];

/** Penalidades contextuais: termo buscado → padrões a evitar na descrição. */
export const CONTEXTUAL_FALSE_POSITIVE_RULES = [
  {
    queryTokens: ['refrigerante', 'refri', 'soda', 'coca', 'pepsi', 'guarana', 'guaraná'],
    descriptionPatterns: [/refrigerador/i, /refrigera(?:c|ç)(?:ao|ão)/i, /equipamento/i, /maquina/i, /máquina/i],
    penalty: 40,
  },
  {
    queryTokens: ['coca'],
    descriptionPatterns: [/folha de coca/i, /erythroxylum/i, /planta de coca/i, /\bcoca\b.*\bplanta\b/i],
    penalty: 50,
  },
  {
    queryTokens: ['agua', 'água'],
    descriptionPatterns: [/agua (?:de|para) (?:uso|processo)/i, /água (?:de|para) (?:uso|processo)/i, /industrial/i],
    penalty: 15,
  },
];

/**
 * Resolve códigos NCM a partir de termos comerciais conhecidos.
 * @param {string} query
 * @returns {string[]}
 */
export const resolveRetailNcmAliasCodes = (query) => {
  const normalized = normalizeAliasKey(query);
  if (!normalized) return [];

  const words = tokenizeAlias(query);
  const codes = new Set();

  for (const entry of NCM_RETAIL_ALIAS_ENTRIES) {
    let matched = false;
    for (const term of entry.terms) {
      const t = normalizeAliasKey(term);
      if (!t) continue;

      if (normalized === t) {
        matched = true;
        break;
      }

      if (t.length >= 4 && (normalized.includes(t) || t.includes(normalized))) {
        matched = true;
        break;
      }

      if (words.some((w) => w === t || (t.length >= 4 && w.includes(t)) || (w.length >= 4 && t.includes(w)))) {
        matched = true;
        break;
      }
    }

    if (matched) {
      entry.codes.forEach((code) => codes.add(code));
    }
  }

  return [...codes];
};

/** @param {string} code */
export const isRetailNcmChapter = (code) => {
  const normalized = String(code ?? '').replace(/\D/g, '').slice(0, 8);
  if (normalized.length < 2) return false;
  return RETAIL_NCM_CHAPTER_PREFIXES.has(normalized.slice(0, 2));
};

/**
 * @param {string} description
 * @param {string[]} tokens
 */
export const scoreIndustrialMedicalPenalty = (description, tokens = []) => {
  const desc = normalizeAliasKey(description);
  let penalty = 0;

  for (const term of INDUSTRIAL_MEDICAL_PENALTY_TERMS) {
    if (desc.includes(normalizeAliasKey(term))) penalty += 6;
  }

  const normalizedTokens = tokens.map((t) => normalizeAliasKey(t)).filter(Boolean);
  for (const rule of CONTEXTUAL_FALSE_POSITIVE_RULES) {
    const queryHit = rule.queryTokens.some((qt) => {
      const key = normalizeAliasKey(qt);
      return normalizedTokens.some((t) => t === key || t.includes(key) || key.includes(t));
    });
    if (!queryHit) continue;
    for (const pattern of rule.descriptionPatterns) {
      if (pattern.test(String(description ?? ''))) {
        penalty += rule.penalty;
        break;
      }
    }
  }

  return penalty;
};

/** @param {string} code @param {string} hint */
export const buildRetailAliasLabel = (code, hint) => {
  const digits = String(code ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return hint || '';
  const display = `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  return hint ? `${display} - ${hint} (varejo)` : `${display} (varejo)`;
};
