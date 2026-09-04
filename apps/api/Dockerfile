FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm install --no-audit --no-fund && npx turbo run build --filter=@praest/api...
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
CMD ["npm","run","start","-w","@praest/api"]
