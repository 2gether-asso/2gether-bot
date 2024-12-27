#syntax=docker/dockerfile:1

# This Dockerfile uses the service folder as context.


# --
# Upstream images

FROM node:22-slim AS node_upstream
FROM nginx:alpine AS nginx_upstream


# --
# Base image

FROM node_upstream AS app_base

# Set app directory
WORKDIR /app


# --
# Npm image

FROM app_base AS app_npm

# Mount source code as volume
VOLUME /app

# Run npm command
COPY --link --chmod=755 ./docker/npm-entrypoint.sh /usr/local/bin/app-npm-entrypoint
ENTRYPOINT [ "app-npm-entrypoint" ]
CMD [ "--help" ]
