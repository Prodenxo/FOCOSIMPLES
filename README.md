# FocoSimples

Produto irmão do FocoMEI: **mesmo layout** (financeiro + emissão de notas), cliente/domínio/base **separados**.

**Repo próprio:** `Documents/Dev/FOCOSIMPLES` — **não** fica dentro do monorepo FOCOMEI.

## Banco sem pagar +US$ 10 agora

Na org Pro, projeto novo = compute pago. Enquanto isso:

1. Reuse um projeto Supabase **já existente** e pouco usado, **ou**
2. Pause/apague um Micro/Nano ocioso e só então crie o novo, **ou**
3. Rode Supabase **local** (`supabase start`) só pra desenvolver

Depois clona só o **schema** do FocoMEI (sem dados de usuário) para essa base.

## Subir local

```bash
cp .env.example .env
npm install --legacy-peer-deps
npx expo start --web
```

## Escopo

| Hoje | Depois |
|------|--------|
| Nota + financeiro | DAS Serpro |
| Brand FocoSimples | Domínio + Easypanel |

Não misturar `.env` / Supabase de produção do FocoMEI.
