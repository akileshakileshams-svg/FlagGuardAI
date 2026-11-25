FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY server.mjs .

EXPOSE 8081

CMD ["node", "server.mjs"]
