# Focused upgrade audit

## Existing architecture retained

The project already had a sound two-service layout: a React/Vite/Leaflet frontend built into Nginx and an Express API gateway that normalized Open-Meteo, NWS, RainViewer, WFIGS, and USGS data. The existing endpoint surface and Compose service names were retained.

## Findings corrected

- Regional movement used center/zoom only, so metro views could expose far too much geography. All 12 regions now define validated bounds, minimum/default/maximum zoom, sampling points, facility IDs, and rotation policy. The map uses `flyToBounds`.
- NWS alerts were queried only at the regional center. Alerts are now queried at configured regional sampling points and synthetic facility coordinates, then deduplicated by alert ID.
- Forecast weather came from one regional coordinate. The primary forecast remains the regional reference forecast, while the map wind layer now uses multiple configured sampling coordinates and does not fabricate a continuous surface.
- Threat scoring constants were embedded in JavaScript. They now live in `config/scoring.json` and the backend returns regional and facility breakdowns.
- Feed health omitted last attempt and cache state. Cache envelopes now report last attempt, last success, data age, stale state, cache status, and errors. Concurrent refreshes for the same cache key are deduplicated.
- The API health response omitted source/cache health and application version. Those fields are now included.
- Synthetic code uniqueness was not validated at startup. Configuration validation now detects duplicate codes, invalid region references, missing region-facility mappings, invalid bounds, and facilities outside their region.
- Facility markers animated under normal conditions. The new illuminated healthcare towers remain calm when normal and animate only for elevated/high states.
- Wildfires used generic dots. They now use distinct fire graphics; facility-relevant incidents can show distance rings and labeled connector lines.
- The intelligence panel lacked a selected-facility detail view and used typography too small for a wallboard. It now exposes facility conditions, alerts, nearest fire/quake, score breakdown, feed freshness, and larger responsive type.
- The API image depended on a runtime config bind mount. Configuration is now copied into the production API image; Compose has no source-code bind mounts.
- Prescribed fires could only be included in the active WFIGS incident collection, which risked conflating planned burns with uncontrolled wildfire. Version 2.1 adds Watch Duty's public prescribed-burn aggregation as a separately labeled, off-by-default map layer that is excluded from exposure scoring.
- Radio-derived intelligence had no safe integration boundary. A disabled-by-default backend connector now normalizes only an explicitly configured authorized endpoint, retains last-valid data, labels output unverified, and never passes it into the scoring engine.
- Wildfire perimeter support was an empty frontend contract. Version 2.2 now queries the authoritative NIFC WFIGS current-interagency-perimeters layer by explicit region bounds, caches it independently, preserves last-valid polygons on refresh failure, computes facility distance to the nearest polygon edge, and exposes a selectable briefing workflow.
- Power-outage intelligence was absent. Version 2.3 adds a disabled-by-default licensed connector, backend-only credentials, ten-minute resilient caching, normalized point/polygon models, area-to-facility spatial matching, deterministic scoring thresholds, visible source health, and explicit language preventing an area match from being presented as confirmed facility power loss.

## No critical defects found in retained infrastructure

Nginx SPA fallback and `/api/` proxy paths were correct. Both Dockerfiles already used pinned images and health checks. The API already had AbortController timeouts, one retry for temporary/5xx responses, structured errors, and last-good-data fallback; these behaviors were preserved and expanded.
