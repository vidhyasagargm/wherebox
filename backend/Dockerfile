# syntax=docker/dockerfile:1
# Wherebox backend: PocketBase with the Wherebox schema (pb_migrations) and logic (pb_hooks).

FROM alpine:3.22 AS download
ARG TARGETARCH
ARG PB_VERSION=0.40.5
# Checksums from the PocketBase release's checksums.txt; update together with PB_VERSION.
ARG PB_SHA256_amd64=1dbea1b01eb3dfe64953513859d01e759c96650c4e3264fa4eecd54b769382e4
ARG PB_SHA256_arm64=570baa1c45d2fb92fc0073582b945ca0ece03cbf9837ccabf49a222f99dd02e3
RUN set -eu; \
    case "$TARGETARCH" in amd64) SUM="$PB_SHA256_amd64";; arm64) SUM="$PB_SHA256_arm64";; *) echo "unsupported arch $TARGETARCH"; exit 1;; esac; \
    wget -qO /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip"; \
    echo "$SUM  /tmp/pb.zip" | sha256sum -c -; \
    unzip -q /tmp/pb.zip pocketbase -d /out

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata wget \
 && adduser -D -H -u 10001 pocketbase \
 && mkdir -p /pb_data && chown pocketbase /pb_data
COPY --from=download /out/pocketbase /usr/local/bin/pocketbase
COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
USER pocketbase
VOLUME /pb_data
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1
# Migrations run automatically on start.
CMD ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks"]
LABEL org.opencontainers.image.title="Wherebox backend" \
      org.opencontainers.image.description="PocketBase with the Wherebox schema, sharing and GDPR logic" \
      org.opencontainers.image.licenses="MIT"
