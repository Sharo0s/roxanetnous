'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SPECIALITES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/use-debounce'
import { searchCommunes, type CommuneResult } from '@/lib/adresse-api'

type Props = {
  currentVille: string
  currentSpecialite: string
  currentExperience: string
}

export function SearchFilters({ currentVille, currentSpecialite, currentExperience }: Props) {
  const router = useRouter()
  const [ville, setVille] = useState(currentVille)
  const [specialites, setSpecialites] = useState<string[]>(currentSpecialite ? currentSpecialite.split(',') : [])
  const [experience, setExperience] = useState(currentExperience)
  const [specOpen, setSpecOpen] = useState(false)
  const specRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<CommuneResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedVille = useDebounce(ville, 300)

  useEffect(() => {
    if (debouncedVille.length < 2 || debouncedVille === currentVille) {
      setSuggestions([])
      return
    }
    let cancelled = false
    searchCommunes(debouncedVille).then((results) => {
      if (!cancelled) {
        setSuggestions(results)
        setOpen(results.length > 0)
        setActiveIndex(-1)
      }
    })
    return () => { cancelled = true }
  }, [debouncedVille, currentVille])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
      if (specRef.current && !specRef.current.contains(e.target as Node)) {
        setSpecOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectSuggestion = useCallback((s: CommuneResult) => {
    setVille(s.city)
    setOpen(false)
    setSuggestions([])
  }, [])

  function toggleSpecialite(value: string) {
    setSpecialites((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }

  function handleSearch() {
    const params = new URLSearchParams()
    if (ville.trim()) params.set('ville', ville.trim())
    if (specialites.length > 0) params.set('specialite', specialites.join(','))
    if (experience) params.set('experience', experience)
    router.push(`/recherche?${params.toString()}`)
  }

  function handleReset() {
    setVille('')
    setSpecialites([])
    setExperience('')
    router.push('/recherche')
  }

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
        if (activeIndex >= 0) {
          selectSuggestion(suggestions[activeIndex])
        } else {
          handleSearch()
        }
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div ref={containerRef} className="relative">
          <label className="block text-xs font-medium text-gray-500 mb-1">Ville</label>
          <input
            type="text"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Paris, Lyon..."
            className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
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
                </li>
              ))}
            </ul>
          )}
        </div>
        <div ref={specRef} className="relative">
          <label className="block text-xs font-medium text-gray-500 mb-1">Spécialités</label>
          <button
            type="button"
            onClick={() => setSpecOpen(!specOpen)}
            className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-black flex items-center justify-between"
          >
            <span className={specialites.length === 0 ? 'text-gray-400' : 'text-gray-900 truncate'}>
              {specialites.length === 0
                ? 'Toutes'
                : specialites.length === 1
                  ? SPECIALITES.find((s) => s.value === specialites[0])?.label || specialites[0]
                  : `${specialites.length} sélectionnées`}
            </span>
            <svg className={`w-4 h-4 text-gray-400 transition ${specOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {specOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-gray-300 bg-white shadow-lg max-h-60 overflow-auto">
              {SPECIALITES.map((s) => (
                <label
                  key={s.value}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={specialites.includes(s.value)}
                    onChange={() => toggleSpecialite(s.value)}
                    className="rounded border-gray-400 accent-black"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Expérience</label>
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">Toutes</option>
            {EXPERIENCE_LEVELS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={handleSearch} className="flex-1">
            Rechercher
          </Button>
          {(currentVille || currentSpecialite || currentExperience) && (
            <Button variant="ghost" onClick={handleReset} size="sm">
              Effacer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
