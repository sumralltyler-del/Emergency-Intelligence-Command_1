# Emergency Intelligence Command

A personal, full-screen emergency intelligence wallboard that combines public weather and hazard feeds with **entirely synthetic healthcare facilities**. It is a learning and demonstration prototype—not an operational decision-support system.

> **PERSONAL PROTOTYPE · SYNTHETIC FACILITY DATA · NOT FOR OPERATIONAL USE**

No employer branding, real healthcare facility names/codes, private incident information, credentials, or proprietary data are included.

## Architecture

- **Frontend:** React 18, Vite, Leaflet/React Leaflet, marker clustering, Lucide icons. A multi-stage image compiles the app and Nginx serves it on port 80.
- **API:** Node.js 20 and Express normalize public APIs, calculate proximity/exposure and transparent threat scores, and maintain an in-memory last-known-good cache.
- **Edge:** Nginx serves the single-page app and proxies `/api/*` to the internal `api:3000` service. Browsers do not call hazard APIs directly and no API keys are exposed.
- **Deployment:** Docker Compose exposes only the frontend at `localhost:8080`. Both services include health checks and restart policies.

Version 2.3 adds a licensed PowerOutage.us connector and facility-aware grid-area intelligence. The backend normalizes outage polygons or points, caches the last valid dataset, reports freshness, and identifies synthetic facilities inside reporting polygons. The UI never equates polygon inclusion with confirmed loss of power at a facility. When no licensed API is configured, it displays **NOT CONFIGURED** and does not imply national outage coverage.

## Public data sources and attribution

| Data | Source |
| --- | --- |
| Current conditions and model forecast | Open-Meteo Forecast API |
| Official weather alerts | U.S. National Weather Service API |
| Radar tiles and frame metadata | RainViewer Weather Maps API |
| Current wildfire incident points | NIFC WFIGS public ArcGIS service |
| Current interagency fire perimeters | NIFC WFIGS public ArcGIS service |
| Outage reporting areas and counts | PowerOutage.us licensed REST API when configured |
| Prescribed-burn locations | Watch Duty Prescribed Burn Aggregation Service |
| M2.5+ earthquakes in the past day | USGS real-time GeoJSON feed |
| Satellite imagery and labels | Esri World Imagery and reference tiles |

Attribution is displayed directly on the map and within the interface. Radar is optional; its failure does not stop the rest of the wallboard. Watch Duty's prescribed-burn service is provided for educational and research use; commercial or for-profit use requires prior written consent from Watch Duty.

## Prerequisites

- Docker Desktop 4.x or Docker Engine 24+ with the Compose v2 plugin
- Internet access for public feeds and map tiles
- Approximately 1 GB free disk space for images and build layers

No local Node.js installation is required for the production-style Docker workflow.

## Configure

Copy the example environment file before starting.

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace the example NWS contact address with a real monitored contact address. The NWS requests an identifying `User-Agent`:

```dotenv
NWS_USER_AGENT=EmergencyIntelligencePrototype/2.0 you@example.com
```

No secrets or API keys are required. `.env` is intentionally excluded from Git.

PowerOutage.us does not provide an unrestricted public API. After receiving authorized REST API access, configure the backend-only connector. The browser never receives the credential:

```dotenv
POWEROUTAGE_ENABLED=true
POWEROUTAGE_API_URL=https://licensed-endpoint.example/outages
POWEROUTAGE_API_KEY=replace-with-authorized-token
POWEROUTAGE_AUTH_HEADER=Authorization
POWEROUTAGE_AUTH_SCHEME=Bearer
```

The connector appends `region` and `bbox` query parameters. It accepts arrays, common `{ data: [] }` / `{ outages: [] }` responses, or GeoJSON feature collections. Confirm the licensed response contract and field mapping before production use. The application does not scrape PowerOutage.us webpages.

The prescribed-burn layer is enabled by default but remains off in the map layer selector until an operator chooses it. It is always informational and does not contribute to wildfire counts or scores:

```dotenv
WATCH_DUTY_PRESCRIBED_BURNS_ENABLED=true
```

The radio-intelligence connector is disabled by default. If you operate a legally authorized transcription endpoint, configure it to return either an array or `{ "transcripts": [...] }`. Supported normalized fields include `id`, `feedName`, `text`/`transcript`, `timestamp`/`occurredAt`, `confidence`, and `tags`:

```dotenv
RADIO_INTELLIGENCE_ENABLED=true
RADIO_INTELLIGENCE_URL=https://your-authorized-service.example/transcripts
RADIO_INTELLIGENCE_TOKEN=
```

Tokens are read only from the environment. Never commit them. The frontend labels all records **UNVERIFIED RADIO INTELLIGENCE — REQUIRES CORROBORATION** and excludes them from scoring.

## Start

From the `emergency-intelligence-command` directory:

```bash
docker compose up --build
```

To start in the background:

```bash
docker compose up -d --build
```

Open **http://localhost:8080**.

## Operate the containers

View status and health:

```bash
docker compose ps
```

Follow all logs:

```bash
docker compose logs -f
```

Follow one service:

```bash
docker compose logs -f api
docker compose logs -f frontend
```

Stop the project:

```bash
docker compose down
```

Stop and remove generated volumes:

```bash
docker compose down --volumes
```

Rebuild after code or dependency changes:

```bash
docker compose up -d --build
```

Force a clean image rebuild if Docker reused an old layer:

```bash
docker compose build --no-cache
docker compose up -d
```

PowerShell uses the same `docker compose` commands. Run them in PowerShell from the directory containing `compose.yaml`.

## Test the API directly

The API is intentionally not published as a separate host port. Test it through the Nginx proxy:

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/regions
curl "http://localhost:8080/api/operating-picture?region=western-wa"
```

PowerShell:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
Invoke-RestMethod http://localhost:8080/api/regions
Invoke-RestMethod "http://localhost:8080/api/operating-picture?region=western-wa"
```

Available endpoints:

- `GET /api/health`
- `GET /api/regions`
- `GET /api/facilities?region={regionId}`
- `GET /api/weather?region={regionId}`
- `GET /api/alerts?region={regionId}`
- `GET /api/fires?region={regionId}`
- `GET /api/fire-perimeters?region={regionId}`
- `GET /api/evacuation-zones?region={regionId}`
- `GET /api/power-outages?region={regionId}`
- `GET /api/earthquakes?region={regionId}`
- `GET /api/radar`
- `GET /api/prescribed-burns?region={regionId}`
- `GET /api/radio-intelligence?region={regionId}`
- `GET /api/operating-picture?region={regionId}`

## Development mode

Production mode is the default and recommended demonstration path:

```bash
docker compose up --build
```

For local frontend hot reload, first run the API with local Node.js 20+:

```bash
cd api
npm ci
CONFIG_DIR=../config npm run dev
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:3000`.

PowerShell API startup:

```powershell
cd api
npm ci
$env:CONFIG_DIR="../config"
npm run dev
```

Then use the same frontend commands in a second PowerShell window.

## Cache and failure behavior

- Weather: 5 minutes
- Forecast: returned with weather; normalized hourly data supports a 15-minute policy boundary
- NWS alerts: 1 minute
- Radar: 5 minutes
- Wildfires: 5 minutes
- Fire perimeters: 5 minutes
- Power outages: 10 minutes, matching the advertised upstream refresh interval
- Earthquakes: 5 minutes
- Watch Duty prescribed burns: 30 minutes (upstream service is updated approximately twice daily)
- Optional radio intelligence: 30 seconds
- Regions and facilities: loaded from read-only JSON at API startup

Upstream requests use an `AbortController` timeout and one retry for timeouts, temporary response codes, and 5xx errors. Normal 4xx responses are not retried. A refresh failure returns the last successful cache entry, marks it stale, reports its age, and preserves usable data. A successful empty alert/event list remains healthy and is not treated as an error.

## Troubleshooting

### Port 8080 is already in use

Stop the conflicting service, or change the host side of `"8080:80"` in `compose.yaml`, for example `"8081:80"`, then browse to `http://localhost:8081`.

### API is unhealthy

```bash
docker compose logs --tail=200 api
docker compose ps
```

Confirm `config/regions.json`, `config/facilities.json`, and `config/scoring.json` exist and are valid JSON. Ensure your network can reach Open-Meteo, `api.weather.gov`, NIFC ArcGIS, USGS, and RainViewer.

### Map is visible but a layer is missing

Use the layer selector in the upper-left map corner and inspect feed health in the right panel. Public services can be rate-limited or unavailable. Radar is deliberately optional. Browser privacy extensions can also block map tile hosts.

### NWS requests fail

Set a meaningful `NWS_USER_AGENT` in `.env`, then recreate the API:

```bash
docker compose up -d --build --force-recreate api frontend
```

### Windows file-sharing error

Docker Desktop must be permitted to share the drive containing this repository because Compose mounts the read-only `config` directory into the API container.

### Reset everything generated by Compose

```bash
docker compose down --volumes --remove-orphans
docker compose build --no-cache
docker compose up -d
```

## Regional views and threat scoring

Each region defines explicit southwest/northeast bounds, minimum/default/maximum zoom, synthetic facility IDs, forecast/alert sampling points, and normal/alert/severe rotation timing. Leaflet flies to the configured bounds rather than treating a broad center point as the monitored area.

The regional score is capped at 100 and exposes separate contributions for weather/storm activity (15), official NWS severity (25), relevant wildfire proximity (25), model wind gust (20), facility-proximate earthquake activity (10), and number of meaningfully exposed facilities (5). Constants live in `config/scoring.json`. Fire and earthquake components use proximity to synthetic facilities, so unrelated events do not inflate the score.

Facility scores account for NWS polygon inclusion, regional weather, peak modeled gust, wildfire point or mapped-perimeter distance, nearby earthquake magnitude, licensed power-outage reporting-area inclusion, and feed availability. The wildfire component uses the nearer of the incident point and perimeter edge without double-counting. Wildfires farther than 50 miles from a facility do not contribute to its risk. Outage thresholds and weights are stored in `config/scoring.json`.

## Incident-impact briefing mode

Select an orange NIFC perimeter on the map and choose **Open incident impact**. Rotation pauses while the map fits the perimeter and all synthetic facilities within 50 miles. Connector distances are calculated to the nearest polygon edge—not the incident centroid. The impact card lists only synthetic sites and supports **Print briefing**, which produces a landscape map with the prototype disclaimer.

`config/evacuation-sources.json` provides a validated, region-scoped adapter contract for public ArcGIS evacuation layers. It is intentionally empty in the distributed prototype because evacuation schemas and official authorities vary by jurisdiction. Until an authoritative source is configured for a region, the API returns `configured: false` and the map does not imply evacuation coverage.

## Known limitations

- Regional conditions use a reference-coordinate forecast; the optional forecast-wind layer uses multiple configured sampling points. It is not a continuous meteorological surface.
- NWS alerts are deduplicated across regional sampling points and facility coordinates, but point-query coverage is still not equivalent to a nationwide alert-ingestion pipeline.
- WFIGS field availability may evolve; the normalizer handles several known field-name variants.
- NIFC does not publish a current perimeter for every incident. A missing polygon is not evidence that a fire is inactive or unmapped by local authorities.
- PowerOutage.us API access requires an appropriate agreement. Free invite-only emergency-management dashboard access does not automatically grant API redistribution rights.
- An outage-area match does not prove the synthetic facility itself lost power; service must be corroborated through the facility or utility.
- Perimeter-to-facility distance is a straight-line geodesic approximation for situational awareness, not a road-access, evacuation, fire-spread, or travel-time model.
- Watch Duty prescribed burns are point records and may represent planned or recently reported activity. They are not evidence of an uncontrolled wildfire.
- The public Watch Duty GitHub organization does not provide the production Watch Duty incident feed. The optional connector expects a separately deployed, authorized transcription service; the full open-source transcription project is cloud-oriented and is not bundled into this lightweight Compose stack.
- Automated radio transcription can be inaccurate, delayed, incomplete, or legally restricted by feed terms. Treat every transcript as unverified and comply with source-provider and local requirements.
- The in-memory cache is per API container and is lost on restart.
- Scores are demonstration heuristics, not validated emergency-management models.
- Public-feed latency, rate limits, and incomplete records can affect freshness.
- Google Fonts are loaded from the public web; system fonts provide the fallback if blocked.

## Recommended next steps

1. Add contract tests with recorded upstream fixtures and schema validation.
2. Add outage trend history, peak-customer-out tracking, restoration-rate sparklines, and configurable threshold alerts after obtaining licensed history access.
3. Add synthetic facility resilience attributes such as generator runtime, fuel horizon, UPS status, and utility corroboration state.
4. Add public evacuation-zone adapters region by region, retaining agency, timestamp, status, and source URL on every polygon.
5. Add Redis/PostgreSQL persistence, accessibility testing, authentication, and an audit trail before any multi-user deployment.

## License and safety

Use this prototype for personal learning and demonstrations only. Verify source terms and attribution requirements before redistribution. Never use it as the sole source for safety, medical, evacuation, or operational decisions; consult official local authorities and source agencies.
