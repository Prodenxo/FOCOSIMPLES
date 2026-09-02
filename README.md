# Foco Simples

Site de finanças e notas fiscais: [focosimples.com.br](https://focosimples.com.br)

| Pasta | O que é |
|-------|---------|
| `/` (raiz) | Site (Expo web) |
| `backend/` | API |

## Subir no computador

```bash
# API
cd backend
cp .env.example .env
npm install
npm run dev

# Site (outra janela)
cd ..
cp .env.example .env
npm install --legacy-peer-deps
npx expo start --web
```

No `.env` do site, a API local fica assim:

```
EXPO_PUBLIC_MEI_API_URL_DEV=http://localhost:3333
```

## Produção

No Easypanel: **Deploy** do backend e do site. Restart sozinho não pega código novo.
