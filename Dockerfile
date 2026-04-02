FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_REDIRECT_URI
ENV NEXT_PUBLIC_REDIRECT_URI=${NEXT_PUBLIC_REDIRECT_URI}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=80
RUN addgroup -S app && adduser -S app -G app

COPY --chown=app:app package.json pnpm-lock.yaml ./
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/.next ./.next
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/next.config.mjs ./next.config.mjs

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const n=require('net');const p=process.env.PORT||80;const s=n.connect(p,'127.0.0.1');s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),4000);"
USER app
CMD ["pnpm", "start"]
