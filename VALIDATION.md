# Validation results

Validated on 2026-09-26.

## Passed

- All JSON configuration and package manifests parse.
- All API JavaScript files pass `node --check`.
- `npm ci --omit=dev` succeeds for the API.
- `npm ci` and the production Vite build succeed for the frontend.
- Vite transformed 1,656 modules and emitted production HTML, CSS, and JavaScript bundles without JSX, import, or declaration errors.
- API startup succeeds with the production configuration model.
- `/api/health` returns HTTP 200 with version, uptime, configuration validation, cache state, and source state.
- A live `/api/operating-picture?region=portland-metro` smoke test succeeded.
- The Portland response contained its tightened bounds, six forecast-wind sampling points, normalized threat components, unique synthetic facility codes, and full feed-health metadata.
- All 12 region definitions have valid ordered bounds and mapped sampling points.
- All 35 synthetic facility codes are unique and every facility is inside its configured region boundary.
- Normal facility towers do not animate. Elevated/high towers add a restrained ground pulse.
- Static responsive rules cover 1920×1080, 2560×1440, and 3840×2160 wallboards, with a desktop single-column fallback below 1100px.
- No credentials or API keys are committed. Facility names, cities, and codes remain synthetic.
- Watch Duty's prescribed-burn ArcGIS endpoint returned successfully for all 12 configured regions, including both populated and empty regional results. Empty results remained healthy rather than being treated as failures.
- The optional radio connector was tested against a synthetic local transcript service. It normalized transcript metadata, retained the unverified disclaimer, and did not alter the calculated regional score.
- The production frontend build completed after the Watch Duty upgrade, transforming 1,657 modules without JSX or import failures.
- RainViewer is configured with `maxNativeZoom=7`, preventing unsupported radar-tile requests while allowing Leaflet to overzoom the last native level.
- Regional `fitBounds` may tighten up to two zoom levels beyond the configured default, bounded by each region's maximum zoom. This corrects overly broad views on ultra-wide wallboards.
- The intelligence panel resets to the top when the active region changes so current conditions and primary posture remain visible during unattended rotation.
- Version 2.2 API smoke testing returned live weather, alerts, WFIGS incident points, WFIGS perimeters, earthquakes, radar, and prescribed-burn feed envelopes for Eastern Washington.
- The live Eastern Washington smoke response contained five current WFIGS perimeters and a deterministic nearest-edge facility impact summary; the closest mapped perimeter was 44.6 miles from one synthetic facility at test time.
- Polygon proximity tests passed for both inside-perimeter (0 miles) and outside-nearest-edge cases. Connector endpoints use the same nearest-edge coordinate used by the displayed distance.
- Incident-impact selection pauses rotation, frames the selected perimeter and impacted synthetic facilities, exposes update/acreage/containment metadata, and provides a landscape print stylesheet with the prototype disclaimer.
- Version 2.3 passed both outage states: disabled configuration returns `NOT CONFIGURED` without affecting scores, while a synthetic licensed-API fixture returned a live polygon, 15,000 reported customers out, one synthetic facility-area match, and a deterministic 20-point outage contribution.
- Power-outage credentials remain backend-only. Non-loopback connector URLs must use HTTPS, and the implementation does not scrape the public PowerOutage.us website.

## Environment limitation

Docker is not installed in the build environment, so `docker compose config`, image builds, container startup, container logs, and Nginx-through-container curl tests could not be executed here. The Compose graph, Docker build contexts, Dockerfiles, health-check commands, Nginx proxy, and exposed ports were reviewed statically. The local browser service blocks loopback addresses, so visual inspection used source/layout review plus production build validation rather than a browser screenshot from this environment.
