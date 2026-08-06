/**
 * NCMs sujeitos a ST em operação interna RJ → RJ (varejo).
 * Base: segmentos mais comuns em MEI/comércio. Ajustável via seed/migration.
 *
 * has_st=true, origin_uf=RJ, destination_uf=RJ
 * cfop_st=5405 (revenda com ST estadual)
 */

/** @typedef {{ ncm: string, segment: string, label: string }} TaxRuleSeedEntry */

/** @type {TaxRuleSeedEntry[]} */
export const TAX_RULES_RJ_RETAIL_ST_ENTRIES = [
  // Bebidas
  { ncm: '22021000', segment: 'bebidas', label: 'Refrigerantes e águas gaseificadas' },
  { ncm: '22030000', segment: 'bebidas', label: 'Cervejas de malte' },
  { ncm: '22011000', segment: 'bebidas', label: 'Águas minerais' },
  { ncm: '22029000', segment: 'bebidas', label: 'Outras bebidas não alcoólicas' },
  { ncm: '22029900', segment: 'bebidas', label: 'Outras bebidas não alcoólicas (detalhe)' },
  { ncm: '22029100', segment: 'bebidas', label: 'Cerveja de malte (alternativa)' },
  { ncm: '22042200', segment: 'bebidas', label: 'Vinhos de uvas frescas' },

  // Alimentos
  { ncm: '19053100', segment: 'alimentos', label: 'Biscoitos e bolachas' },
  { ncm: '19059090', segment: 'alimentos', label: 'Outros produtos de panificação' },
  { ncm: '18063210', segment: 'alimentos', label: 'Chocolates em barras' },
  { ncm: '18069000', segment: 'alimentos', label: 'Outros preparações de cacau/chocolate' },
  { ncm: '04011010', segment: 'alimentos', label: 'Leite UHT' },
  { ncm: '04012010', segment: 'alimentos', label: 'Leite com teor de gordura <= 1%' },
  { ncm: '04015010', segment: 'alimentos', label: 'Leite em pó' },
  { ncm: '04061090', segment: 'alimentos', label: 'Queijos' },
  { ncm: '04032000', segment: 'alimentos', label: 'Iogurte e leite fermentado' },
  { ncm: '21069090', segment: 'alimentos', label: 'Preparações alimentícias diversas' },

  // Higiene e perfumaria
  { ncm: '33051000', segment: 'higiene', label: 'Xampus' },
  { ncm: '34011190', segment: 'higiene', label: 'Sabonetes' },
  { ncm: '33061000', segment: 'higiene', label: 'Creme dental' },
  { ncm: '33049990', segment: 'higiene', label: 'Produtos de beleza/makeup' },
  { ncm: '33079000', segment: 'higiene', label: 'Desodorantes corporais' },
  { ncm: '33030010', segment: 'higiene', label: 'Perfumes' },

  // Limpeza
  { ncm: '34022000', segment: 'limpeza', label: 'Detergentes' },
  { ncm: '34029039', segment: 'limpeza', label: 'Amaciantes e preparações similares' },
  { ncm: '38089419', segment: 'limpeza', label: 'Desinfetantes' },
  { ncm: '34025000', segment: 'limpeza', label: 'Preparações para limpeza' },

  // Outros varejo
  { ncm: '24022000', segment: 'outros', label: 'Cigarros' },
  { ncm: '85061000', segment: 'outros', label: 'Pilhas de zinco-manganês' },
  { ncm: '85066000', segment: 'outros', label: 'Pilhas de lítio' },
  { ncm: '85395200', segment: 'outros', label: 'Lâmpadas LED' },
  { ncm: '85395000', segment: 'outros', label: 'Outras lâmpadas e dispositivos de iluminação' },

  // Autopeças
  { ncm: '40111000', segment: 'autopecas', label: 'Pneus novos de borracha (passageiros)' },
  { ncm: '40112090', segment: 'autopecas', label: 'Outros pneus novos de borracha' },
  { ncm: '40169300', segment: 'autopecas', label: 'Juntas e vedações de borracha' },
  { ncm: '27101932', segment: 'autopecas', label: 'Óleos lubrificantes' },
  { ncm: '27101991', segment: 'autopecas', label: 'Outros óleos de petróleo' },
  { ncm: '85071090', segment: 'autopecas', label: 'Baterias de chumbo para veículos' },
  { ncm: '87083090', segment: 'autopecas', label: 'Freios e partes de freios' },
  { ncm: '87081000', segment: 'autopecas', label: 'Para-choques e partes' },
  { ncm: '87089990', segment: 'autopecas', label: 'Outras partes e acessórios de veículos' },
  { ncm: '84212300', segment: 'autopecas', label: 'Filtros para líquidos' },
  { ncm: '84818099', segment: 'autopecas', label: 'Válvulas industriais/automotivas' },
  { ncm: '84099190', segment: 'autopecas', label: 'Partes de motores de ignição' },
  { ncm: '85111000', segment: 'autopecas', label: 'Velas de ignição' },

  // Material de construção
  { ncm: '25232910', segment: 'construcao', label: 'Cimento Portland' },
  { ncm: '69072200', segment: 'construcao', label: 'Revestimentos cerâmicos' },
  { ncm: '39172300', segment: 'construcao', label: 'Tubos e conexões de PVC' },
  { ncm: '39259090', segment: 'construcao', label: 'Artigos plásticos para construção' },
  { ncm: '32091010', segment: 'construcao', label: 'Tintas à base de acrílico' },
  { ncm: '32089021', segment: 'construcao', label: 'Tintas à base de poliuretano' },
  { ncm: '68109900', segment: 'construcao', label: 'Artefatos de cimento ou concreto' },
  { ncm: '73089090', segment: 'construcao', label: 'Estruturas e partes de ferro/aço' },
  { ncm: '44182900', segment: 'construcao', label: 'Portas e esquadrias de madeira' },
  { ncm: '38245000', segment: 'construcao', label: 'Argamassas e concretos prontos' },
  { ncm: '72142000', segment: 'construcao', label: 'Barras de ferro/aço (vergalhão)' },
  { ncm: '70051000', segment: 'construcao', label: 'Vidro float (chapa)' },

  // Utilidades domésticas
  { ncm: '39241000', segment: 'utilidades', label: 'Artigos de mesa/cozinha de plástico' },
  { ncm: '39249000', segment: 'utilidades', label: 'Outros artigos domésticos de plástico' },
  { ncm: '73239300', segment: 'utilidades', label: 'Artigos de uso doméstico de ferro/aço' },
  { ncm: '76151000', segment: 'utilidades', label: 'Artigos de mesa/cozinha de alumínio' },
  { ncm: '82152000', segment: 'utilidades', label: 'Facas e lâminas de cozinha' },
  { ncm: '69111090', segment: 'utilidades', label: 'Louça de mesa de cerâmica' },
  { ncm: '94037000', segment: 'utilidades', label: 'Móveis de plástico' },
  { ncm: '94035000', segment: 'utilidades', label: 'Móveis de madeira para quartos' },
  { ncm: '85167910', segment: 'utilidades', label: 'Ferros elétricos de passar' },
  { ncm: '85166000', segment: 'utilidades', label: 'Fornos, fogões e micro-ondas' },
  { ncm: '85165000', segment: 'utilidades', label: 'Aquecedores elétricos de imersão' },
  { ncm: '73269090', segment: 'utilidades', label: 'Outras obras de ferro ou aço' },

  // Pet shop
  { ncm: '23091000', segment: 'pet', label: 'Ração para cães e gatos' },
  { ncm: '23099010', segment: 'pet', label: 'Outras rações preparadas para animais' },
  { ncm: '33059000', segment: 'pet', label: 'Preparações capilares (shampoo pet)' },
  { ncm: '42010090', segment: 'pet', label: 'Artigos de couro (coleiras, guias)' },
  { ncm: '39269090', segment: 'pet', label: 'Outros artigos de plástico (acessórios pet)' },
  { ncm: '23099090', segment: 'pet', label: 'Outros alimentos preparados para animais' },

  // Farmácia básica (OTC / higiene)
  { ncm: '30049099', segment: 'farmacia', label: 'Medicamentos diversos (OTC)' },
  { ncm: '30051090', segment: 'farmacia', label: 'Curativos e pensos adesivos' },
  { ncm: '30059090', segment: 'farmacia', label: 'Outros produtos farmacêuticos' },
  { ncm: '30067000', segment: 'farmacia', label: 'Preparações para diagnóstico/laboratório' },
  { ncm: '96190000', segment: 'farmacia', label: 'Absorventes e fraldas' },
  { ncm: '90189099', segment: 'farmacia', label: 'Instrumentos médicos diversos' },
  { ncm: '39262090', segment: 'farmacia', label: 'Vestuário e acessórios de plástico (luvas)' },

  // Papelaria e informática básica
  { ncm: '48201000', segment: 'papelaria', label: 'Cadernos' },
  { ncm: '48202000', segment: 'papelaria', label: 'Cadernetas e blocos' },
  { ncm: '96081000', segment: 'papelaria', label: 'Canetas esferográficas' },
  { ncm: '84713012', segment: 'informatica', label: 'Notebooks/portáteis' },
  { ncm: '85171231', segment: 'informatica', label: 'Telefones celulares' },
  { ncm: '84716053', segment: 'informatica', label: 'Unidades de entrada (teclados/mouses)' },

  // Vestuário e calçados (varejo comum)
  { ncm: '61091000', segment: 'vestuario', label: 'Camisetas de malha' },
  { ncm: '62034200', segment: 'vestuario', label: 'Calças de algodão (masculino)' },
  { ncm: '64039990', segment: 'vestuario', label: 'Calçados com sola de borracha/plástico' },
  { ncm: '61103000', segment: 'vestuario', label: 'Suéteres e pulôveres' },
];

export const TAX_RULES_RJ_UF = 'RJ';
export const TAX_RULES_RJ_CFOP_ST = '5405';

/** @param {TaxRuleSeedEntry[]} entries */
export const dedupeTaxRuleSeedEntries = (entries) => {
  const seen = new Set();
  const out = [];
  for (const entry of entries || []) {
    const ncm = String(entry?.ncm ?? '').replace(/\D/g, '').slice(0, 8);
    if (ncm.length !== 8 || seen.has(ncm)) continue;
    seen.add(ncm);
    out.push({ ...entry, ncm });
  }
  return out;
};

export const RJ_RETAIL_ST_SEED_COUNT = dedupeTaxRuleSeedEntries(TAX_RULES_RJ_RETAIL_ST_ENTRIES).length;
