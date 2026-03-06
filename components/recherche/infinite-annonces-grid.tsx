'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { BadgesDisplay } from '@/components/badges-display'
import { FavoriButton } from '@/components/recherche/favori-button'

type Annonce = {
  id: string
  description: string
  ville: string
  code_postal: string
  auxiliaires_profiles: {
    diplomes: string[]
    experience: string
    specialites: string[]
    permis_conduire: boolean
    vehicule: boolean
    user_id: string
    users: { first_name: string; last_name: string }
  }
}

type Props = {
  annonces: Annonce[]
  badgesMap: Record<string, any>
  userId?: string
  favorisIds?: string[]
}

const PER_PAGE = 24

export function InfiniteAnnoncesGrid({ annonces, badgesMap, userId, favorisIds = [] }: Props) {
  const [visibleCount, setVisibleCount] = useState(PER_PAGE)
  const loaderRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PER_PAGE, annonces.length))
  }, [annonces.length])

  useEffect(() => {
    const loader = loaderRef.current
    if (!loader) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { threshold: 0.1 }
    )
    observer.observe(loader)
    return () => observer.disconnect()
  }, [loadMore])

  const visible = annonces.slice(0, visibleCount)
  const hasMore = visibleCount < annonces.length

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {visible.map((annonce: any) => {
          const profile = annonce.auxiliaires_profiles
          const u = profile?.users
          const diplomeLabel = (profile?.diplomes as string[] || []).map((d: string) => DIPLOMES.find((dp) => dp.value === d)?.label || d).join(', ')
          const expLabel = EXPERIENCE_LEVELS.find((e) => e.value === profile?.experience)?.label || profile?.experience
          const specs = (profile?.specialites as string[] || []).slice(0, 3)

          return (
            <div
              key={annonce.id}
              className="bg-white rounded-xl border p-5 hover:border-accent transition relative flex flex-col"
            >
              {userId && (
                <div className="absolute top-3 right-3">
                  <FavoriButton
                    annonceId={annonce.id}
                    type="auxiliaire"
                    initialIsFavori={favorisIds.includes(annonce.id)}
                  />
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-black/70">
                  {u?.first_name?.[0]}{u?.last_name?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-black">
                      {u?.first_name} {u?.last_name?.[0]}.
                    </p>
                    <BadgesDisplay badges={badgesMap[profile?.user_id]} />
                  </div>
                  <p className="text-xs text-black/70">{diplomeLabel}</p>
                </div>
              </div>

              <p className="text-sm text-black/90 line-clamp-3 mb-3">{annonce.description}</p>

              <div className="flex flex-wrap gap-1 mb-3">
                {specs.map((s: string) => (
                  <span key={s} className="px-2.5 py-0.5 bg-accent text-black rounded-full text-xs">
                    {SPECIALITES.find((sp) => sp.value === s)?.label || s}
                  </span>
                ))}
                {(profile?.specialites?.length || 0) > 3 && (
                  <span className="px-2.5 py-0.5 bg-accent text-black rounded-full text-xs cursor-default relative group">
                    +{profile.specialites.length - 3}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-accent text-black text-xs rounded-lg px-3 py-2 whitespace-nowrap z-50">
                      {(profile.specialites as string[]).slice(3).map((s: string) => SPECIALITES.find((sp) => sp.value === s)?.label || s).join(', ')}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-black/70 mb-3">
                <span>{annonce.ville} ({annonce.code_postal})</span>
                <span>{expLabel}</span>
              </div>

              {(profile?.permis_conduire || profile?.vehicule) && (
                <div className="flex gap-2 mb-3">
                  {profile.permis_conduire && (
                    <span className="text-xs text-black/70">Permis B</span>
                  )}
                  {profile.vehicule && (
                    <span className="text-xs text-black/70">Vehicule</span>
                  )}
                </div>
              )}

              <Link
                href={`/recherche/${annonce.id}`}
                className="mt-auto block w-full text-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
              >
                Voir le profil
              </Link>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#FFB06E] rounded-full animate-spin" />
        </div>
      )}

      {!hasMore && annonces.length > PER_PAGE && (
        <p className="text-center text-sm text-gray-400 py-6">
          {annonces.length} auxiliaires affiches
        </p>
      )}
    </>
  )
}
