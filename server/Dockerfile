# Stage 1: Build UI
FROM node:18-alpine AS ui-builder
WORKDIR /app/ui
COPY ui/package.json .
# Copy lockfile if exists, but we don't have one guaranteed? npm install will generate.
COPY ui/vite.config.js .
COPY ui/tailwind.config.js .
COPY ui/postcss.config.js .
COPY ui/index.html .
COPY ui/src ./src
# Install and Build
RUN npm install
RUN npm run build

# Stage 2: Build Server
FROM golang:1.21-alpine AS server-builder
WORKDIR /app/server
COPY server/go.mod server/go.mod
# COPY server/go.sum server/go.sum # We don't have it locally, assuming go mod download works or we skip
# We need to run go mod tidy inside if we want robustness
RUN go mod download || true

COPY server .
RUN go mod tidy
RUN go build -o netmon-server .

# Stage 3: Runtime
FROM alpine:latest
WORKDIR /app

# Copy Server
COPY --from=server-builder /app/server/netmon-server .

# Copy UI
COPY --from=ui-builder /app/ui/dist ./ui_dist

# Expose
EXPOSE 8000

CMD ["./netmon-server"]
