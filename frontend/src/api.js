// All calls go to the FastAPI backend. The backend holds every secret.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8010'

export async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
  return res.json()
}
