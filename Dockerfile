# syntax=docker/dockerfile:1

# --- Build the static site ---
FROM node:25-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Public links shown in Settings › About; override with --build-arg.
ARG VITE_REPO_URL
ARG VITE_COFFEE_URL
ENV VITE_REPO_URL=${VITE_REPO_URL} VITE_COFFEE_URL=${VITE_COFFEE_URL}
RUN npm test && npm run build

# --- Serve it: unprivileged nginx, listens on 8080 ---
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
LABEL org.opencontainers.image.title="Wherebox" \
      org.opencontainers.image.description="Remember where you put things. Local-first PWA." \
      org.opencontainers.image.licenses="MIT"
