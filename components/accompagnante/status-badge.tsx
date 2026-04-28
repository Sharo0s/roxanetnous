const styles: Record<string, string> = {
  en_attente: 'bg-gray-200 text-gray-700',
  visio_a_planifier: 'bg-blue-50 text-blue-800 border border-blue-200',
  visio_realisee: 'bg-amber-50 text-amber-800 border border-amber-200',
  valide: 'bg-accent text-black',
  refuse: 'bg-red-50 text-red-800 border border-red-200',
  a_completer: 'bg-red-50 text-red-800 border border-red-200',
}

const labels: Record<string, string> = {
  en_attente: 'En attente',
  visio_a_planifier: 'En attente de visio',
  visio_realisee: 'Visio réalisée',
  valide: 'Validé',
  refuse: 'Refusé',
  a_completer: 'À compléter',
}

type Props = {
  status: string
  source?: 'manuelle' | 'parrainage' | null
}

export function StatusBadge({ status, source }: Props) {
  // Le suffixe "parrainage" n'est affiché que si validée par parrainage,
  // pour distinguer la filière express de la validation manuelle (OCR + visio).
  const showParrainage = status === 'valide' && source === 'parrainage'
  const label = showParrainage ? 'Validé · parrainage' : labels[status] || status
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}
      title={showParrainage ? 'Validée par parrainage (filière express, sans visio)' : undefined}
    >
      {label}
    </span>
  )
}
