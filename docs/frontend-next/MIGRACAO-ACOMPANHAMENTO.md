# Migração frontend → frontend-next

Documento vivo de inventário e progresso. Referências: `frontend/` (funcional), `frontend-next/` (UI nova), `backend/` (API).

**Legenda de status:** `Concluído` · `Parcial` · `Ausente` · `Stub` · `Regressão`

**Última atualização:** 2026-03-10 — inventário inicial + correções em andamento.

---

## Sistema visual (design tokens)

| Elemento | Onde está no Next |
|----------|-------------------|
| Sidebar azul-marinho | `components/layout/AppSidebar.jsx`, CSS vars `--sidebar` |
| Ação primária verde | `--accent`, botões `bg-[var(--accent)]` |
| Cards / canvas | `components/ui/Card.jsx`, `--canvas`, `--card-bg` |
| Tema claro/escuro | `context/ThemeProvider.jsx`, `app/layout.js` |
| Loading / erro / vazio | `LoadingPanel`, `ErrorPanel`, `EmptyPanel` |
| Confirmação destrutiva | `ConfirmDialog` |
| Paginação | `Pagination` |
| Mês (dashboard/transações) | `MonthPicker` |
| Rodapé | `AppFooter` |
| **Select / dropdown** | **`AppSelect`** (`@/components/ui/AppSelect`) — substitui `<select>` nativo; busca automática se >8 itens |
| Filtro compacto (toolbar) | **`FilterSelect`** — wrapper do `AppSelect` inline |

**Pendente de extrair para reutilização:** `PageHeader` (título + ações), `TabsPill`, `SearchField`, `DataTable` (desktop), `ActionMenu` (ícones ⋮).

**Regra:** não usar `<select>` nativo em telas novas — sempre `AppSelect` ou `FilterSelect`.

---

## Inventário por módulo

| Módulo | Tela/fluxo original (Expo) | Funcionalidades principais | Destino Next | Status | Validação | Bloqueios |
|--------|---------------------------|----------------------------|--------------|--------|-----------|-----------|
| **Auth** | `/(auth)/login` | Login e-mail/senha, redirect pós-login | `/login` | Concluído | Lint/build; fluxo manual local | — |
| Auth | `/(auth)/register` | Cadastro, convite opcional | `/register` | Concluído | Lint/build | — |
| Auth | `/(auth)/forgot` | Recuperação senha | `/forgot` | Concluído | Lint/build | — |
| Auth | `reset-password` | Nova senha via token | `/reset-password` | Concluído | API verify-recovery-otp | — |
| Auth | `solicitar-acesso` | Formulário solicitar acesso | `/solicitar-acesso` | Parcial | register-empresa | Endereço completo vs Expo |
| Auth | `onboarding` | Primeiro uso | — | Ausente | — | Produto pode dispensar web |
| Auth | `PendingApprovalScreen` | Bloqueio cadastro pendente | `(app)/layout` | Parcial | unlock-pending | Auth local ignora |
| Auth | Impersonate admin | Backup sessão + `/auth/impersonate` | Em implementação | Parcial | — | UI usuários + AuthProvider |
| **Shell** | `SideDrawer` + top nav | Nav fiscal condicional `mei` | `AppSidebar`, `MobileNavDrawer` | Concluído | Visual | Falta gates onboarding |
| Shell | Termos / privacidade | Links legais | `public/termos.html`, `privacidade.html` | Parcial | — | Rotas `/termos` Next |
| **Dashboard** | `DashboardScreen` | Mês, saldo, BPO, orçamentos, conta global, atividade | `/` | Parcial | Hook `useDashboardData` | Paridade gráficos BPO vs Expo |
| **Transações** | `TransactionsScreen` | CRUD, filtros, export Excel, detalhes | `/transacoes` | Parcial | Projeções + painel | Paridade fina duração custom |
| Transações | Modal recorrências | Lista/edição templates | Painel lateral | Concluído | — | — |
| **Contas** | `ContasScreen` | CRUD contas financeiras | `/contas` | Parcial | Página ~286 linhas | Conferir saldo inicial / arquivar |
| **Conta global** | `ContaGlobalScreen` | Moedas, câmbio, metas | `/conta-global` | Parcial | Página ~342 linhas | Paridade carrossel/modal |
| **Categorias** | `CategoriasScreen` | CRUD, ícones, dashboard row | `/categorias` | Parcial | — | Conferir merge/import |
| **Orçamentos** | `OrcamentosScreen` | Orçamento por categoria/mês | `/orcamentos` | Parcial | — | Conferir cópia mês anterior |
| **Agenda** | `AgendaScreen` | Google Calendar, eventos | `/agenda` | Parcial | — | OAuth return URL web |
| **Notas (MEI)** | `MeiScreen` tabs | overview, DAS, parcelamentos, notas, certificado | `/notas/*` | Parcial | Subrotas | Ver linhas abaixo |
| Notas | Overview / limite faturamento | Cards e alertas | `/notas` | Concluído | Manual recente | — |
| Notas | Certificado + empresa PlugNotas | PFX, RPS/DPS, PATCH empresa | `/notas/certificado` | Parcial | — | Import CNAEs guiado |
| Notas | DAS | Declarar, PDF, competências | `/notas/das` | Parcial | — | E2E produção |
| Notas | Parcelamentos | Listar, PDF, parcelas | `/notas/parcelamentos` | Parcial | — | — |
| Notas | Notas fiscais | Emitir, sync, catálogo, obra | `/notas/notas-fiscais` | Parcial | Maior página | NCM autocomplete opcional |
| Notas | Planos MEI billing | Stripe / planos | `/(app)/planos` Expo | Ausente | — | Gate billing |
| **Minha conta** | `SettingsScreen` | Perfil, telefone, e-mail, tema, Google, suporte | `/minha-conta` | Parcial | Build OK | Robô WhatsApp teste/logs |
| Minha conta | Gerenciar usuários | Abas users/invites/empresas, paginação, ações | `/minha-conta/usuarios` | Parcial | Em expansão | Paridade ManageUsersScreen |
| Minha conta | Solicitações acesso | Aprovar/recusar | `/minha-conta/solicitacoes` | Parcial | — | AdminUserData prefill |
| Minha conta | Produtos fiscais contador | Regras/grupos/cenários | `/minha-conta/produtos-fiscais` | Parcial | Simplificado | Paridade AccountantFiscal* |
| Minha conta | Ativação | Painel activation | Expo `/ativacao` | Ausente | — | — |
| **Onboarding empresa** | `EmpresaCnpjOnboardingScreen` | CNPJ obrigatório pós-login | — | Ausente | — | Gate layout |
| **Aprovações** | `AccessApprovalsScreen` | `/solicitacoes` app | Parcial em minha-conta | Parcial | — | Rota dedicada admin |
| **Admin dados** | `AdminUserDataScreen` | Prefill NFSe por usuário | — | Ausente | — | Entrada desde usuários |
| **Landing** | `LandingPage` | Marketing | — | Ausente | — | Opcional web |
| **FocoMEI planos** | `MeiPricingPlansScreen` | Assinatura | — | Ausente | — | Produto Foco Simples vs FocoMEI |

---

## Rotas Expo → Next (mapa)

| Expo (`frontend/app`) | Next (`frontend-next/app`) |
|-----------------------|----------------------------|
| `/(app)/` | `/(app)/page.jsx` |
| `/(app)/transacoes` | `/transacoes` |
| `/(app)/contas` | `/contas` |
| `/(app)/conta-global` | `/conta-global` |
| `/(app)/categorias` | `/categorias` |
| `/(app)/orcamentos` | `/orcamentos` |
| `/(app)/agenda` | `/agenda` |
| `/(app)/notas`, `/mei` | `/notas`, `/notas/*` |
| `/(app)/configuracoes/*` | `/minha-conta/*` |
| `/(auth)/*` | `/login`, `/register`, `/forgot` |
| `/(app)/ativacao` | — |
| `/(app)/empresa-cnpj` | — |
| `/(app)/planos` | — |
| `/(app)/solicitacoes` | — (parcial `/minha-conta/solicitacoes`) |
| `reset-password` | `/reset-password` |
| `/(auth)/solicitar-acesso` | `/solicitar-acesso` |

---

## Prioridade de implementação (fila)

1. **Gerenciar usuários** — aba Empresas, paginação, editar/excluir/reset/impersonate (superadmin).
2. **Transações — recorrências** — store/hook + projeção + UI modal (paridade TransactionsScreen).
3. **Gates de sessão** — pending approval, empresa CNPJ, planos (se aplicável Foco Simples).
4. **Auth** — reset-password, solicitar-acesso.
5. **Settings** — WhatsApp agent test/logs (superadmin).
6. **Produtos fiscais contador** — paridade regras/grupos se ainda usado.
7. **Dashboard / BPO** — paridade gráficos e insights.
8. **Notas** — import CNAEs, polish emitir.

---

## Verificações executadas

| Verificação | Quando | Resultado |
|-------------|--------|-----------|
| `npm run lint` (frontend-next) | 2026-03-10 sessão anterior | OK |
| `npm run build` (frontend-next) | 2026-03-10 sessão anterior | OK (23 rotas) |
| Testes E2E browser | — | Pendente |
| Fluxos admin usuários E2E | — | Pendente |

---

## Sessão atual (2026-03-10)

**Concluído nesta sessão:**
- Inventário completo + este documento (`docs/frontend-next/MIGRACAO-ACOMPANHAMENTO.md`).
- Removido `MIGRATION_STUB_ROUTES` (Notas não é mais stub).
- **Gerenciar usuários:** aba Empresas (superadmin), paginação, ordenação, editar (MEI + tipos de nota), excluir, redefinir senha, impersonate + banner “Voltar ao admin”.
- `apiClient.patch`, `lib/empresaManagement.js`, `lib/adminUserApi.js`, backup sessão admin em `authSession.js`.

**Em andamento:** paridade fina com `ManageUsersScreen` (membros por empresa, criar empresa completa, billing).

**Próximo passo concreto:** portar **recorrências** para `/transacoes` (API `/recorrencias` no backend).

**Verificação:** `npm run lint` OK (2026-03-10). Build Next falhou com `PageNotFoundError: /_document` (investigar ambiente; compilação OK).

**Não declarar 100%** até fila de prioridade esvaziada e validação E2E registrada acima.
