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
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Where is your gym?</span>
        <button type="button" onClick={useMyLocation} className="text-sm text-blue-700 underline">
          {locating ? 'Finding you…' : "I'm at my gym now"}
        </button>
      </div>
      <div className="h-56 rounded-xl overflow-hidden border border-stone-200">
        <MapContainer center={value ? [value.lat, value.lng] : FALLBACK_CENTER} zoom={15} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPick onPick={onChange} />
          <FlyTo center={center} />
          {value && (
            <>
              <Marker position={[value.lat, value.lng]} icon={icon} />
              <Circle center={[value.lat, value.lng]} radius={RADIUS_M} pathOptions={{ color: '#1d4ed8' }} />
            </>
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-stone-500 mt-1">
        {value ? 'Check-ins only count inside the blue circle (150 m).' : 'Tap the map on your gym.'}
      </p>
    </div>
  )
}
