import { useEffect } from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, GeoJSON, LayersControl, MapContainer, Marker, Pane, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { gustClass } from '../utils/format.js';

const { BaseLayer, Overlay } = LayersControl;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

function FocusRegion({ region, facilityCount }) {
  const map = useMap();
  useEffect(() => {
    if (!region) return;
    map.setMinZoom(region.minZoom || 4);
    map.setMaxZoom(region.maxZoom || 16);
    if (facilityCount === 1) map.flyTo(region.center, region.defaultZoom || region.zoom, { duration: 1.6 });
    else {
      const preferredZoom = region.defaultZoom || region.zoom || 8;
      const fitMaximum = Math.min(region.maxZoom || 16, preferredZoom + 2);
      map.flyToBounds(region.bounds, { paddingTopLeft: [34, 34], paddingBottomRight: [34, 70], maxZoom: fitMaximum, duration: 1.8, easeLinearity: 0.22 });
    }
  }, [map, region, facilityCount]);
  return null;
}

function ZoomDetailMode() {
  const map = useMap();
  useEffect(() => {
    const update = () => map.getContainer().classList.toggle('detail-zoom', map.getZoom() >= 11);
    update();
    map.on('zoomend', update);
    return () => map.off('zoomend', update);
  }, [map]);
  return null;
}

function FocusIncident({ perimeter }) {
  const map = useMap();
  useEffect(() => {
    if (!perimeter?.geometry) return;
    const bounds = L.geoJSON(perimeter.geometry).getBounds();
    for (const facility of perimeter.facilityImpacts || []) bounds.extend([facility.latitude, facility.longitude]);
    if (bounds.isValid()) map.flyToBounds(bounds, { paddingTopLeft: [70, 70], paddingBottomRight: [360, 90], maxZoom: 12, duration: 1.6 });
  }, [map, perimeter]);
  return null;
}

function facilityIcon(facility) {
  const score = facility.riskScore > 0 ? `<span>${facility.riskScore}</span>` : '';
  return L.divIcon({ className: 'facility-icon-wrap', html: `<div class="facility-tower ${escapeHtml(facility.riskLevel)}"><i class="facility-beam"></i><div class="tower-crown">+</div><div class="tower-body"><i></i><i></i><i></i></div><i class="tower-base"></i>${score}<label>${escapeHtml(facility.code)}</label></div>`, iconSize: [54, 76], iconAnchor: [27, 71], popupAnchor: [0, -70] });
}

function clusterIcon(cluster, regionName) {
  const count = cluster.getChildCount();
  return L.divIcon({ className: 'facility-cluster-wrap', html: `<div class="facility-cluster"><strong>${escapeHtml(regionName.toUpperCase())}</strong><b>${count}</b><span>FACILITIES</span></div>`, iconSize: [108, 70], iconAnchor: [54, 35] });
}

function fireIcon(fire) {
  const relevant = Number.isFinite(fire.distanceMiles) && fire.distanceMiles <= 50;
  return L.divIcon({ className: 'fire-icon-wrap', html: `<div class="fire-beacon${relevant ? ' relevant' : ''}"><b>▲</b></div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
}

function prescribedBurnIcon(burn) {
  return L.divIcon({
    className: 'prescribed-burn-icon-wrap',
    html: `<div class="prescribed-burn-beacon"><b>RX</b><span>${escapeHtml(burn.name)}</span></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -18]
  });
}

function outageIcon(area) {
  const severe = (area.percentOut ?? 0) >= 20 || area.customersOut >= 10000;
  return L.divIcon({ className: 'outage-icon-wrap', html: `<div class="outage-beacon${severe ? ' severe' : ''}"><b>ϟ</b><span>${Number(area.customersOut || 0).toLocaleString()}</span></div>`, iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -22] });
}

function windIcon(point) {
  return L.divIcon({ className: 'wind-sample-wrap', html: `<div class="wind-sample ${gustClass(point.peakGustMph)}"><i style="transform:rotate(${Number(point.windDirectionDegrees) || 0}deg)">↑</i><b>${Math.round(point.peakGustMph)}</b><small>MPH</small><span>${escapeHtml(point.name)}</span></div>`, iconSize: [72, 72], iconAnchor: [36, 36] });
}

function alertStyle(feature) {
  const severity = feature?.properties?.severity || feature?.severity || 'Unknown';
  const color = severity === 'Extreme' ? '#ff3158' : severity === 'Severe' ? '#ff7a2f' : severity === 'Moderate' ? '#ffd24b' : '#42d6e8';
  return { color, weight: 2, fillColor: color, fillOpacity: 0.16 };
}

function evacuationStyle(feature) {
  const status = String(feature?.properties?.status || '').toUpperCase();
  const color = status.includes('ORDER') || status.includes('GO') ? '#ff3f62' : status.includes('WARNING') || status.includes('SET') ? '#ff8b3d' : '#ffd24b';
  return { color, weight: 2, fillColor: color, fillOpacity: 0.2 };
}

function outageStyle(feature) {
  const area = feature?.properties || {};
  const severe = (area.percentOut ?? 0) >= 20 || area.customersOut >= 10000;
  const color = severe ? '#ff3f62' : area.customersOut >= 1000 ? '#ff8b3d' : '#ffd24b';
  return { color, weight: severe ? 3 : 2, fillColor: color, fillOpacity: severe ? 0.22 : 0.12, dashArray: '7 4' };
}

export default function CommandMap({ picture, selectedPerimeter, onSelectPerimeter, onSelectFacility }) {
  const { region, radar, alerts, fires, wildfireSummary, earthquakes, facilities, forecastWindPoints, firePerimeters = [], evacuationZones = [], powerOutages = [], prescribedBurns = [] } = picture;
  const relevantById = new Map((wildfireSummary?.relevantIncidents || []).map((fire) => [fire.id, fire]));
  const mappedFires = fires.map((fire) => relevantById.get(fire.id) || fire);
  return (
    <section className="map-shell">
      <MapContainer center={region.center} zoom={region.defaultZoom || region.zoom} zoomControl={false} preferCanvas className="command-map">
        <FocusRegion region={region} facilityCount={facilities.length} />
        <FocusIncident perimeter={selectedPerimeter} />
        <ZoomDetailMode />
        <LayersControl position="topleft">
          <BaseLayer checked name="Dark satellite imagery"><TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri &mdash; Sources: Esri, Maxar, Earthstar Geographics, GIS User Community" maxZoom={19} className="satellite-tiles" /></BaseLayer>
          <Overlay checked name="Geographic labels and boundaries"><TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution="Labels &copy; Esri" maxZoom={19} pane="overlayPane" opacity={0.72} /></Overlay>
          {radar?.latestTileUrl && <Overlay checked name="Weather radar"><TileLayer url={radar.latestTileUrl} opacity={0.48} attribution="Radar &copy; RainViewer" maxNativeZoom={7} maxZoom={19} /></Overlay>}
          <Overlay checked name="Official NWS alerts"><Pane name="alerts" style={{ zIndex: 430 }}>{alerts.filter((alert) => alert.geometry).map((alert) => <GeoJSON key={alert.id} data={{ type: 'Feature', geometry: alert.geometry, properties: alert }} style={alertStyle}><Popup><b>OFFICIAL NWS ALERT</b><br />{alert.event}<br />{alert.headline}</Popup></GeoJSON>)}</Pane></Overlay>
          {evacuationZones.length > 0 && <Overlay checked name="Official evacuation zones"><Pane name="evacuation-zones" style={{ zIndex: 438 }}>{evacuationZones.map((zone) => <GeoJSON key={zone.id} data={{ type: 'Feature', geometry: zone.geometry, properties: zone }} style={evacuationStyle}><Popup><div className="perimeter-popup"><small>PUBLIC EVACUATION SOURCE</small><b>{zone.name}</b><span>{zone.status}</span><span>{zone.updatedAt ? `Updated ${new Date(zone.updatedAt).toLocaleString()}` : 'Update time unavailable'}</span>{zone.sourceUrl && <a href={zone.sourceUrl} target="_blank" rel="noreferrer">Open official source</a>}</div></Popup></GeoJSON>)}</Pane></Overlay>}
          {powerOutages.length > 0 && <Overlay checked name="Power outage reporting areas"><Pane name="power-outages" style={{ zIndex: 442 }}>{powerOutages.filter((area) => area.geometry).map((area) => <GeoJSON key={area.id} data={{ type: 'Feature', geometry: area.geometry, properties: area }} style={outageStyle}><Popup><div className="outage-popup"><small>POWER OUTAGE REPORTING AREA</small><b>{area.name}</b><span>{area.utility}</span><strong>{area.customersOut.toLocaleString()} customers reported out</strong>{Number.isFinite(area.percentOut) && <span>{area.percentOut.toFixed(1)}% of tracked customers</span>}<span>{area.facilityMatches.length} synthetic facility matches</span><em>Area match does not confirm facility service status.</em></div></Popup></GeoJSON>)}{powerOutages.filter((area) => !area.geometry && Number.isFinite(area.latitude) && Number.isFinite(area.longitude)).map((area) => <Marker key={area.id} position={[area.latitude, area.longitude]} icon={outageIcon(area)}><Popup><div className="outage-popup"><small>POWER OUTAGE REPORT</small><b>{area.name}</b><span>{area.utility}</span><strong>{area.customersOut.toLocaleString()} customers reported out</strong></div></Popup></Marker>)}</Pane></Overlay>}
          <Overlay checked name="Wildfire perimeters"><Pane name="fire-perimeters" style={{ zIndex: 435 }}>{firePerimeters.map((perimeter) => <GeoJSON key={perimeter.id} data={perimeter.geometry} style={{ color: selectedPerimeter?.id === perimeter.id ? '#ffd24b' : '#ff8b3d', weight: selectedPerimeter?.id === perimeter.id ? 4 : 2, fillColor: '#ff8b3d', fillOpacity: selectedPerimeter?.id === perimeter.id ? 0.28 : 0.12 }} eventHandlers={{ click: () => onSelectPerimeter?.(perimeter) }}><Popup><div className="perimeter-popup"><small>NIFC WFIGS CURRENT PERIMETER</small><b>{perimeter.name}</b><span>{perimeter.acres !== null ? `${Math.round(perimeter.acres).toLocaleString()} mapped acres` : 'Mapped acreage unavailable'}</span><span>{perimeter.containmentPercent !== null ? `${perimeter.containmentPercent}% contained` : 'Containment unavailable'}</span><span>{perimeter.facilityImpacts.length} synthetic facilities within 50 mi</span><button type="button" onClick={() => onSelectPerimeter?.(perimeter)}>Open incident impact</button></div></Popup></GeoJSON>)}</Pane></Overlay>
          <Overlay checked name="Wildfire incidents"><Pane name="fires" style={{ zIndex: 450 }}>{mappedFires.map((fire) => <Marker key={fire.id} position={[fire.latitude, fire.longitude]} icon={fireIcon(fire)}><Tooltip direction="top" permanent={false}>{fire.name}{fire.acres ? ` · ${fire.acres.toLocaleString()} acres` : ''}</Tooltip><Popup><b>{fire.name}</b><br />{fire.acres ? `${fire.acres.toLocaleString()} acres` : 'Acreage unavailable'}<br />{fire.containmentPercent !== null ? `${fire.containmentPercent}% contained` : 'Containment unavailable'}<br />Source: NIFC WFIGS</Popup></Marker>)}</Pane></Overlay>
          <Overlay name="Watch Duty prescribed burns"><Pane name="prescribed-burns" style={{ zIndex: 448 }}>{prescribedBurns.map((burn) => <Marker key={burn.id} position={[burn.latitude, burn.longitude]} icon={prescribedBurnIcon(burn)}><Tooltip direction="top">PRESCRIBED BURN · {burn.name}</Tooltip><Popup><div className="prescribed-burn-popup"><small>INFORMATIONAL · PRESCRIBED BURN</small><b>{burn.name}</b><span>{burn.acreage !== null ? `${burn.acreage.toLocaleString()} target acres` : 'Target acreage unavailable'}</span><span>{burn.scheduledStart ? `Scheduled ${new Date(burn.scheduledStart).toLocaleString()}` : 'Schedule unavailable'}</span>{burn.sourceUrl && <a href={burn.sourceUrl} target="_blank" rel="noreferrer">Open source record</a>}<em>Source: Watch Duty aggregation service</em></div></Popup></Marker>)}</Pane></Overlay>
          <Overlay name="Wildfire distance rings"><Pane name="fire-rings" style={{ zIndex: 425 }}>{(wildfireSummary?.relevantIncidents || []).map((fire) => [10, 25, 50].map((miles) => <Circle key={`${fire.id}-${miles}`} center={[fire.latitude, fire.longitude]} radius={miles * 1609.344} pathOptions={{ color: miles === 10 ? '#ff4d3d' : miles === 25 ? '#ff8b3d' : '#ffd24b', weight: 1, dashArray: '5 6', fillOpacity: 0 }} />))}</Pane></Overlay>
          <Overlay checked name="Facility exposure connectors"><Pane name="connectors" style={{ zIndex: 440 }}>{(wildfireSummary?.relevantIncidents || []).map((fire) => <Polyline key={`line-${fire.id}`} positions={[[fire.latitude, fire.longitude], [fire.facilityLatitude, fire.facilityLongitude]]} pathOptions={{ color: '#ffb14a', weight: 1.5, dashArray: '5 7', opacity: 0.85 }}><Tooltip permanent direction="center">{fire.distanceMiles.toFixed(1)} mi</Tooltip></Polyline>)}</Pane></Overlay>
          {selectedPerimeter && <Overlay checked name="Selected perimeter impacts"><Pane name="perimeter-connectors" style={{ zIndex: 620 }}>{selectedPerimeter.facilityImpacts.filter((facility) => facility.nearestPerimeterLatitude !== null).map((facility) => <Polyline key={`perimeter-${selectedPerimeter.id}-${facility.code}`} positions={[[facility.latitude, facility.longitude], [facility.nearestPerimeterLatitude, facility.nearestPerimeterLongitude]]} pathOptions={{ color: facility.insidePerimeter ? '#ff3f62' : facility.distanceMiles <= 10 ? '#ff8b3d' : '#ffd24b', weight: 2, dashArray: '7 6', opacity: 0.95 }}><Tooltip permanent direction="center">{facility.insidePerimeter ? 'INSIDE' : `${facility.distanceMiles.toFixed(1)} mi`}</Tooltip></Polyline>)}</Pane></Overlay>}
          <Overlay checked name="Earthquakes"><Pane name="earthquakes" style={{ zIndex: 445 }}>{earthquakes.map((quake) => <CircleMarker key={quake.id} center={[quake.latitude, quake.longitude]} radius={Math.max(5, quake.magnitude * 2)} pathOptions={{ color: '#d39cff', fillColor: '#7c52ff', fillOpacity: 0.65, weight: 2 }}><Popup><b>M{quake.magnitude.toFixed(1)}</b> · {quake.place}<br />Depth {quake.depthKm.toFixed(1)} km<br />{quake.nearestFacility ? `${quake.nearestFacility.distanceMiles.toFixed(0)} mi to ${quake.nearestFacility.code}` : 'No synthetic facility match'}<br />{new Date(quake.time).toLocaleString()}<br /><a href={quake.url} target="_blank" rel="noreferrer">USGS event</a></Popup></CircleMarker>)}</Pane></Overlay>
          <Overlay name="MODEL FORECAST WIND GUST"><Pane name="forecast-wind" style={{ zIndex: 455 }}>{(forecastWindPoints || []).map((point) => <Marker key={point.name} position={[point.latitude, point.longitude]} icon={windIcon(point)}><Popup><b>MODEL FORECAST WIND GUST</b><br />{point.name}<br />Peak gust {Math.round(point.peakGustMph)} mph · {point.windDirection}</Popup></Marker>)}</Pane></Overlay>
          <Overlay checked name="Synthetic facilities"><Pane name="facilities" style={{ zIndex: 650 }}><MarkerClusterGroup chunkedLoading iconCreateFunction={(cluster) => clusterIcon(cluster, region.name)} spiderfyOnMaxZoom showCoverageOnHover={false} maxClusterRadius={70} disableClusteringAtZoom={11}>{facilities.map((facility) => <Marker key={facility.code} position={[facility.latitude, facility.longitude]} icon={facilityIcon(facility)} riseOnHover eventHandlers={{ click: () => onSelectFacility?.(facility) }}><Popup><div className="facility-popup"><small>{facility.code}</small><strong>{facility.name}</strong><span>{facility.city}, {facility.state} · {facility.type}</span><b>Risk {facility.riskScore} · {facility.riskLevel.toUpperCase()}</b><button type="button" onClick={() => onSelectFacility?.(facility)}>Open intelligence detail</button></div></Popup></Marker>)}</MarkerClusterGroup></Pane></Overlay>
        </LayersControl>
      </MapContainer>
      <div className="map-scan" />
      <div className="map-status"><span>MONITORED EXTENT</span><b>{region.name}</b><i>{region.bounds ? 'BOUNDARY LOCKED' : 'CENTERED VIEW'}</i></div>
      <div className="wind-map-legend"><b>MODEL FORECAST WIND GUST</b><span><i className="gust-blue" />0–15</span><span><i className="gust-green" />15–25</span><span><i className="gust-yellow" />25–35</span><span><i className="gust-orange" />35–50</span><span><i className="gust-red" />50+</span></div>
      <div className="risk-legend"><span><i className="normal" />NORMAL</span><span><i className="monitoring" />MONITOR</span><span><i className="elevated" />ELEVATED</span><span><i className="high" />CRITICAL</span><span><i className="unavailable" />NO DATA</span></div>
      <div className="prescribed-map-key"><i>RX</i><span>WATCH DUTY PRESCRIBED BURNS</span><b>INFORMATIONAL · LAYER OFF BY DEFAULT</b></div>
      {selectedPerimeter && <aside className="incident-impact" aria-label="Selected wildfire perimeter impact">
        <small>INCIDENT IMPACT · NIFC WFIGS</small>
        <h2>{selectedPerimeter.name}</h2>
        <div className="incident-metrics"><span><b>{selectedPerimeter.acres !== null ? Math.round(selectedPerimeter.acres).toLocaleString() : '—'}</b> MAPPED ACRES</span><span><b>{selectedPerimeter.containmentPercent !== null ? `${selectedPerimeter.containmentPercent}%` : '—'}</b> CONTAINED</span><span><b>{selectedPerimeter.facilityImpacts.length}</b> SITES ≤50 MI</span></div>
        <strong>SYNTHETIC FACILITY IMPACT</strong>
        {selectedPerimeter.facilityImpacts.length === 0 ? <p>No synthetic facilities within 50 miles of the mapped perimeter.</p> : <div className="impact-sites">{selectedPerimeter.facilityImpacts.map((facility) => <button type="button" key={facility.code} onClick={() => onSelectFacility?.(facility)}><b>{facility.code}</b><span>{facility.shortName}</span><em>{facility.insidePerimeter ? 'INSIDE PERIMETER' : `${facility.distanceMiles.toFixed(1)} mi`}</em></button>)}</div>}
        <time>Perimeter update {selectedPerimeter.updatedAt ? new Date(selectedPerimeter.updatedAt).toLocaleString() : 'unavailable'}</time>
        <div className="impact-actions"><button type="button" onClick={() => window.print()}>PRINT BRIEFING</button><button type="button" onClick={() => onSelectPerimeter?.(null)}>EXIT IMPACT</button></div>
      </aside>}
    </section>
  );
}
