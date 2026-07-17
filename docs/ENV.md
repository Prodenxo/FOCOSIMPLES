# Variáveis de ambiente e URL scheme (frontend)

## asdasdURL scheme (deep links / OAuth callback)

**Fonte da verdade:** `financas-pessoais://`

- Definido em [`app.json`](../app.json) como `expo.scheme` (deve coincidir com o prebuild nativo).
- O fluxo Google Calendar redireciona para `financas-pessoais://google-callback` (ver `App.tsx`, `google-auth-flow.ts` e Edge Function `google-calendar`).
- O fluxo de reset de senha (Supabase recovery) usa `financas-pessoais://reset-password` e pode chegar com tokens em hash/query:
  - `financas-pessoais://reset-password#access_token=...&refresh_token=...&type=recovery`
  - `financas-pessoais://reset-password?access_token=...&refresh_token=...&type=recovery`
- O app interpreta esse deep link sem logar tokens e abre a tela de redefinição de senha.
- O projeto Android em `android/app/src/main/AndroidManifest.xml` registra `android:scheme` `financas-pessoais`. Após mudar `app.json`, rode `npx expo prebuild` quando regenerar nativo.

**Não usar** um scheme divergente (ex.: só `Meu-Financeiro`) sem atualizar Edge Function, manifest e código — o OAuth quebrará em uma das plataformas.

## Variáveis `EXPO_PUBLIC_*`

Valores com prefixo `EXPO_PUBLIC_` entram no bundle do Metro e são **visíveis no cliente**. Use apenas dados aceitáveis como públicos.

| Variável                        | Público? | Uso                                                                                                                |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_SUPABASE_URL`      | Sim      | URL do projeto Supabase (REST/Auth).                                                                               |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Sim      | Chave anônima; proteção vem de **RLS** e de operações privilegiadas nas Edge Functions (service role no servidor). |
| `EXPO_PUBLIC_MEI_API_URL`       | Sim      | Base URL da API (Easypanel em produção).                                                                           |
| `EXPO_PUBLIC_MEI_API_URL_DEV`   | Sim      | Opcional. Só em `__DEV__`: substitui a URL acima (ex.: `http://localhost:3333`).                                   |

**Fallback:** [`app.json`](../app.json) `expo.extra`: `supabaseUrl`, `supabaseAnonKey`, `meiApiUrl` (útil em EAS quando env vars são injetadas no build).

## O que nunca colocar no app

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_SECRET`
- Segredos de terceiros ou tokens de API privados

Esses pertencem apenas a **Edge Functions** / CI / servidor, nunca a `EXPO_PUBLIC_*` nem a `extra` empacotado para debug indevido.

## Opcional: Sentry

Não está instalado por padrão neste repositório. Se habilitar observabilidade com Sentry (`@sentry/react-native` + plugin Expo), o **DSN** costuma ser público no cliente (`EXPO_PUBLIC_SENTRY_DSN`). Tokens de upload de source maps ficam só no CI (secrets do GitHub / EAS). Logs ruidosos em desenvolvimento podem usar `frontend/lib/logger.ts` (`debug` / `warn` só em `__DEV__`).
