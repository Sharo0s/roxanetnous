'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { searchCommunes, type CommuneResult } from '@/lib/adresse-api'

type Props = {
  ville: string
  codePostal: string
  onVilleChange: (value: string) => void
  onCodePostalChange: (value: string) => void
  required?: boolean
}

export function CityAutocomplete({
  ville,
  codePostal,
  onVilleChange,
  onCodePostalChange,
  required,
}: Props) {
  const [suggestions, setSuggestions] = useState<CommuneResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [query, setQuery] = useState('')

  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([])
      return
    }

    let cancelled = false
    searchCommunes(debouncedQuery).then((results) => {
      if (!cancelled) {
        setSuggestions(results)
        setOpen(results.length > 0)
        setActiveIndex(-1)
      }
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

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
            if (suggestions.length > 0) setOpen(true)
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
            if (suggestions.length > 0) setOpen(true)
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
    </div>
  )
}
