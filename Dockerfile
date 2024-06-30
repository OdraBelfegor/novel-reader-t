# syntax=docker/dockerfile:1
FROM ubuntu:jammy

ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# RUN useradd -ms /bin/bash myuser
# USER myuser

RUN --mount=type=cache,target=/var/cache/apt apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng libsndfile1-dev curl && \
    apt-get install -y software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa -y && \
    apt-get install -y python3.11 python3-pip &&\
    ln -s /usr/bin/python3.11 /usr/bin/python && \
    pip install --upgrade pip && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs && \
    npm install -g pnpm && \
    apt-get remove -y --purge software-properties-common curl && \
    apt-get -y upgrade && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


WORKDIR /app
COPY . .

RUN --mount=type=cache,target=/root/.cache/pip python -m pip install -r requirements.txt --ignore-installed && \
    pip cache purge

RUN pnpm install && pnpm --filter ./web build && \
    pnpm --filter ./web copy:destroy && \
    rm -rf ./web/ && \
    pnpm --filter ./server build && \
    rm -rf ./server/src/ && \
    pnpm prune --prod && \
    pnpm store prune

ENV TTS_HOME=/models/ OUTPUT_DIR=/results/ PORT_SERVER=5000 TTS_SERVER=5050
EXPOSE ${PORT_SERVER}

CMD [ "pnpm", "--filter", "./server", "start" ]