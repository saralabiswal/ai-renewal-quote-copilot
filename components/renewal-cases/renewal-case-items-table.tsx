import { Badge } from '@/components/ui/badge'
import { RenewalCaseItemView } from '@/types/renewal-case'

export function RenewalCaseItemsTable({ items }: { items: RenewalCaseItemView[] }) {
  return (
    <div className="card table-wrapper">
      <h3 className="panel-title">Included Subscription Items</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Rule Recommendation</th>
            <th>Subscription Insight</th>
            <th>Analysis Summary</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div>{item.productName}</div>
                <div className="small muted">{item.subscriptionNumber}</div>
                <div className="small muted">Renewal: {item.renewalDate}</div>
                <div className="small muted">
                  Baseline ARR: {item.currentArrFormatted} | Proposed ARR: {item.proposedArrFormatted}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Badge tone={item.dispositionTone}>{item.dispositionLabel}</Badge>
                  <Badge tone={item.riskTone}>
                    {item.riskLevel}
                    {item.itemRiskScore != null ? ` (${item.itemRiskScore})` : ''}
                  </Badge>
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  Discount: {item.discountPercentFormatted}
                </div>
                <div className="small muted">ARR Delta: {formatSignedCurrency(item.arrDeltaFormatted)}</div>
              </td>
              <td>
                <div className="small">
                  Usage: {formatPercent(item.usagePercentOfEntitlement)} | Active:{' '}
                  {formatPercent(item.activeUserPercent)}
                </div>
                <div className="small">
                  Login Trend 30d: {formatSignedPercent(item.loginTrend30d)} | Tickets:{' '}
                  {formatCount(item.ticketCount90d)}
                  {item.sev1Count90d != null ? ` (Sev1: ${item.sev1Count90d})` : ''}
                </div>
                <div className="small">
                  CSAT: {formatScore(item.csatScore)} | Payment Risk:{' '}
                  {item.paymentRiskBand ?? '—'} | Adoption: {item.adoptionBand ?? '—'}
                </div>
                {item.signalNotes ? <div className="small muted">Note: {item.signalNotes}</div> : null}
              </td>
              <td>{item.analysisSummary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatPercent(value: number | null) {
  if (value == null) return '—'
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`
}

function formatSignedPercent(value: number | null) {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const formatted = `${abs.toFixed(abs % 1 === 0 ? 0 : 1)}%`
  return `${value >= 0 ? '+' : '-'}${formatted}`
}

function formatCount(value: number | null) {
  if (value == null) return '—'
  return String(value)
}

function formatScore(value: number | null) {
  if (value == null) return '—'
  return value.toFixed(1)
}

function formatSignedCurrency(value: string) {
  if (value.startsWith('-') || value.startsWith('+')) return value
  if (value === '$0.00' || value === '$0') return '$0.00'
  return value.startsWith('$') ? `+${value}` : value
}
