import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon (broken by Vite asset handling)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Guatemala center
const GUATEMALA_CENTER: [number, number] = [15.5, -90.3];
const DEFAULT_ZOOM = 8;

type Mode = 'pin' | 'draw' | 'none';

export interface MapPickerValue {
  lat: number | null;
  lng: number | null;
  boundary: [number, number][] | null; // [lat, lng] pairs for display
}

interface Props {
  value: MapPickerValue;
  onChange: (v: MapPickerValue) => void;
}

// Inner component that can use map hooks
function MapInteraction({
  mode,
  pin,
  setPinFn,
  drawPoints,
  setDrawPointsFn,
}: {
  mode: Mode;
  pin: [number, number] | null;
  setPinFn: (p: [number, number]) => void;
  drawPoints: [number, number][];
  setDrawPointsFn: (pts: [number, number][]) => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (mode === 'pin') {
        setPinFn([lat, lng]);
      } else if (mode === 'draw') {
        setDrawPointsFn([...drawPoints, [lat, lng]]);
      }
    },
  });
  return null;
}

export const MapPicker: React.FC<Props> = ({ value, onChange }) => {
  const [mode, setMode] = useState<Mode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>(value.boundary ?? []);

  // Sync incoming boundary to local draw state when switching
  useEffect(() => {
    setDrawPoints(value.boundary ?? []);
  }, [value.boundary]);

  const pin: [number, number] | null =
    value.lat != null && value.lng != null ? [value.lat, value.lng] : null;

  const handleSetPin = (p: [number, number]) => {
    onChange({ ...value, lat: p[0], lng: p[1] });
  };

  const finishDraw = () => {
    if (drawPoints.length < 3) return;
    onChange({ ...value, boundary: drawPoints });
    setMode('none');
  };

  const clearPin = () => onChange({ ...value, lat: null, lng: null });
  const clearBoundary = () => {
    setDrawPoints([]);
    onChange({ ...value, boundary: null });
  };

  const mapCenter: [number, number] = pin ?? GUATEMALA_CENTER;

  return (
    <div className="space-y-3">
      {/* Mode toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setMode(mode === 'pin' ? 'none' : 'pin')}
          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
            mode === 'pin'
              ? 'bg-hv-green text-white border-hv-green'
              : 'bg-white text-hv-charcoal border-hv-border hover:bg-hv-page'
          }`}
        >
          📍 {mode === 'pin' ? 'Click map to place pin' : 'Place Pin'}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === 'draw' ? 'none' : 'draw'); setDrawPoints([]); }}
          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
            mode === 'draw'
              ? 'bg-hv-accent text-white border-hv-accent'
              : 'bg-white text-hv-charcoal border-hv-border hover:bg-hv-page'
          }`}
        >
          🔷 {mode === 'draw' ? `Drawing… (${drawPoints.length} pts)` : 'Draw Boundary'}
        </button>
        {mode === 'draw' && drawPoints.length >= 3 && (
          <button
            type="button"
            onClick={finishDraw}
            className="px-3 py-1.5 text-sm rounded-md bg-hv-terracotta text-white hover:bg-hv-terracotta-hover transition-colors"
          >
            ✓ Finish Boundary
          </button>
        )}
        {mode === 'draw' && drawPoints.length > 0 && (
          <button
            type="button"
            onClick={() => setDrawPoints(pts => pts.slice(0, -1))}
            className="px-3 py-1.5 text-sm rounded-md border border-hv-border text-hv-gray hover:bg-hv-page transition-colors"
          >
            ↩ Undo
          </button>
        )}
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-hv-border h-48 sm:h-72 md:h-96">
        <MapContainer center={mapCenter} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapInteraction
            mode={mode}
            pin={pin}
            setPinFn={handleSetPin}
            drawPoints={drawPoints}
            setDrawPointsFn={setDrawPoints}
          />
          {pin && <Marker position={pin} />}
          {/* In-progress draw */}
          {mode === 'draw' && drawPoints.length >= 2 && (
            <Polygon positions={drawPoints} pathOptions={{ color: '#637dff', fillOpacity: 0.15, dashArray: '6' }} />
          )}
          {/* Saved boundary */}
          {mode !== 'draw' && value.boundary && value.boundary.length >= 3 && (
            <Polygon positions={value.boundary} pathOptions={{ color: '#2f4f39', fillOpacity: 0.15 }} />
          )}
        </MapContainer>
      </div>

      {/* Current values summary */}
      <div className="flex flex-wrap gap-3 text-xs text-hv-gray">
        {pin ? (
          <span className="flex items-center gap-1">
            📍 {pin[0].toFixed(5)}, {pin[1].toFixed(5)}
            <button type="button" onClick={clearPin} className="text-hv-crisis hover:text-red-700 ml-1">✕</button>
          </span>
        ) : (
          <span className="text-hv-sage">No pin set</span>
        )}
        {value.boundary && value.boundary.length >= 3 ? (
          <span className="flex items-center gap-1">
            🔷 Boundary: {value.boundary.length} points
            <button type="button" onClick={clearBoundary} className="text-hv-crisis hover:text-red-700 ml-1">✕</button>
          </span>
        ) : (
          <span className="text-hv-sage">No boundary drawn</span>
        )}
      </div>
    </div>
  );
};

export default MapPicker;
