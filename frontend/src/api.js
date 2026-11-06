// All calls go to the FastAPI backend. The backend holds every secret.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8010'

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

async function handle(res) {
  if (res.ok) return res.json()
  let detail = 'Something went wrong. Try again.'
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') detail = body.detail
  } catch {
    /* not JSON */
  }
  throw new ApiError(res.status, detail)
}

export async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  return handle(res)
}

export async function apiForm(path, formData) {
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: formData })
  return handle(res)
}

// Ask the phone where it is. Resolves to { lat, lng } or rejects with a plain message.
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser can't share your location."))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? 'Location is blocked. Allow location for this site in your browser settings, then try again.'
              : "Couldn't find your location. Step near a window and try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}
