'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

type MapRadiusProps = {
  ville: string
  codePostal: string
  rayonKm: number
}

const MapInner = dynamic(() => import('./map-radius-inner'), { ssr: false })

export function MapRadius({ ville, codePostal, rayonKm }: MapRadiusProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!ville || !codePostal || codePostal.length !== 5) {
      setCoords(null)
      return
    }

    const controller = new AbortController()

    async function geocode() {
      try {
        const query = encodeURIComponent(`${ville} ${codePostal}`)
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${query}&postcode=${codePostal}&limit=1`,
          { signal: controller.signal }
        )
        if (!res.ok) return
        const data = await res.json()
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].geometry.coordinates
          setCoords({ lat, lng })
        }
      } catch {
        // ignore abort errors
      }
    }

    geocode()
    return () => controller.abort()
  }, [ville, codePostal])

  if (!coords) return null

  return <MapInner lat={coords.lat} lng={coords.lng} rayonKm={rayonKm} />
}
