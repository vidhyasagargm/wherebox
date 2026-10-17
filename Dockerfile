# syntax=docker/dockerfile:1

# --- Build the static site ---
# The site is the same files on every platform, so build it once on the build machine's own
# architecture (no slow emulation for arm64). Tests run in CI before images are built.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Links and imprint shown in Settings › About; set with --build-arg.
ARG VITE_REPO_URL
ARG VITE_COFFEE_URL
ARG VITE_IMPRINT
ENV VITE_REPO_URL=${VITE_REPO_URL} VITE_COFFEE_URL=${VITE_COFFEE_URL} VITE_IMPRINT=${VITE_IMPRINT}
RUN npm run build
# Lets invite links open the Android app: the SHA-256 fingerprint of its signing key
# (AB:CD:…, see docs/apps.md). Without it, invite links open in the browser.
ARG ANDROID_CERT_SHA256
RUN if [ -n "$ANDROID_CERT_SHA256" ]; then mkdir -p dist/.well-known && printf '[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"fyi.sagar.wherebox","sha256_cert_fingerprints":["%s"]}}]\n' "$ANDROID_CERT_SHA256" > dist/.well-known/assetlinks.json; fi

# --- Serve it: unprivileged nginx, listens on 8080 ---
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Fail the build if the nginx configuration is invalid, instead of failing on the server.
RUN nginx -t
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
LABEL org.opencontainers.image.title="Wherebox" \
      org.opencontainers.image.description="Remember where you put things. Local-first PWA." \
      org.opencontainers.image.licenses="MIT"
