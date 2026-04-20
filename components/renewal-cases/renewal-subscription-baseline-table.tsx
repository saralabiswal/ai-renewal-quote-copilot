import Link from 'next/link'
import { RenewalSubscriptionBaselineListItem } from '@/types/renewal-case'

export function RenewalSubscriptionBaselineTable({
  items,
}: {
  items: RenewalSubscriptionBaselineListItem[]
}) {
  const caseCount = new Set(items.map((item) => item.caseId)).size
  const groupedByAccount = groupByAccount(items)

  return (
    <div className="subscription-account-stack">
      <div className="subscription-account-toolbar">
        <div className="small muted">Expand an account to view its subscription lines.</div>
        <div className="story-lane-chip-row">
          <span className="story-lane-chip">{groupedByAccount.length} Accounts</span>
          <span className="story-lane-chip">{items.length} Subscriptions</span>
          <span className="story-lane-chip">{caseCount} Cases</span>
        </div>
      </div>

      {groupedByAccount.map((group) => (
        <details key={group.key} className="subscription-account-card">
          <summary className="subscription-account-summary">
            <div>
              <h4 className="subscription-account-title">{group.accountName}</h4>
              <div className="small muted">{group.segment}</div>
            </div>
            <div className="story-lane-chip-row">
              <span className="story-lane-chip">{group.items.length} Subscriptions</span>
              <span className="story-lane-chip">{group.caseCount} Cases</span>
            </div>
          </summary>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Subscription #</th>
                  <th>Product</th>
                  <th>Case</th>
                  <th>Renewal Date</th>
                  <th>Qty</th>
                  <th>Net Unit Price</th>
                  <th>Baseline ARR (Subscription)</th>
                </tr>
              </thead>

              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.subscriptionNumber}</td>
                    <td>{item.productName}</td>
                    <td>
                      <Link className="secondary-link" href={`/renewal-cases/${item.caseId}`}>
                        {item.caseNumber}
                      </Link>
                      <div className="small muted">{item.renewalWindowLabel}</div>
                    </td>
                    <td>{item.renewalDate}</td>
                    <td>{item.quantity}</td>
                    <td>{item.netUnitPriceFormatted}</td>
                    <td>{item.baselineArrFormatted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  )
}

type GroupedAccount = {
  key: string
  accountName: string
  segment: string
  caseCount: number
  items: RenewalSubscriptionBaselineListItem[]
}

function groupByAccount(items: RenewalSubscriptionBaselineListItem[]): GroupedAccount[] {
  const groups = new Map<string, {
    accountName: string
    segment: string
    caseIds: Set<string>
    items: RenewalSubscriptionBaselineListItem[]
  }>()

  for (const item of items) {
    const key = `${item.accountName}::${item.segment}`
    const existing = groups.get(key)

    if (existing) {
      existing.items.push(item)
      existing.caseIds.add(item.caseId)
      continue
    }

    groups.set(key, {
      accountName: item.accountName,
      segment: item.segment,
      caseIds: new Set([item.caseId]),
      items: [item],
    })
  }

  return Array.from(groups.entries())
    .map(([key, value]) => ({
      key,
      accountName: value.accountName,
      segment: value.segment,
      caseCount: value.caseIds.size,
      items: value.items,
    }))
    .sort((a, b) => a.accountName.localeCompare(b.accountName) || a.segment.localeCompare(b.segment))
}
