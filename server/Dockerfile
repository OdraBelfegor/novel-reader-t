FROM node:22 AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-*.yaml tsconfig.json ./

COPY common ./common
COPY server ./server
COPY web ./web

RUN pnpm install

RUN pnpm run -r build

FROM node:22.11.0-alpine


ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY --from=build /app/web/dist /public/
COPY --from=build /app/server/dist /app/

WORKDIR /app
COPY server/package.json pnpm-lock.yaml ./

RUN pnpm install --prod

ENV TTS_HOME=/models
ENV PROD=true

CMD [ "node", "main.js" ]