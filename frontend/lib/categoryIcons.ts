import { Ionicons } from '@expo/vector-icons';

const CATEGORY_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  alimentacao: 'restaurant-outline',
  alimentação: 'restaurant-outline',
  mercado: 'cart-outline',
  mercadorias: 'cube-outline',
  compra: 'cart-outline',
  transporte: 'car-outline',
  combustivel: 'car-outline',
  combustível: 'car-outline',
  pedagio: 'car-outline',
  pedágio: 'car-outline',
  casa: 'home-outline',
  aluguel: 'home-outline',
  agua: 'water-outline',
  água: 'water-outline',
  luz: 'flash-outline',
  energia: 'flash-outline',
  gas: 'flame-outline',
  gás: 'flame-outline',
  internet: 'wifi-outline',
  telefone: 'call-outline',
  celular: 'phone-portrait-outline',
  saude: 'medkit-outline',
  saúde: 'medkit-outline',
  farmacia: 'medkit-outline',
  farmácia: 'medkit-outline',
  'plano de saude': 'medkit-outline',
  'plano de saúde': 'medkit-outline',
  educacao: 'school-outline',
  educação: 'school-outline',
  salario: 'wallet-outline',
  salário: 'wallet-outline',
  'pro-labore': 'briefcase-outline',
  assinaturas: 'repeat-outline',
  receitas: 'trending-up-outline',
  'receitas diversas': 'cash-outline',
  imposto: 'document-text-outline',
  trabalho: 'briefcase-outline',
};

function normalizeCategoryKey(nome: string): string {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getCategoryIconName(nome: string): keyof typeof Ionicons.glyphMap {
  const key = normalizeCategoryKey(nome);
  if (CATEGORY_ICON_MAP[key]) return CATEGORY_ICON_MAP[key];
  for (const [pattern, icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (key.includes(pattern) || pattern.includes(key)) return icon;
  }
  return 'pricetag-outline';
}
