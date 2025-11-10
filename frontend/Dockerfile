# -----------------------------
# Stage 1: Build the SvelteKit app
# -----------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Create a directory for config files
RUN mkdir -p /config

# Copy all YAML files from the config directory and its subdirectories to /config/
ADD config /config/

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

# 👇 Pass environment variables from build args
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY

# 👇 Make them visible to the build process
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY

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

# Set production environment and port
ENV NODE_ENV=production
ENV PORT=3002

# Run your app
CMD ["node", "build"]
