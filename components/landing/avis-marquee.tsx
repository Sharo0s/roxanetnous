'use client'

type Avis = {
  note: number
  commentaire: string
  auteur_prenom: string
  auteur_nom: string
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className="w-4 h-4"
          style={{ color: i < count ? '#FFB06E' : 'white' }}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function AvisRow({ avis, reverse }: { avis: Avis[]; reverse?: boolean }) {
  const items = [...avis, ...avis]

  return (
    <div className="overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10" />
      <div className={`flex gap-4 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}>
        {items.map((a, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-80 rounded-xl p-5"
            style={{ backgroundColor: '#F5E1C8', border: '1px solid #FFB06E' }}
          >
            <Stars count={a.note} />
            <p className="text-sm text-black mt-3 line-clamp-3">{a.commentaire}</p>
            <p className="text-xs text-black/50 mt-3 font-medium">
              {a.auteur_prenom} {a.auteur_nom[0]}.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AvisMarquee({ avis }: { avis: Avis[] }) {
  if (avis.length === 0) return null

  // Splitter les avis en deux lignes
  const mid = Math.ceil(avis.length / 2)
  const row1 = avis.slice(0, mid)
  const row2 = avis.slice(mid)

  return (
    <div className="flex flex-col gap-4">
      <AvisRow avis={row1} />
      {row2.length > 0 && <AvisRow avis={row2} reverse />}
    </div>
  )
}
