# Standalone production Dockerfile for Backend (Subdirectory Context)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .
RUN npm run prisma:generate
RUN npm run build

# ==========================================
# Production Runtime Stage
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache dumb-init

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production

COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist ./dist

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
