import { NextResponse } from 'next/server'
import { recalculateRenewalCaseById } from '@/lib/db/recalculate-renewal-case'

type Context = {
  params: Promise<{
    caseId: string
  }>
}

export async function POST(_request: Request, context: Context) {
  try {
    const { caseId } = await context.params
    const result = await recalculateRenewalCaseById(caseId)

    return NextResponse.json({
      ok: true,
      quoteInsightsNeedRefresh: true,
      result,
    })
  } catch (error) {
    console.error('Failed to recalculate renewal case', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}