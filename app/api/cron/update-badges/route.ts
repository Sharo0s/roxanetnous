import { NextRequest, NextResponse } from 'next/server'
import { calculateAllBadges } from '@/lib/badges'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const result = await calculateAllBadges()

  return NextResponse.json({
    success: true,
    processed: result.processed,
  })
}
