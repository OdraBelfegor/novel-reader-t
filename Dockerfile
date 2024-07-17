# syntax=docker/dockerfile:1
FROM ubuntu:jammy

ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Install dependencies
RUN --mount=type=cache,target=/var/cache/apt apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng libsndfile1-dev && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install python
RUN --mount=type=cache,target=/var/cache/apt apt-get update && apt-get install -y software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa -y && \
    apt-get install -y python3.11 python3-pip &&\
    ln -s /usr/bin/python3.11 /usr/bin/python && \
    python -m pip install --upgrade pip && \
    apt-get remove -y --purge software-properties-common && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install node
RUN --mount=type=cache,target=/var/cache/apt apt-get update && apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs && \
    npm install -g pnpm && \
    apt-get remove -y --purge curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN --mount=type=cache,target=/root/.cache/pip python -m pip install -r requirements.txt --ignore-installed && \
    python -m pip cache purge

RUN pnpm install && pnpm --filter ./web build && \
    pnpm --filter ./web copy:destroy && \
    rm -rf ./web/ && \
    pnpm --filter ./server build && \
    rm -rf ./server/src/ && \
    pnpm prune --prod && \
    pnpm store prune

EXPOSE 8000

CMD [ "pnpm", "--filter", "./server", "start" ]