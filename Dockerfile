FROM node:19.4-slim

WORKDIR /app

COPY package.json package-lock.json .
COPY tsconfig.json .

# Install system dependencies
RUN apt update
RUN apt install -y make g++ libtool
RUN apt install -y python3

# Install node dependencies
RUN npm clean-install --ignore-scripts
