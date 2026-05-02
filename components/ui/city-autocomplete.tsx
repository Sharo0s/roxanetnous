'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { searchCommunes, type CommuneResult } from '@/lib/adresse-api'

type Props = {
  ville: string
  codePostal: string
  onVilleChange: (value: string) => void
  onCodePostalChange: (value: string) => void
  required?: boolean
  // Liste des codes departement ouverts (ex: ["22", "29", "35", "44", "56"]).
  // Si fournie, filtre les suggestions et bloque la selection hors zone.
  // Si omise (undefined), aucun filtrage (compatibilite ascendante).
  departementsOuverts?: string[]
}

function codeDepartementDuPostcode(postcode: string): string {
  // Corse : codes postaux 20XXX. On ne peut pas distinguer 2A/2B sans context,
  // donc on retourne "20" et la verification accepte 2A ou 2B en aval.
  return postcode.slice(0, 2)
}

export function CityAutocomplete({
  ville,
  codePostal,
  onVilleChange,
  onCodePostalChange,
  required,
  departementsOuverts,
}: Props) {
  const [suggestions, setSuggestions] = useState<CommuneResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [query, setQuery] = useState('')
  const [horsZone, setHorsZone] = useState(false)

  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtreActif = useMemo(() => {
    return Array.isArray(departementsOuverts) && departementsOuverts.length > 0
  }, [departementsOuverts])

  const accepteCorse = useMemo(() => {
    return (
      filtreActif &&
      (departementsOuverts!.includes('2A') || departementsOuverts!.includes('2B'))
    )
  }, [departementsOuverts, filtreActif])

  const commentFiltrer = useCallback(
    (results: CommuneResult[]) => {
      if (!filtreActif) return results
      return results.filter((r) => {
        const code = codeDepartementDuPostcode(r.postcode)
        if (code === '20') return accepteCorse
        return departementsOuverts!.includes(code)
      })
    },
    [filtreActif, accepteCorse, departementsOuverts]
  )

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([])
      setHorsZone(false)
      return
    }

    let cancelled = false
    searchCommunes(debouncedQuery).then((results) => {
      if (cancelled) return
      const filtres = commentFiltrer(results)
      setSuggestions(filtres)
      setHorsZone(filtreActif && results.length > 0 && filtres.length === 0)
      setOpen(filtres.length > 0 || (filtreActif && results.length > 0 && filtres.length === 0))
      setActiveIndex(-1)
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, commentFiltrer, filtreActif])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectSuggestion = useCallback(
    (suggestion: CommuneResult) => {
      onVilleChange(suggestion.city)
      onCodePostalChange(suggestion.postcode)
      setOpen(false)
      setSuggestions([])
      setQuery('')
      setHorsZone(false)
    },
    [onVilleChange, onCodePostalChange]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          selectSuggestion(suggestions[activeIndex])
        }
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  const inputClasses =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black'

  return (
    <div ref={containerRef} className="relative grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ville
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={ville}
          onChange={(e) => {
            onVilleChange(e.target.value)
            setQuery(e.target.value)
          }}
          onFocus={() => {
            if (suggestions.length > 0 || horsZone) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Paris"
          className={inputClasses}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Code postal
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={codePostal}
          onChange={(e) => {
            onCodePostalChange(e.target.value)
            setQuery(e.target.value)
          }}
          onFocus={() => {
            if (suggestions.length > 0 || horsZone) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="75001"
          maxLength={5}
          className={inputClasses}
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-gray-300 bg-white shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <li
              key={`${s.postcode}-${s.city}`}
              onMouseDown={() => selectSuggestion(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{s.city}</span>
              <span className="text-gray-500 ml-2">{s.postcode}</span>
              <span className="text-gray-400 ml-2 text-xs">{s.context}</span>
            </li>
          ))}
        </ul>
      )}

      {open && suggestions.length === 0 && horsZone && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-lg">
          Roxane et Nous n&apos;est pas encore disponible dans cette zone. D&apos;autres territoires
          ouvriront prochainement.
        </div>
      )}
    </div>
  )
}
