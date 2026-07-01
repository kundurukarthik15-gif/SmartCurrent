# frontend/Dockerfile
# Stage 1: Build static React bundles
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy configuration and code
COPY . .

# Compile TypeScript and run Vite build pipeline
RUN npm run build

# Stage 2: Serve static files via Nginx
FROM nginx:alpine

# Copy compiled SPA assets from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx conf can be copied if route redirect support is required
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
