#!/bin/sh
set -e

# Easypanel: aceita NEXT_PUBLIC_* ou variáveis legadas do site Expo
API_URL="${NEXT_PUBLIC_API_URL:-${EXPO_PUBLIC_MEI_API_URL:-${VITE_API_URL:-}}}"
PRODUCT="${NEXT_PUBLIC_APP_PRODUCT:-${EXPO_PUBLIC_APP_PRODUCT:-focosimples}}"

escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

API_ESC=$(escape_json "$API_URL")
PRODUCT_ESC=$(escape_json "$PRODUCT")

mkdir -p /app/public
cat > /app/public/env-config.js <<EOF
window.__FOCO_SIMPLES_ENV__ = {
  "NEXT_PUBLIC_API_URL": "${API_ESC}",
  "NEXT_PUBLIC_APP_PRODUCT": "${PRODUCT_ESC}"
};
EOF

if [ -z "$API_URL" ]; then
  echo "AVISO: NEXT_PUBLIC_API_URL (ou EXPO_PUBLIC_MEI_API_URL / VITE_API_URL) vazio — login e API não funcionam."
fi

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"

exec node server.js
