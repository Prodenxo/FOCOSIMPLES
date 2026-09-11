import {
  Briefcase,
  Car,
  CreditCard,
  FileText,
  Flame,
  GraduationCap,
  HeartPulse,
  Home,
  Phone,
  Repeat,
  ShoppingCart,
  Tag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Zap,
} from 'lucide-react';

const CATEGORY_ICON_MAP = {
  alimentacao: UtensilsCrossed,
  alimentação: UtensilsCrossed,
  mercado: ShoppingCart,
  mercadorias: ShoppingCart,
  compra: ShoppingCart,
  compras: ShoppingCart,
  transporte: Car,
  combustivel: Car,
  combustível: Car,
  pedagio: Car,
  pedágio: Car,
  casa: Home,
  moradia: Home,
  aluguel: Home,
  agua: Zap,
  água: Zap,
  luz: Zap,
  energia: Zap,
  gas: Flame,
  gás: Flame,
  internet: Wifi,
  telefone: Phone,
  celular: Phone,
  saude: HeartPulse,
  saúde: HeartPulse,
  farmacia: HeartPulse,
  farmácia: HeartPulse,
  educacao: GraduationCap,
  educação: GraduationCap,
  salario: Wallet,
  salário: Wallet,
  'pro-labore': Briefcase,
  assinaturas: Repeat,
  receitas: TrendingUp,
  imposto: FileText,
  trabalho: Briefcase,
  lazer: CreditCard,
  contas: FileText,
};

function normalizeCategoryKey(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getCategoryIconComponent(nome) {
  const key = normalizeCategoryKey(nome);
  if (CATEGORY_ICON_MAP[key]) return CATEGORY_ICON_MAP[key];
  for (const [pattern, Icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (key.includes(pattern) || pattern.includes(key)) return Icon;
  }
  return Tag;
}
