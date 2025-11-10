# -----------------------------
# Stage 1: Build the SvelteKit app
# -----------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
COPY pnpm-lock.yaml* yarn.lock* ./

# Install dependencies (prefer pnpm/yarn if present)
RUN if [ -f pnpm-lock.yaml ]; then \
      npm install -g pnpm && pnpm install; \
    elif [ -f yarn.lock ]; then \
      yarn install; \
    else \
      npm install; \
    fi

# Copy the rest of the source
COPY . .

# Build for production
RUN npm run build

# -----------------------------
# Stage 2: Run the built app
# -----------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

# Expose port (change if needed)
EXPOSE 3002

# Set production environment
ENV NODE_ENV=production

# Run your app
CMD ["node", "build"]
