FROM node:22-bookworm-slim
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./
COPY web /app/web
COPY fixtures /app/fixtures
USER node
EXPOSE 3000
CMD ["node","src/index.js"]
