# ===== NotaAI Worker — image Cloud Run (auto-scale horizontal, §1) =====
# Multi-stage: build TS → image runtime ramping.

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8080
# Cloud Run menyuntikkan PORT; worker memproses antrean via consumer.
CMD ["node", "dist/index.js"]