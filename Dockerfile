FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/main/package.json apps/main/package.json
COPY apps/camera/package.json apps/camera/package.json
RUN npm ci
COPY apps apps
COPY packages packages
COPY scripts scripts
RUN npm run build
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --workspaces=false --ignore-scripts
COPY backend ./backend
COPY packages ./packages
ENV PORT=8787 DATA_DIR=/data NODE_ENV=production
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 8787
CMD ["node","backend/server.mjs"]
