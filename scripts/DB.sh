#!/bin/bash
set -e  # Exit immediately if a command fails

# Colors for pretty logs
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
RESET="\033[0m"

# Helper function for logging
log_section() {
  echo -e "\n${BLUE}==================== $1 ====================${RESET}\n"
}

log_info() {
  echo -e "${CYAN}[INFO]${RESET} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${RESET} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${RESET} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${RESET} $1"
}

# --- Credential store check ---
CONFIG_FILE="$HOME/.docker/config.json"
if grep -q '"credsStore": "desktop"' "$CONFIG_FILE" 2>/dev/null; then
  if ! command -v docker-credential-desktop &>/dev/null; then
    log_error "Docker config is set to use 'desktop' credential store, but 'docker-credential-desktop' binary is missing."
    echo
    log_info "Fix options:"
    echo "1. Remove or change the credsStore entry in $CONFIG_FILE"
    echo "2. Reinstall Docker Desktop for Mac"
    exit 1
  fi
fi

# --- Build & run Redis ---
log_section "Building Redis image"
docker build -t dlilp-redis-image ../redis
log_success "Redis image built successfully"

log_section "Removing old Redis container"
docker rm -f dlilp-redis-container 2>/dev/null || log_warning "No previous Redis container found"

log_section "Starting Redis container"
docker run -d --name dlilp-redis-container \
  -e ALLOW_EMPTY_PASSWORD=yes \
  -p 6379:6379 \
  dlilp-redis-image
log_success "Redis container started"

# --- Build & run PostgreSQL ---
log_section "Building PostgreSQL image"
docker build -t dlilp-postgresql-image ../postgres
log_success "PostgreSQL image built successfully"

log_section "Removing old PostgreSQL container"
docker rm -f dlilp-postgresql-container 2>/dev/null || log_warning "No previous PostgreSQL container found"

log_section "Starting PostgreSQL container"
docker run -d --name dlilp-postgresql-container \
  -e POSTGRES_DB=dlilp \
  -e POSTGRES_USER=dlilp \
  -e POSTGRES_PASSWORD=test123 \
  -p 5432:5432 \
  --restart always \
  dlilp-postgresql-image
log_success "PostgreSQL container started"

# --- Show running containers ---
log_section "Services now running"
docker ps
