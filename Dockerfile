# =========================================================
# ETAPA 1: Base común con pnpm habilitado
# =========================================================
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copiamos solo los manifiestos para aprovechar el almacenamiento en caché de capas
COPY package.json pnpm-lock.yaml ./

# =========================================================
# ETAPA 2: Instalación de dependencias y Build
# =========================================================
FROM base AS builder
WORKDIR /app

# Instalamos todas las dependencias usando la caché de pnpm
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copiamos el resto del código fuente del proyecto
COPY . .

# Compilamos la aplicación de Astro
RUN pnpm build

# =========================================================
# ETAPA 3: Dependencias exclusivas de Producción
# =========================================================
FROM base AS prod-deps
WORKDIR /app

# Instalamos solo dependencias de producción
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# =========================================================
# ETAPA 4: Imagen de ejecución (Runner)
# =========================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Copiamos dependencias de producción y el resultado de la compilación
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Creamos el directorio 'data' para la persistencia
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]