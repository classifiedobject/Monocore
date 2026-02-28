# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS builder
ARG NEXT_PUBLIC_WEB_PUBLIC_API_URL
ENV NEXT_PUBLIC_WEB_PUBLIC_API_URL=${NEXT_PUBLIC_WEB_PUBLIC_API_URL}
COPY . .
RUN pnpm --filter @monocore/web build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S monocore && adduser -S monocore -G monocore

COPY --from=builder /workspace/apps/web/public ./public
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static

USER monocore
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
