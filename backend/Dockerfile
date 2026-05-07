FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install system deps for prisma and binary engines
RUN apk add --no-cache libc6-compat bash openssl ca-certificates

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy rest of backend
COPY . .

# Generate Prisma client (if using prisma client in runtime)
RUN npx prisma generate || true

# Expose port
EXPOSE 3000

# Add start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Default CMD runs migrations, seed, then start server
CMD ["/start.sh"]
