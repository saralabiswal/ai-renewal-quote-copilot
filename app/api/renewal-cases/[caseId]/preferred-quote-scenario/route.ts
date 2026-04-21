import { NextResponse } from 'next/server'
import { setPreferredQuoteScenarioForRenewalCase } from '@/lib/db/quote-scenarios'

type Context = {
  params: Promise<{
    caseId: string
  }>
}

export async function POST(request: Request, context: Context) {
  try {
    const { caseId } = await context.params
    const body = (await request.json().catch(() => ({}))) as {
      scenarioKey?: string | null
    }

    const scenarioKeyRaw = body.scenarioKey
    const scenarioKey =
      typeof scenarioKeyRaw === 'string' && scenarioKeyRaw.trim().length > 0
        ? scenarioKeyRaw.trim()
        : null

    const result = await setPreferredQuoteScenarioForRenewalCase(caseId, scenarioKey)

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
