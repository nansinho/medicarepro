# syntax=docker/dockerfile:1

# ============================================================
# MediCare Pro — image Docker Next.js 16 (output: standalone)
# Build multi-stage : deps → build → runner minimal, non-root.
# ============================================================

# ---------- 1. Dépendances ----------
FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat : requis par certaines deps natives sur Alpine
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# npm install (et non ci) : résout les dépendances optionnelles propres à
# la plateforme Linux/musl (ex. @emnapi/*, binaires natifs) que le lockfile
# généré sous Windows n'inclut pas. --no-audit/--no-fund : build plus rapide.
RUN npm install --no-audit --no-fund

# ---------- 2. Build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Les NEXT_PUBLIC_* sont inlinées dans le bundle AU BUILD : il faut
# donc les passer en build-args (Coolify → Build Variables).
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- 3. Runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Utilisateur non-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# server.js minimal + node_modules tracés (output: standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Assets statiques et public (non copiés par standalone par défaut)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
