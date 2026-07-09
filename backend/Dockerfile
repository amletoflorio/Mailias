FROM node:22-alpine
WORKDIR /app
COPY package.json .
# python3/make/g++ needed to build better-sqlite3's native bindings on musl (alpine)
RUN apk add --no-cache python3 make g++ \
  && npm install --omit=dev \
  && apk del python3 make g++
COPY index.js .
ENV NODE_ENV=production
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8787/health || exit 1
CMD ["node", "index.js"]
