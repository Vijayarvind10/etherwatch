# EtherWatch

Mini distributed switch telemetry: agents emit NDJSON over UDP, the Go controller aggregates + analyses, and a React dashboard renders live status while Prometheus exposes metrics.

## Components

- `controller-go`: UDP ingest with optional HMAC verification and per-device rate limiting, in-memory EWMA state, consecutive-breach anomaly detector, persistent history (Badger) with REST access, WebSocket hub, and Prometheus gauges.
- `agent-go`: synthetic telemetry generator configurable for device id, interfaces, period, spike probability, and shared secret for message signing.
- `web-dashboard`: Vite + React single-page app showing live device status, alert banner, per-interface details, and lightweight history charts sourced from the controller history API.

## Local Development

1. **Controller**

   ```bash
   cd controller-go
   go run . \
     --udp :9000 \
     --http :8080 \
     --metrics :9090 \
     --offline-after 5s \
     --alert-consecutive 3 \
     --max-ingest-per-sec 0
   ```

   Add `--hmac-secret <secret>` to require signed telemetry (see agent below). To persist the last five minutes of samples across restarts, include `--history-dir ./history --history-retention 10m`. Supplying `--static-dir ../web-dashboard/dist` after building the dashboard (see below) lets the controller serve the compiled UI directly.

2. **Dashboard (Vite dev server)**

   ```bash
   cd web-dashboard
   npm install
   VITE_CONTROLLER_ORIGIN=http://localhost:8080 npm run dev
   # open http://localhost:5173
   ```

   The `VITE_CONTROLLER_ORIGIN` env var tells the SPA where to find the controller WebSocket. When running the dev server on the default port (5173) the value defaults to `http://localhost:8080`, but setting it explicitly keeps the intent obvious.

3. **Agent(s)**

   ```bash
   cd agent-go
   go run . \
     --controller 127.0.0.1:9000 \
     --device sw-01 \
     --ifaces eth0,eth1 \
     --period 1s \
     --spike-prob 0.1 \
     --secret ${HMAC_SECRET:-}
   ```

   Launch additional agents with different `--device` ids to simulate a fleet.

Prometheus metrics are available at <http://localhost:9090/metrics> (`etherwatch_device_status`, `etherwatch_iface_status`, rx/tx/drops gauges, etc.). The controller WebSocket endpoint lives at `ws://localhost:8080/ws`, and historical samples can be queried at `/api/history?device=<id>&iface=<name>&minutes=5`.

## Docker Compose

The repository includes lightweight Dockerfiles for each service. Build everything and start the stack:

```bash
docker compose up --build
```

Services:

- `controller` on TCP `8080`, UDP `9000`, and Prometheus on `9090`, with history persisted under a named volume and HMAC/rate limiting enabled by default (`demo-secret`, 200 msgs/s/device).
- `dashboard` served via nginx at <http://localhost:5173> (it is built with `VITE_CONTROLLER_ORIGIN=http://controller:8080` during the image build).
- `agent` streaming synthetic data to the controller (defaults to device `sw-01` with two interfaces).

Scale agents by overriding the command, e.g.

```bash
docker compose run --rm agent \
  --controller controller:9000 \
  --device sw-02 \
  --ifaces eth0 \
  --period 1s \
  --secret demo-secret
```

or by using the compose `--scale` flag and environment overrides for `--device` / `--secret`.

## Building the Dashboard for Static Hosting

To serve the SPA from the controller process instead of nginx, build once:

```bash
cd web-dashboard
npm run build
```

Then start the controller with `--static-dir ../web-dashboard/dist` (default value) so requests to `/` return the compiled UI.

## Security, rate limiting, and history API

- **HMAC verification**: Add `--hmac-secret <secret>` to the controller and `--secret <secret>` to each agent. Messages missing or failing the signature check are dropped.
- **Rate limiting**: `--max-ingest-per-sec N` caps per-device ingest rate (set to `200` by default in docker-compose; `0` disables throttling).
- **History API**: Enable persistence with `--history-dir <path>` and optional `--history-retention <duration>` (defaults to `5m`). The dashboard fetches `/api/history` to render per-interface sparklines; you can cURL it directly for raw JSON.

## Publishing the dashboard to GitHub Pages

1. **Push to `main`**  
   The included GitHub Actions workflow (`.github/workflows/pages.yml`) builds `web-dashboard` and deploys the `dist/` output to GitHub Pages on every push to `main`.  
   *Optional:* If you want to hardcode a different controller origin at build time, add a repository secret named `VITE_CONTROLLER_ORIGIN`. Otherwise the dashboard derives the origin from the browser URL (handy for dev/preview).

2. **Enable Pages**  
   Under `Settings → Pages`, choose “GitHub Actions” as the build source. After the first successful workflow run, GitHub will display the public URL (typically `https://<user>.github.io/etherwatch`).

3. **Run the backend**  
   Deploy the Go controller/agent (e.g. Docker on a VPS, Render, Fly.io) with matching `--hmac-secret` and exposed ports (`8080` HTTP/WS, `9000/udp` ingest). The dashboard served from GitHub Pages will communicate with this controller.

Once these steps are complete, the GitHub Pages site stays up-to-date automatically each time you push dashboard changes to `main`.
