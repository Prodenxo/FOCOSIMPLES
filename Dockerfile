# ── Stage 1: build ───────────────────────────────────────────────────────────
# bookworm-slim: Expo/Metro costuma falhar em Alpine (musl) ou por OOM sem heap maior.
FROM node:20-bookworm-slim AS builder

# Build args: Easypanel pode enviar EXPO_PUBLIC_* ou VITE_* (legado)
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_MEI_API_URL
ARG EXPO_PUBLIC_APP_PRODUCT
ARG EXPO_PUBLIC_INVITE_APP_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

ENV EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL}
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY}
ENV EXPO_PUBLIC_MEI_API_URL=${EXPO_PUBLIC_MEI_API_URL}
ENV EXPO_PUBLIC_APP_PRODUCT=${EXPO_PUBLIC_APP_PRODUCT}
ENV EXPO_PUBLIC_INVITE_APP_BASE_URL=${EXPO_PUBLIC_INVITE_APP_BASE_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_API_URL=${VITE_API_URL}

ENV CI=1
ENV EXPO_NO_TELEMETRY=1
ENV NODE_OPTIONS=--max-old-space-size=4096

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Normaliza nomes legados VITE_* → EXPO_PUBLIC_* e exporta (mesmo RUN: export não persiste entre layers)
RUN set -e; \
  export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-$VITE_SUPABASE_URL}"; \
  export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-$VITE_SUPABASE_ANON_KEY}"; \
  export EXPO_PUBLIC_MEI_API_URL="${EXPO_PUBLIC_MEI_API_URL:-$VITE_API_URL}"; \
  if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ] || [ -z "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]; then \
    echo "BUILD: Supabase vazio - OK se Environment do Easypanel tiver as vars (runtime via env-config.js)."; \
  else \
    echo "BUILD: Supabase configurado."; \
  fi; \
  echo "BUILD: APP_PRODUCT=${EXPO_PUBLIC_APP_PRODUCT:-}"; \
  if [ ! -f assets/brand-mark.jpg ]; then \
    echo "BUILD ERROR: assets/brand-mark.jpg ausente no contexto Docker."; \
    echo "BUILD ERROR: verifique .gitignore (nao ignore frontend/assets/)."; \
    ls -la assets 2>/dev/null || echo "BUILD ERROR: pasta assets/ nao existe"; \
    exit 1; \
  fi; \
  echo "BUILD: iniciando expo export..."; \
  npx expo export --platform web --clear

RUN node scripts/patch-web-index.mjs dist/index.html \
  && cp -f public/legal.css public/privacidade.html public/termos.html dist/

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
