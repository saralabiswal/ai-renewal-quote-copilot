import { NextResponse } from 'next/server'
import { generateQuoteInsightNarrativesForRenewalCase } from '@/lib/db/generate-ai-content'
import { recalculateQuoteInsights } from '@/lib/db/quote-insights'

type Context = {
  params: Promise<{
    caseId: string
  }>
}

export async function POST(_request: Request, context: Context) {
  try {
    const { caseId } = await context.params
    const insightResult = await recalculateQuoteInsights(caseId)
    const aiResult = await generateQuoteInsightNarrativesForRenewalCase(caseId)

    return NextResponse.json({
      ok: true,
      caseId,
      quoteInsights: insightResult,
      ai: aiResult.generated,
    })
  } catch (error) {
    console.error('Failed to regenerate quote insights with AI rationale', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
