import { NextResponse } from 'next/server'
import {
  normalizeMlRecommendationMode,
  saveRuntimeSettings,
} from '@/lib/settings/runtime-settings'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mlRecommendationMode?: unknown }
    const settings = saveRuntimeSettings({
      mlRecommendationMode: normalizeMlRecommendationMode(body.mlRecommendationMode),
    })

    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to persist ML recommendation settings.',
      },
      { status: 500 },
    )
  }
}
