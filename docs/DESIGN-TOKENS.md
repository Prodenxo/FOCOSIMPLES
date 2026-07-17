# MF Luxury — Design Tokens (`App/frontend`)

Referência visual: hierarquia tipo **Assessor** (bento, semântica financeira, micro-UI).  
Marca: **Meu Financeiro** — primary azul (`#2563EB` / `#60a5fa`), sem roxo/rosa do concorrente.

Escopo: **`App/frontend` apenas** — não altera `Site/frontend`.

---

## 1. Tema (`lib/theme.ts`)

### Modos

| Modo | `background` | Cards | Notas |
|------|--------------|-------|--------|
| **Light premium** | `#FFFFFF` | `#FFFFFF` + borda `#E8ECF0` | Fundo branco Linear-like; áreas secundárias `backgroundMuted` `#F8FAFC` |
| **Dark** | `#000000` | `#1a2230` | Camadas azul‑ardósia; borda `#2d3a4d` |

Consumo: `useThemeStore().isDarkMode` + `getTheme(isDarkMode)` ou hook `useMfTheme()`.

### Semântica financeira

| Token | Uso | Light | Dark |
|-------|-----|-------|------|
| `financeOpen` | Em aberto / pendente | `#2563EB` | `#60a5fa` |
| `financeOpenLight` | Fundo ícone/tile | `#EFF6FF` | `rgba(59,130,246,0.18)` |
| `financeReceived` | Recebido | `#10B981` | `#34d399` |
| `financeReceivedLight` | Fundo tile | `#D1FAE5` | `rgba(52,211,153,0.16)` |
| `financeOverdue` | Atraso | `#EF4444` | `#f87171` |
| `financeOverdueLight` | Fundo tile | `#FEE2E2` | `rgba(248,113,113,0.16)` |
| `financeForecast` | Total previsto | `#1E40AF` | `#93c5fd` |
| `financeForecastLight` | Fundo tile | `#DBEAFE` | `rgba(147,197,253,0.14)` |

Helpers: `getFinanceSemanticColor(theme, semantic)`, `getFinanceSemanticTint(theme, semantic)`.

Tipo: `FinanceSemantic = 'open' | 'received' | 'overdue' | 'forecast'`.

### Layout (light/dark iguais)

```ts
mfRadius   // sm 8, md 12, lg 16, xl 20, pill 999
mfSpacing  // xs 4 … xxl 48
mfTypography // caption, body, money (28), moneyLarge (32), …
```

### Sombra

`mfCardElevation(theme, isDarkMode)` — sombra difusa; usar em `MfCard variant="elevated"`.

`mfMoneyTextStyle(theme, size?)` — valores monetários tabulares.

---

## 2. Componentes (`components/ui/`)

| Componente | Props principais | Função |
|------------|------------------|--------|
| `MfPage` | `scroll`, `maxWidth`, `contentPadding` | Fundo + max-width desktop 1280 |
| `MfCard` | `variant`: default \| elevated \| outline; `padding` | Superfície base |
| `MfMetricTile` | `label`, `value`, `semantic`, `icon?` | KPI 2×2 financeiro |
| `MfPeriodNav` | `label`, `onPrevious`, `onNext` | `< Maio 2026 >` |
| `MfSegmented` | `options`, `value`, `onChange` | Semana / Mês / Hoje |
| `MfDonutChart` | `segments: { ratio, color }[]`, `centerLabel?` | Donut SVG reutilizável |
| `MfAppHeader` | `title`, `onMenuPress`, `right` | Barra superior (sem faixa azul cheia) |

Barrel: `import { MfCard, MfMetricTile, useMfTheme } from '../components/ui'`.

---

## 3. Snippet de exemplo

Arquivo: `components/ui/examples/MfLuxurySnippet.tsx`

```tsx
import { MfCard, MfMetricTile, MfPage } from '../components/ui';

// Grid 2×2 de métricas dentro de um card elevado — ver ficheiro completo.
```

Para pré-visualizar: montar temporariamente em `App.tsx` ou numa rota de dev.

---

## 4. Regras de implementação (Dev)

1. **Novas telas / refactors:** usar `components/ui/*`; evitar hex solto nas screens.
2. **Categorias:** migrar donut local → `MfDonutChart` + paleta por categoria (não só cinza).
3. **Dashboard:** substituir header azul sólido por `MfAppHeader` + cards `elevated`.
4. **Light:** fundo da página = `theme.background` (`#FFFFFF`), não `#F3F4F6`.
5. **Testes:** `lib/__tests__/theme.test.ts` + testes de screen existentes após migração.

---

## 5. Rollout sugerido

1. Shell (`SideDrawer`) + `DashboardScreen`
2. `TransactionsScreen`, `CategoriasScreen`, `OrcamentosScreen`
3. `AgendaScreen`, MEI, Settings, Auth

---

*Gerado pelo fluxo Architect — MF Luxury brownfield, 2026-05.*
