// Geocodage via api-adresse.data.gouv.fr et calcul de distance Haversine

type GeocodingResult = {
  lat: number
  lng: number
} | null

export async function geocodeAddress(
  ville: string,
  codePostal: string
): Promise<GeocodingResult> {
  try {
    const query = encodeURIComponent(`${ville} ${codePostal}`)
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${query}&postcode=${codePostal}&limit=1`,
      { next: { revalidate: 86400 } }
    )

    if (!res.ok) return null

    const data = await res.json()

    if (!data.features || data.features.length === 0) return null

    const [lng, lat] = data.features[0].geometry.coordinates
    return { lat, lng }
  } catch {
    return null
  }
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // rayon de la Terre en km
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
