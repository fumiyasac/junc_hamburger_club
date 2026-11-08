FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod ./
# go.sum is generated on first build via go mod tidy
RUN apk add --no-cache git
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o admin-api .

# ─── production stage ───────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Tokyo

WORKDIR /app
COPY --from=builder /app/admin-api .

EXPOSE 8080
CMD ["./admin-api"]
