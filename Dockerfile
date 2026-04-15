FROM node:20-alpine

WORKDIR /app

# Copy package manifests first for better build caching.
COPY package*.json ./
RUN npm ci

# Copy source after dependencies are installed.
COPY . .

EXPOSE 5173

# Use 0.0.0.0 so the dev server is reachable from Docker.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
