# Multi-stage Dockerfile for React SPA Frontend

# --- Stage 1: Build Frontend Assets ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: Production Nginx Server ---
FROM nginx:alpine AS runner

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled production bundle from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Set up non-root permissions for nginx runtime directories
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /etc/nginx/conf.d /usr/share/nginx/html

USER nginx

EXPOSE 80

# Container healthcheck
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:80/healthz > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
