import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEMO_SCENARIO_KEYS, isDemoScenarioKey, toDemoScenarioKey } from '@/lib/scenarios/demo-scenarios'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params
    const body = await request.json()
    const scenarioRaw = String(body.scenarioKey ?? 'BASE_CASE')
    const scenarioKey = toDemoScenarioKey(scenarioRaw)

    if (!isDemoScenarioKey(scenarioRaw)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid scenario key "${scenarioRaw}". Supported values: ${DEMO_SCENARIO_KEYS.join(', ')}`,
        },
        { status: 400 },
      )
    }

    await prisma.renewalCase.update({
      where: { id: caseId },
      data: {
        demoScenarioKey: scenarioKey,
        quoteInsightsNeedRefresh: true,
        quoteScenariosNeedRefresh: true,
        lastScenarioChangedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true, scenarioKey })
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
