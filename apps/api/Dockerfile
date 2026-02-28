# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS builder
COPY . .
RUN pnpm --filter @monocore/db prisma:generate
RUN pnpm --filter @monocore/api build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /workspace
RUN addgroup -S monocore && adduser -S monocore -G monocore

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /workspace/apps/api ./apps/api
COPY --from=builder /workspace/packages/shared ./packages/shared
COPY --from=builder /workspace/packages/db ./packages/db

USER monocore
EXPOSE 4000
CMD ["node", "--enable-source-maps", "--import", "tsx", "apps/api/dist/main.js"]
