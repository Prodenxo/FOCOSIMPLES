# FocoSimples

Produto irmão do FocoMEI: **mesmo layout** (financeiro + emissão de notas), cliente/domínio/base **separados**.

**Repo:** `Documents/Dev/FOCOSIMPLES` (não fica no monorepo FOCOMEI).

## Estrutura

| Pasta | Conteúdo |
|-------|----------|
| `/` (raiz) | Frontend Expo (web/mobile) |
| `backend/` | API Express (cópia do backend FocoMEI) |

## Banco

Sem projeto Supabase novo por enquanto (custo compute). Quando tiver base:
1. Clonar só **schema** do FocoMEI (sem dados de usuário)
2. Preencher `backend/.env` e `./.env` com URL/keys dessa base

## Subir local (quando tiver .env)

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run dev   # :3333

# Frontend (outra aba)
cd ..
cp .env.example .env
# EXPO_PUBLIC_MEI_API_URL_DEV=http://localhost:3333
npm install --legacy-peer-deps
npx expo start --web
```

## Escopo

| Hoje | Depois |
|------|--------|
| Nota + financeiro | DAS Serpro |
| Brand FocoSimples | Domínio + Easypanel |

Não misturar secrets/Supabase de produção do FocoMEI.
