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

# Install build dependencies
RUN --mount=type=cache,target=/var/cache/apt \
	--mount=type=cache,target=/var/lib/apt \
	apt-get update && \
	apt-get install -y --no-install-recommends \
		build-essential make libtool autoconf automake python3


# --
# Npm image

FROM app_base AS app_npm

# Mount source code as volume
VOLUME /app

# Run npm command
COPY --link --chmod=755 ./docker/npm-entrypoint.sh /usr/local/bin/app-npm-entrypoint
ENTRYPOINT [ "app-npm-entrypoint" ]
CMD [ "--help" ]


# --
# Runtime base image

FROM app_base AS app_runtime_base

# Set runtime environment
ENV APP_ENV=dev
ENV NODE_ENV=development

# Install dev dependencies, required for build
RUN --mount=type=bind,source=./app/package.json,target=./package.json \
	--mount=type=bind,source=./app/package-lock.json,target=./package-lock.json \
	--mount=type=bind,source=./app/tsconfig.json,target=./tsconfig.json \
	--mount=type=cache,target=~/.npm \
	npm clean-install --include=dev

# Copy application source code
COPY --link ./app .


# --
# Dev image

FROM app_runtime_base AS app_dev

# Start development server
CMD [ "npm", "run", "start-dev" ]


# --
# Prod build image

FROM app_runtime_base AS app_prod_build

# Set runtime environment
ENV APP_ENV=prod
ENV NODE_ENV=production

# Build application
RUN npm run build


# --
# Prod image

FROM app_base AS app_prod

# Set runtime environment
ENV APP_ENV=prod
ENV NODE_ENV=production

# Copy built application files
COPY --from=app_prod_build --link /app/package.json .
COPY --from=app_prod_build --link /app/package-lock.json .
COPY --from=app_prod_build --link /app/dist .

# Start nginx server
CMD [ "npm", "run", "start" ]
