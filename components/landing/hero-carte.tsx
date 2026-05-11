'use client'

import { useEffect, useState, useRef } from 'react'

// Projection GPS -> SVG pour la Bretagne historique (5 dpts : 22, 29, 35, 44, 56)
// Bounding box: lon [-4.85, -0.85], lat [46.82, 48.92]
// Facteur de correction cos(48deg) ~ 0.67 pour compenser la deformation Mercator
function geoToSvg(lon: number, lat: number): [number, number] {
  const x = (lon + 4.85) * 197.5 + 25
  const y = 520 - (lat - 46.82) * 247.62
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

// Contour Bretagne historique (union 5 departements, GeoJSON simplifie 147 pts)
const BRETAGNE_COORDS: [number, number][] = [
  [-1.2355, 47.7570], [-1.2546, 47.7336], [-1.1951, 47.7215],
  [-1.1380, 47.6197], [-1.0069, 47.5891], [-1.0525, 47.5636],
  [-1.0445, 47.5055], [-0.9675, 47.4928], [-0.9542, 47.4539],
  [-0.9749, 47.3714], [-1.1676, 47.3659], [-1.3444, 47.3009],
  [-1.1810, 47.2408], [-1.1634, 47.1855], [-1.2424, 47.1012],
  [-1.1703, 47.0931], [-1.1170, 47.0401], [-1.2007, 47.0400],
  [-1.2683, 47.0847], [-1.2946, 47.0395], [-1.3786, 47.0309],
  [-1.3730, 46.9522], [-1.4583, 46.9258], [-1.4998, 47.0407],
  [-1.5553, 47.0153], [-1.5008, 46.8839], [-1.5485, 46.8601],
  [-1.7203, 46.8846], [-1.7513, 46.9296], [-1.9174, 46.9751],
  [-2.0535, 47.0941], [-2.2268, 47.1309], [-2.1671, 47.1662],
  [-2.1874, 47.2806], [-2.3016, 47.2364], [-2.3697, 47.2774],
  [-2.5139, 47.2846], [-2.5029, 47.3288], [-2.5589, 47.3746],
  [-2.4509, 47.4253], [-2.4987, 47.4572], [-2.5015, 47.4896],
  [-2.4412, 47.4962], [-2.4661, 47.5117], [-2.6523, 47.5395],
  [-2.6813, 47.4958], [-2.7954, 47.4861], [-2.9132, 47.5430],
  [-2.7342, 47.5521], [-2.7144, 47.5930], [-2.7545, 47.6359],
  [-2.8941, 47.5819], [-3.1233, 47.5695], [-3.0945, 47.4824],
  [-3.1294, 47.4738], [-3.1397, 47.5796], [-3.2098, 47.6407],
  [-3.1260, 47.7235], [-3.1763, 47.7347], [-3.2150, 47.6452],
  [-3.3489, 47.7286], [-3.4528, 47.6953], [-3.5210, 47.7577],
  [-3.5230, 47.8491], [-3.5386, 47.7626], [-3.8511, 47.7960],
  [-3.9793, 47.9051], [-3.9779, 47.8537], [-4.1636, 47.8492],
  [-4.1751, 47.8760], [-4.1830, 47.8005], [-4.3624, 47.7957],
  [-4.3503, 47.8572], [-4.4235, 47.9629], [-4.6995, 48.0276],
  [-4.7163, 48.0625], [-4.2856, 48.1047], [-4.3031, 48.1948],
  [-4.4629, 48.2382], [-4.5541, 48.1678], [-4.5445, 48.2412],
  [-4.6064, 48.2608], [-4.5532, 48.3388], [-4.5350, 48.2841],
  [-4.2231, 48.2963], [-4.3672, 48.3437], [-4.4423, 48.3268],
  [-4.4029, 48.3900], [-4.4249, 48.3976], [-4.6087, 48.3379],
  [-4.7723, 48.3292], [-4.7609, 48.3727], [-4.7949, 48.4131],
  [-4.7624, 48.5309], [-4.5196, 48.6346], [-4.3500, 48.6765],
  [-4.2238, 48.6484], [-4.1869, 48.6865], [-4.0576, 48.6893],
  [-3.9834, 48.7263], [-3.9495, 48.6529], [-3.9035, 48.6644],
  [-3.8455, 48.6270], [-3.8545, 48.6864], [-3.8208, 48.7014],
  [-3.5812, 48.6700], [-3.5503, 48.7482], [-3.5839, 48.7710],
  [-3.5409, 48.8232], [-3.3975, 48.8007], [-3.2197, 48.8665],
  [-3.2028, 48.8345], [-3.0944, 48.8676], [-3.0835, 48.8273],
  [-3.0136, 48.8221], [-3.0454, 48.7878], [-2.9290, 48.7538],
  [-2.9451, 48.7208], [-2.8269, 48.6506], [-2.8196, 48.5935],
  [-2.7202, 48.5555], [-2.6984, 48.5057], [-2.4680, 48.6496],
  [-2.3145, 48.6741], [-2.2942, 48.6600], [-2.3375, 48.6197],
  [-2.2635, 48.6436], [-2.1756, 48.5764], [-2.1237, 48.6044],
  [-2.1414, 48.6315], [-2.0731, 48.6398], [-1.9480, 48.5388],
  [-2.0260, 48.6515], [-1.8486, 48.6947], [-1.8717, 48.6474],
  [-1.8451, 48.6164], [-1.5711, 48.6264], [-1.4899, 48.4894],
  [-1.4291, 48.4626], [-1.3447, 48.4731], [-1.2722, 48.5339],
  [-1.0702, 48.5085], [-1.0830, 48.4336], [-1.0450, 48.3277],
  [-1.1015, 48.2618], [-1.0213, 47.9949], [-1.1540, 47.9658],
]

// Belle-Ile-en-Mer
const BELLE_ILE_COORDS: [number, number][] = [
  [-3.0931, 47.3151], [-3.0582, 47.3117], [-3.0752, 47.2877],
  [-3.0952, 47.2832], [-3.1601, 47.2923], [-3.1676, 47.3016],
  [-3.1962, 47.2937], [-3.2210, 47.2948], [-3.2491, 47.3161],
  [-3.2397, 47.3231], [-3.2605, 47.3527], [-3.2610, 47.3720],
  [-3.2196, 47.3794], [-3.1941, 47.3659], [-3.1559, 47.3611],
  [-3.1396, 47.3298],
]

// Ouessant
const OUESSANT_COORDS: [number, number][] = [
  [-5.0631, 48.4491], [-5.1026, 48.4361], [-5.1036, 48.4723],
  [-5.0658, 48.4814], [-5.0404, 48.4651],
]

// Groix
const GROIX_COORDS: [number, number][] = [
  [-3.5076, 47.6406], [-3.4969, 47.6538], [-3.4295, 47.6423],
  [-3.4218, 47.6200], [-3.4407, 47.6274], [-3.4619, 47.6203],
]

function coordsToPath(coords: [number, number][]): string {
  const points = coords.map(([lon, lat]) => geoToSvg(lon, lat))
  return 'M' + points.map(([x, y]) => `${x} ${y}`).join(' L') + ' Z'
}

const BRETAGNE_PATH = coordsToPath(BRETAGNE_COORDS)
const BELLE_ILE_PATH = coordsToPath(BELLE_ILE_COORDS)
const OUESSANT_PATH = coordsToPath(OUESSANT_COORDS)
const GROIX_PATH = coordsToPath(GROIX_COORDS)

// Test point-in-polygon (ray casting)
function isInPolygon(lon: number, lat: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

type VilleCoord = { ville: string; lat: number; lon: number }

export function HeroCarte({ villes }: { villes: VilleCoord[] }) {
  const [visibleCities, setVisibleCities] = useState<number[]>([])
  const [hoveredCity, setHoveredCity] = useState<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const reducedMotionRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const startedRef = useRef(false)
  const currentAnimationRef = useRef<Animation | null>(null)

  // Convertir et melanger cote client uniquement
  const [cities, setCities] = useState<{ name: string; x: number; y: number }[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mq.matches
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches
      setReducedMotion(e.matches)
      if (e.matches && currentAnimationRef.current) {
        currentAnimationRef.current.cancel()
        currentAnimationRef.current = null
        if (pathRef.current) pathRef.current.style.strokeDashoffset = '0'
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    // Filtrer les villes reellement dans le contour de la Bretagne
    const bretagneVilles = villes.filter(
      (v) => isInPolygon(v.lon, v.lat, BRETAGNE_COORDS)
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
        (c) => Math.hypot(c.x - city.x, c.y - city.y) < 23
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
            if (reducedMotionRef.current) {
              path.style.strokeDashoffset = '0'
            } else {
              path.style.strokeDashoffset = `${length}`
              currentAnimationRef.current = path.animate(
                [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
                { duration: 2000, easing: 'ease-in-out', fill: 'forwards' }
              )
            }
          }

          if (reducedMotionRef.current) {
            setVisibleCities(filtered.map((_, i) => i))
          } else {
            setTimeout(() => {
              for (let i = 0; i < filtered.length; i++) {
                setTimeout(() => {
                  setVisibleCities((prev) => [...prev, i])
                }, i * 150)
              }
            }, 1800)
          }
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
      <svg viewBox="-30 -20 850 560" className="w-full h-auto" aria-hidden="true" role="presentation">
        {/* Contour Bretagne */}
        <path
          ref={pathRef}
          d={BRETAGNE_PATH}
          fill="none"
          stroke="black"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Iles */}
        <path d={BELLE_ILE_PATH} fill="none" stroke="black" strokeWidth={1.2} strokeLinejoin="round" />
        <path d={OUESSANT_PATH} fill="none" stroke="black" strokeWidth={1.2} strokeLinejoin="round" />
        <path d={GROIX_PATH} fill="none" stroke="black" strokeWidth={1.2} strokeLinejoin="round" />

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
              {isVisible && !reducedMotion && (
                <circle cx={city.x} cy={city.y} r={7} fill="none" stroke="black" strokeWidth={1.5}>
                  <animate attributeName="r" from="7" to="28" dur="0.8s" fill="freeze" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="0.8s" fill="freeze" />
                </circle>
              )}

              {/* Pulse */}
              {isVisible && !reducedMotion && (
                <circle cx={city.x} cy={city.y} r={7} fill="none" stroke="black" strokeWidth={0.8}>
                  <animate attributeName="r" values="7;18;7" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.25;0;0.25" dur="3s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Point */}
              <circle
                cx={city.x}
                cy={city.y}
                r={isHovered ? 10 : 7}
                fill="black"
                opacity={isVisible ? 0.85 : 0}
                className="transition-all duration-300"
                style={{ pointerEvents: 'auto', cursor: 'default' }}
                onMouseEnter={() => setHoveredCity(i)}
                onMouseLeave={() => setHoveredCity(null)}
              />

              {/* Label hover */}
              {isVisible && isHovered && (() => {
                const labelW = city.name.length * 10 + 20
                const onRight = city.x > 350
                const rx = onRight ? city.x - 14 - labelW : city.x + 14
                const tx = onRight ? city.x - 14 - labelW + 10 : city.x + 24
                return (
                <g>
                  <rect
                    x={rx}
                    y={city.y - 17}
                    width={labelW}
                    height={34}
                    rx={6}
                    fill="#3d3329"
                  />
                  <text
                    x={tx}
                    y={city.y + 6}
                    fill="white"
                    className="text-[16px] font-medium"
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
