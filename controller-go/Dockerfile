FROM golang:1.22 AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/controller . && \
    mkdir -p /out/history && chmod 0777 /out/history

FROM gcr.io/distroless/static-debian12

WORKDIR /app
COPY --from=build /out/controller /app/controller
COPY --from=build /out/history /app/history

EXPOSE 8080
EXPOSE 9000/udp
EXPOSE 9090

ENTRYPOINT ["/app/controller"]
