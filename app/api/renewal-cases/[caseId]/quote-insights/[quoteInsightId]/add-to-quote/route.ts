import { NextResponse } from 'next/server'
import { addQuoteInsightToQuote } from '@/lib/db/add-quote-insight-to-quote'

type Context = {
  params: Promise<{
    caseId: string
    quoteInsightId: string
  }>
}

export async function POST(_request: Request, context: Context) {
  try {
    const { caseId, quoteInsightId } = await context.params
    const result = await addQuoteInsightToQuote(caseId, quoteInsightId)

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error('Failed to add quote insight to quote', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
