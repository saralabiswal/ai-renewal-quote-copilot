import { NextResponse } from 'next/server'
import { generateAiContentForRenewalCase } from '@/lib/db/generate-ai-content'

type Context = {
  params: Promise<{
    caseId: string
  }>
}

export async function POST(_request: Request, context: Context) {
  try {
    const { caseId } = await context.params
    const result = await generateAiContentForRenewalCase(caseId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to generate AI content', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
