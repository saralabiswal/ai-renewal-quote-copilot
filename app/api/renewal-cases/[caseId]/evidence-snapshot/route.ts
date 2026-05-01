import { NextResponse } from 'next/server'
import { createStandaloneEvidenceSnapshot } from '@/lib/db/evidence-snapshots'

type Context = {
  params: Promise<{
    caseId: string
  }>
}

export async function POST(_request: Request, context: Context) {
  try {
    const { caseId } = await context.params
    const result = await createStandaloneEvidenceSnapshot(caseId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to create evidence snapshot', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
