import Link from 'next/link'

type DashboardCaseRow = {
  id: string
  caseNumber: string
  accountName: string
  scenarioLabel: string
  recommendedActionLabel: string
  riskLevel: string
  bundleCurrentArrFormatted: string
  bundleProposedArrFormatted: string
  requiresApproval: boolean
  statusLabel: string
}

export function DashboardCaseTable({ items }: { items: DashboardCaseRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Account</th>
            <th>Action</th>
            <th>Risk</th>
            <th>Proposed ARR</th>
            <th>Approval</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link href={`/renewal-cases/${item.id}`} className="table-link">
                  {item.caseNumber}
                </Link>
                <div className="small muted">{item.scenarioLabel}</div>
              </td>

              <td>
                <div>{item.accountName}</div>
                <div className="small muted">Open optional generation trace</div>
              </td>

              <td>{item.recommendedActionLabel}</td>
              <td>{item.riskLevel}</td>
              <td>{item.bundleProposedArrFormatted}</td>
              <td>{item.requiresApproval ? 'Required' : 'Not Required'}</td>
              <td>{item.statusLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
