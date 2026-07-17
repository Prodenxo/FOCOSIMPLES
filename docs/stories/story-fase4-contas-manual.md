# Story: Fase 4 — Contas e cartões (manual)

## Status
- [x] Migration `contas_financeiras` + `lancamentos_id.conta_id`
- [x] Store e helpers de saldo
- [x] Tela Contas (shell web + mobile)
- [x] Vínculo opcional no modal de transações
- [x] Integração sistema: saldo dashboard, filtro BPO, transações (filtro/KPI/badge/form inline)
- [x] Catálogo de bancos BR + ícones (`@edusites/bancos-brasil`) no cadastro; opção "Outra conta"
- [ ] Migration `instituicao_id` — `20260522120000_contas_instituicao_id.sql` ou reaplicar `CONTAS_FINANCEIRAS_APPLY_MANUAL.sql`
- [ ] Aplicar migration no Supabase — usar `CONTAS_FINANCEIRAS_APPLY_MANUAL.sql` no SQL Editor
- [ ] QA manual pós-migration
- [ ] Site `Transactions.tsx` — seletor de conta (fase posterior)

## Escopo
Cadastro manual de contas/cartões sem Open Finance. Saldo = saldo inicial + lançamentos realizados vinculados.

## Checklist QA
- [ ] `npm run lint` (App/frontend)
- [ ] `npm run typecheck`
- [ ] `npm test`

## Arquivos principais
- `Site/supabase/migrations/20260521120000_create_contas_financeiras.sql`
- `App/frontend/screens/ContasScreen.tsx`
- `App/frontend/store/contaFinanceiraStore.ts`
- `App/frontend/lib/contaSaldo.ts`
