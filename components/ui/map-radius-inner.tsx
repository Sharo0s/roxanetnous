'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  lat: number
  lng: number
  rayonKm: number
}

function MapUpdater({ lat, lng, rayonKm }: Props) {
  const map = useMap()

  useEffect(() => {
    map.setView([lat, lng], getZoom(rayonKm))
  }, [map, lat, lng, rayonKm])

  return null
}

function getZoom(rayonKm: number): number {
  if (rayonKm <= 5) return 12
  if (rayonKm <= 15) return 11
  if (rayonKm <= 30) return 10
  if (rayonKm <= 50) return 9
  return 8
}

export default function MapRadiusInner({ lat, lng, rayonKm }: Props) {
  // Carte indicative neutralisee pour l'a11y (Strategie 2 story 2.6.6) :
  // les champs ville et rayon des formulaires usagers constituent l'alternative
  // non-visuelle equivalente. Le DOM Leaflet (5 tab stops, libelles anglais
  // non localises) est exclu du flux clavier et SR.
  return (
    <div>
      <div aria-hidden="true" inert>
        <MapContainer
          center={[lat, lng]}
          zoom={getZoom(rayonKm)}
          scrollWheelZoom={false}
          keyboard={false}
          className="h-[200px] w-full rounded-lg border border-gray-200"
          style={{ height: '200px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={[lat, lng]}
            radius={rayonKm * 1000}
            pathOptions={{
              color: '#000',
              fillColor: '#000',
              fillOpacity: 0.1,
              weight: 2,
            }}
          />
          <MapUpdater lat={lat} lng={lng} rayonKm={rayonKm} />
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Carte indicative de la zone d'intervention. Utilisez les champs ville et rayon ci-dessus pour ajuster.
      </p>
    </div>
  )
}
