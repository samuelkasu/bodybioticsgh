# syntax=docker/dockerfile:1

# Multi-stage so the runtime image carries no toolchain, no dev dependencies
# and no source: smaller image, smaller attack surface, faster cold starts.
# 24, not 22: npm 10 cannot resolve this lockfile. See the note on
# NODE_VERSION in .github/workflows/ci.yml.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined here, so they are build inputs, not runtime
# config. A staging image and a production image are therefore different builds.
#
# No default for the site URL: next.config.ts rejects a missing or loopback
# origin in a production build, because it is baked into every canonical tag
# and cannot be corrected without rebuilding. A real image passes
# `--build-arg NEXT_PUBLIC_SITE_URL=https://bodybioticsgh.com`. CI only builds
# this to prove the Dockerfile still works and never ships it, so it passes
# `--build-arg ALLOW_LOCAL_SITE_URL=1` instead.
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SITE_URL
ARG ALLOW_LOCAL_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    ALLOW_LOCAL_SITE_URL=$ALLOW_LOCAL_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `output: "standalone"` produces a minimal server bundle; public/ and the
# static chunks are copied alongside it.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
