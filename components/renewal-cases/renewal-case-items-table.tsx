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
            <th>Renewal Date</th>
            <th>Current ARR</th>
            <th>Disposition</th>
            <th>Discount</th>
            <th>Risk</th>
            <th>Analysis Summary</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div>{item.productName}</div>
                <div className="small muted">{item.subscriptionNumber}</div>
              </td>
              <td>{item.renewalDate}</td>
              <td>{item.currentArrFormatted}</td>
              <td><Badge tone={item.dispositionTone}>{item.dispositionLabel}</Badge></td>
              <td>{item.discountPercentFormatted}</td>
              <td><Badge tone={item.riskTone}>{item.riskLevel}</Badge></td>
              <td>{item.analysisSummary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
