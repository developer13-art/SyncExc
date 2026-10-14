FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
COPY admin/package.json ./admin/
COPY shared/package.json ./shared/
COPY packages/ui/package.json ./packages/ui/

RUN npm ci --workspace=admin --include-workspace-root

COPY shared ./shared
COPY packages/ui ./packages/ui
COPY admin ./admin

ARG VITE_API_URL
ARG VITE_APP_NAME=SyncExc Admin
ARG VITE_ENVIRONMENT=production
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_ENVIRONMENT=$VITE_ENVIRONMENT

RUN npm run build --workspace=admin

FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache curl

COPY --from=builder /app/admin/dist /usr/share/nginx/html
COPY infrastructure/nginx/sites/admin.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]