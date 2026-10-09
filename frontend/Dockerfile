# ==========================================
# Build Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build argument for API URL (defaults to relative /api for reverse proxy)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ==========================================
# Production Nginx Runtime Stage
# ==========================================
FROM nginx:alpine

# Remove default nginx html files
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
