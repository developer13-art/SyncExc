# ---------- Build stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY shared/package.json ./shared/

RUN npm ci --workspace=client --include-workspace-root

COPY shared ./shared
COPY client ./client

ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_APP_NAME=SyncExc
ARG VITE_ENVIRONMENT=production
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_ENVIRONMENT=$VITE_ENVIRONMENT

RUN npm run build --workspace=client

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache curl

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY infrastructure/nginx/sites/app.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]