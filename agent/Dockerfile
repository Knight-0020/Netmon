FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
# We need gcc for some net packages? No, pure go is fine usually.
# However, for CGO_ENABLED=0 static binary:
ENV CGO_ENABLED=0
RUN go mod download

COPY . .
RUN go build -o agent .

FROM alpine:latest
# Install basic tools just in case (e.g. for debugging or shell access)
RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /app/agent .

CMD ["./agent"]
