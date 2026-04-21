import { NextResponse } from 'next/server'
import { generateQuoteScenariosForRenewalCase } from '@/lib/db/quote-scenarios'

type Context = {
  params: Promise<{
    caseId: string
  }>
}

export async function POST(_request: Request, context: Context) {
  try {
    const { caseId } = await context.params
    const result = await generateQuoteScenariosForRenewalCase(caseId)

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    console.error('Failed to generate quote scenarios', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
