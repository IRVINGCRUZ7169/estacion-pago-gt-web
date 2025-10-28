FROM node:18-alpine
WORKDIR /app

# Install production dependencies
COPY package.json package-lock.json* ./
RUN npm install --production --silent

# Copy project files (server and minimal frontend assets required by proxy)
COPY . .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/proxy.js"]
