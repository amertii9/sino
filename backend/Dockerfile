# ==========================================
# Build Stage
# ==========================================
FROM golang:alpine AS builder

WORKDIR /app

# Install git and certificates
RUN apk add --no-cache git ca-certificates tzdata

# Cache module downloads
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server

# ==========================================
# Production Runtime Stage
# ==========================================
FROM alpine:3.21

WORKDIR /app

# Add runtime certificates and timezone data
RUN apk --no-cache add ca-certificates tzdata

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy compiled binary from builder
COPY --from=builder /app/server /app/server

# Ensure binary is executable
RUN chmod +x /app/server

USER appuser

EXPOSE 8088

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8088/api/health || exit 1

ENTRYPOINT ["/app/server"]
