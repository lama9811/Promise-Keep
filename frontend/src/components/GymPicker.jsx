import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Vite does not bundle Leaflet's default marker images on its own.
const icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const FALLBACK_CENTER = [39.3434, -76.5839] // used until we know where the user is
const RADIUS_M = 150

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function FlyTo({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, 16)
  }, [center, map])
  return null
}

export default function GymPicker({ value, onChange }) {
  const [center, setCenter] = useState(null)
  const [locating, setLocating] = useState(false)

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCenter([here.lat, here.lng])
        onChange(here)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">Your gym</span>
        <button type="button" onClick={useMyLocation} className="text-sm text-cobalt underline underline-offset-4">
          {locating ? 'Finding you…' : "I'm at my gym now"}
        </button>
      </div>
      <div className="mt-1.5 h-60 overflow-hidden rounded-2xl border border-ink/15">
        <MapContainer
          center={value ? [value.lat, value.lng] : FALLBACK_CENTER}
          zoom={15}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPick onPick={onChange} />
          <FlyTo center={center} />
          {value && (
            <>
              <Marker position={[value.lat, value.lng]} icon={icon} />
              <Circle center={[value.lat, value.lng]} radius={RADIUS_M} pathOptions={{ color: '#1e3bff', weight: 2 }} />
            </>
          )}
        </MapContainer>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        {value ? 'Check-ins only count inside the blue circle, about 150 m.' : 'Tap the map where your gym is.'}
      </p>
    </div>
  )
}
