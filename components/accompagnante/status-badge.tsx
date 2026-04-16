const styles: Record<string, string> = {
  en_attente: 'bg-gray-200 text-gray-700',
  valide: 'bg-accent text-black',
  refuse: 'bg-red-50 text-red-800 border border-red-200',
  a_completer: 'bg-red-50 text-red-800 border border-red-200',
}

const labels: Record<string, string> = {
  en_attente: 'En attente',
  valide: 'Validé',
  refuse: 'Refusé',
  a_completer: 'À compléter',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  )
}
