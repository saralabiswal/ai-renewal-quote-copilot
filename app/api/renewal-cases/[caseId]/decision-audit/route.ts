import { NextResponse } from 'next/server'
import { getLatestDecisionAuditPacket } from '@/lib/db/decision-audit'

type Context = {
  params: Promise<{
    caseId: string
  }>
}

export async function GET(request: Request, context: Context) {
  try {
    const { caseId } = await context.params
    const packet = await getLatestDecisionAuditPacket(caseId)
    const { searchParams } = new URL(request.url)
    const response = NextResponse.json(packet)

    if (searchParams.get('download') === '1') {
      response.headers.set(
        'Content-Disposition',
        `attachment; filename="decision-audit-${caseId}.json"`,
      )
      response.headers.set('Cache-Control', 'no-store')
    }

    return response
  } catch (error) {
    console.error('Failed to export decision audit packet', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
