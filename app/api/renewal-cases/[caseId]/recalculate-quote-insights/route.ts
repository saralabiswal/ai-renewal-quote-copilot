// app/api/renewal-cases/[caseId]/recalculate-quote-insights/route.ts
import { NextResponse } from 'next/server'
import { recalculateQuoteInsights } from '@/lib/db/quote-insights'

type Context = {
  params: Promise<{
    caseId: string
  }>
}

export async function POST(_request: Request, context: Context) {
  try {
    const { caseId } = await context.params
    const result = await recalculateQuoteInsights(caseId)

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    console.error('Failed to recalculate quote insights', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}