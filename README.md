# Foco Simples

Site: [focosimples.com.br](https://focosimples.com.br)

```
backend/   API
frontend/  site
```

## Subir no computador

```bash
# API
cd backend
cp .env.example .env
npm install
npm run dev

# Site (outra janela)
cd frontend
cp .env.example .env
npm install --legacy-peer-deps
npx expo start --web
```

No `.env` do frontend:

```
EXPO_PUBLIC_MEI_API_URL_DEV=http://localhost:3333
```

## Produção (Easypanel)

- Backend: pasta `backend`, Dockerfile, porta 3333
- Site: raiz do repo (o `Dockerfile` da raiz usa `frontend/`), porta 80

Restart sozinho não pega código novo — use **Deploy**.
