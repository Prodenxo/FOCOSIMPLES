# Easypanel — site Foco Simples (Next.js frontend-next)
# Expo legado: Dockerfile.expo
# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY frontend-next/package.json frontend-next/package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# ── build ────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend-next/ .

ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_APP_PRODUCT=focosimples
ARG EXPO_PUBLIC_MEI_API_URL=
ARG VITE_API_URL=
ARG EXPO_PUBLIC_APP_PRODUCT=focosimples

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN set -e; \
  API="${NEXT_PUBLIC_API_URL:-${EXPO_PUBLIC_MEI_API_URL:-${VITE_API_URL}}}"; \
  PRODUCT="${NEXT_PUBLIC_APP_PRODUCT:-${EXPO_PUBLIC_APP_PRODUCT:-focosimples}}"; \
  export NEXT_PUBLIC_API_URL="$API"; \
  export NEXT_PUBLIC_APP_PRODUCT="$PRODUCT"; \
  npm run build

# ── run ──────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY frontend-next/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
