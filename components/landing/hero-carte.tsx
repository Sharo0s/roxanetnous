'use client'

import { useEffect, useState, useRef } from 'react'

// Projection GPS -> SVG pour la Bretagne
// Bounding box: lon [-5.2, -0.9], lat [47.2, 48.95]
function geoToSvg(lon: number, lat: number): [number, number] {
  const x = (lon + 5.2) * (460 / 4.3) + 20
  const y = 480 - (lat - 47.2) * (460 / 1.75) - 20
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

// Contour simplifie de la Bretagne (4 departements administratifs)
// Trace dans le sens horaire depuis la frontiere nord-est
const BRETAGNE_COORDS: [number, number][] = [
  // Frontiere est (du nord au sud)
  [-1.01, 48.65],  // nord-est, pres de Pontorson
  [-1.08, 48.50],  // est de Fougeres
  [-1.17, 48.35],  // Fougeres
  [-1.07, 48.17],  // est de Vitre
  [-1.05, 48.00],  // Vitre
  [-1.18, 47.82],  // est de Chateaubriant
  [-1.37, 47.64],  // Chateaubriant
  [-1.52, 47.50],  // sud-est, vers Nozay
  [-1.62, 47.45],  // Blain
  [-1.78, 47.38],  // vers Saint-Nazaire interieur
  // Cote sud (de l'est vers l'ouest)
  [-2.10, 47.28],  // embouchure Loire / Saint-Nazaire
  [-2.35, 47.26],  // Le Croisic
  [-2.52, 47.28],  // Guerande
  [-2.75, 47.50],  // Vannes sud
  [-2.82, 47.48],  // Golfe du Morbihan
  [-2.95, 47.47],  // Locmariaquer
  [-3.08, 47.50],  // Quiberon
  [-3.13, 47.48],  // Belle-Ile (approximation cote)
  [-3.35, 47.58],  // Lorient
  [-3.43, 47.65],  // Guidel
  [-3.55, 47.70],  // Quimperle
  [-3.82, 47.78],  // Concarneau
  [-3.92, 47.80],  // vers Fouesnant
  [-4.05, 47.83],  // Benodet
  [-4.10, 47.88],  // Quimper sud
  // Pointe du Finistere sud
  [-4.22, 47.85],  // Audierne approche
  [-4.33, 48.00],  // Pointe du Raz
  [-4.52, 48.03],  // Cap Sizun
  [-4.57, 48.08],  // Douarnenez
  [-4.60, 48.15],  // Crozon approche
  // Presqu'ile de Crozon et rade de Brest
  [-4.70, 48.17],  // Crozon
  [-4.78, 48.25],  // Pointe de Pen-Hir
  [-4.73, 48.30],  // Camaret
  [-4.58, 48.33],  // Rade de Brest sud
  [-4.50, 48.38],  // Brest
  [-4.55, 48.42],  // cote nord Brest
  // Cote nord Finistere
  [-4.70, 48.45],  // Le Conquet
  [-4.78, 48.48],  // pointe Saint-Mathieu
  [-4.72, 48.52],  // cote nord
  [-4.57, 48.55],  // Portsall
  [-4.40, 48.58],  // Brignogan
  [-4.22, 48.62],  // cote des Abers
  [-4.05, 48.65],  // Roscoff approche
  [-3.88, 48.68],  // Roscoff
  [-3.72, 48.70],  // Morlaix
  [-3.58, 48.73],  // Plestin-les-Greves
  // Cote nord (Cotes-d'Armor)
  [-3.42, 48.78],  // Lannion
  [-3.22, 48.83],  // Perros-Guirec
  [-3.02, 48.85],  // Paimpol
  [-2.85, 48.83],  // Pointe de l'Arcouest
  [-2.75, 48.78],  // Brehat approche
  [-2.65, 48.73],  // Binic
  [-2.55, 48.68],  // Saint-Brieuc
  [-2.40, 48.63],  // Erquy
  [-2.28, 48.60],  // Cap Frehel
  [-2.10, 48.62],  // Saint-Cast
  [-2.00, 48.63],  // Dinard approche
  [-1.85, 48.65],  // Saint-Malo ouest
  [-1.68, 48.65],  // Saint-Malo
  // Retour vers la frontiere est
  [-1.50, 48.68],  // Cancale approche
  [-1.35, 48.68],  // Cancale
  [-1.20, 48.65],  // vers Mont-Saint-Michel
  [-1.01, 48.65],  // fermeture du contour
]

const BRETAGNE_PATH = (() => {
  const points = BRETAGNE_COORDS.map(([lon, lat]) => geoToSvg(lon, lat))
  return 'M' + points.map(([x, y]) => `${x} ${y}`).join(' L') + ' Z'
})()

type VilleCoord = { ville: string; lat: number; lon: number }

export function HeroCarte({ villes }: { villes: VilleCoord[] }) {
  const [visibleCities, setVisibleCities] = useState<number[]>([])
  const [hoveredCity, setHoveredCity] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const startedRef = useRef(false)

  // Convertir et melanger cote client uniquement
  const [cities, setCities] = useState<{ name: string; x: number; y: number }[]>([])

  useEffect(() => {
    // Filtrer les villes en Bretagne (bounding box)
    const bretagneVilles = villes.filter(
      (v) => v.lon >= -5.2 && v.lon <= -0.9 && v.lat >= 47.2 && v.lat <= 49.0
    )

    const mapped = bretagneVilles.map((v) => {
      const [x, y] = geoToSvg(v.lon, v.lat)
      return { name: v.ville, x, y }
    })
    for (let i = mapped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mapped[i], mapped[j]] = [mapped[j], mapped[i]]
    }
    const filtered: typeof mapped = []
    for (const city of mapped) {
      const tooClose = filtered.some(
        (c) => Math.hypot(c.x - city.x, c.y - city.y) < 20
      )
      if (!tooClose) filtered.push(city)
      if (filtered.length >= 30) break
    }
    setCities(filtered)

    // Animer contour + villes
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true

          const path = pathRef.current
          if (path) {
            const length = path.getTotalLength()
            path.style.strokeDasharray = `${length}`
            path.style.strokeDashoffset = `${length}`
            path.animate(
              [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
              { duration: 2000, easing: 'ease-in-out', fill: 'forwards' }
            )
          }

          setTimeout(() => {
            for (let i = 0; i < filtered.length; i++) {
              setTimeout(() => {
                setVisibleCities((prev) => [...prev, i])
              }, i * 150)
            }
          }, 1800)
        }
      },
      { threshold: 0.15 }
    )

    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <svg viewBox="0 -20 500 540" className="w-full h-auto" aria-hidden="true">
        {/* Contour Bretagne */}
        <path
          ref={pathRef}
          d={BRETAGNE_PATH}
          fill="none"
          stroke="black"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Villes */}
        {cities.map((city, i) => {
          const isVisible = visibleCities.includes(i)
          const isHovered = hoveredCity === i

          return (
            <g
              key={`${city.name}-${i}`}
              className="cursor-default"
              style={{ pointerEvents: 'none' }}
            >
              {/* Ripple */}
              {isVisible && (
                <circle cx={city.x} cy={city.y} r={5} fill="none" stroke="black" strokeWidth={1.5}>
                  <animate attributeName="r" from="5" to="25" dur="0.8s" fill="freeze" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="0.8s" fill="freeze" />
                </circle>
              )}

              {/* Pulse */}
              {isVisible && (
                <circle cx={city.x} cy={city.y} r={5} fill="none" stroke="black" strokeWidth={0.8}>
                  <animate attributeName="r" values="5;16;5" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.25;0;0.25" dur="3s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Point */}
              <circle
                cx={city.x}
                cy={city.y}
                r={isHovered ? 8 : 5.5}
                fill="black"
                opacity={isVisible ? 0.85 : 0}
                className="transition-all duration-300"
                style={{ pointerEvents: 'auto', cursor: 'default' }}
                onMouseEnter={() => setHoveredCity(i)}
                onMouseLeave={() => setHoveredCity(null)}
              />

              {/* Label hover */}
              {isVisible && isHovered && (() => {
                const labelW = city.name.length * 7.5 + 16
                const onRight = city.x > 350
                const rx = onRight ? city.x - 12 - labelW : city.x + 12
                const tx = onRight ? city.x - 12 - labelW + 8 : city.x + 20
                return (
                <g>
                  <rect
                    x={rx}
                    y={city.y - 13}
                    width={labelW}
                    height={26}
                    rx={5}
                    fill="#3d3329"
                  />
                  <text
                    x={tx}
                    y={city.y + 4}
                    fill="white"
                    className="text-[12px] font-medium"
                  >
                    {city.name}
                  </text>
                </g>
                )
              })()}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
