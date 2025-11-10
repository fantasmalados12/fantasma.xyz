# Stage 1: Build the application
FROM node:20 as build

WORKDIR /app

# Install build dependencies for canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire application directory
COPY . .

# Stage 2: Run the application
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies for canvas
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libfribidi0 \
    libharfbuzz0b \
    libfontconfig1 \
    libfreetype6 \
    && rm -rf /var/lib/apt/lists/*

# Copy built files from the previous stage
COPY --from=build /app .

# Create a directory for config files
RUN mkdir -p /config

# Copy all YAML files from the config directory and its subdirectories to /config/
ADD config /config/

# Set the default command to run when the container starts
CMD ["npm", "start"]