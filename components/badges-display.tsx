import { Badge } from '@/components/ui/badge'
import type { BadgeData } from '@/lib/badges'

const ANCIENNETE_LABELS: Record<string, { label: string; variant: 'gold' | 'silver' | 'bronze' }> = {
  '5_ans': { label: '5 ans+', variant: 'gold' },
  '3_ans': { label: '3 ans+', variant: 'silver' },
  '1_an': { label: '1 an+', variant: 'bronze' },
}

export function BadgesDisplay({ badges }: { badges: BadgeData | undefined }) {
  if (!badges) return null

  const hasBadge = badges.annonce_active || badges.anciennete

  if (!hasBadge) return null

  return (
    <div className="flex flex-wrap gap-1">
      {badges.annonce_active && (
        <Badge variant="success">Actif</Badge>
      )}
      {badges.anciennete && ANCIENNETE_LABELS[badges.anciennete] && (
        <Badge variant={ANCIENNETE_LABELS[badges.anciennete].variant}>
          {ANCIENNETE_LABELS[badges.anciennete].label}
        </Badge>
      )}
    </div>
  )
}
