import { NextResponse } from 'next/server'
import { buildPolicyPromotionPacket } from '@/lib/policies/policy-change-control'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const packet = buildPolicyPromotionPacket()
  const response = NextResponse.json(packet)

  response.headers.set('Cache-Control', 'no-store')

  if (searchParams.get('download') === '1') {
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="${packet.plan.proposedRegistryId}-promotion-packet.json"`,
    )
  }

  return response
}
