# Use official Rust image as builder
FROM rust:1.89 AS builder

# Create app directory
WORKDIR /usr/src/app

# Copy manifests first for caching
COPY Cargo.toml ./

# Create empty main.rs for dependency caching
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (cached layer)
RUN cargo build --release || true

# Remove dummy source and copy real source code
RUN rm -rf src
COPY . .

# Build the actual project
RUN cargo build --release

# --- Runtime image ---
FROM debian:bookworm-slim

# Install SQLite runtime
RUN apt-get update && apt-get install -y sqlite3 libsqlite3-dev && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy binary from builder
COPY --from=builder /usr/src/app/assets/ ./assets
COPY --from=builder /usr/src/app/target/release/todoofus ./

# Expose any port your app uses (optional)
EXPOSE 3000

# Run the binary
CMD ["./todoofus"]

