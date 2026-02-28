FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY server/ ./server/
EXPOSE 3051
CMD ["node", "server/index.js"]
