FROM node:20-alpine

ENV NODE_ENV=production
RUN apk add --no-cache tzdata

WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Website (index.html, admin.html, css, js, assets) + server
WORKDIR /app
COPY . .

WORKDIR /app/server
USER node
EXPOSE 3100
CMD ["node", "server.js"]
