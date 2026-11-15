import './StatusBadge.css'
export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replaceAll(' ', '-')
  return (
    <span className={`state-badge state-${key}`}>
      <span aria-hidden="true" />
      {status}
    </span>
  )
}
export function PaymentBadge({ label }: { label: string }) {
  const value = label.toLowerCase().trim()
  const key = ['paid', 'fully paid'].includes(value)
    ? 'paid'
    : ['unpaid', 'not paid', 'pending', 'payment pending'].includes(value)
      ? 'unpaid'
      : value.includes('partial')
        ? 'partial'
        : value.includes('refund')
          ? 'refunded'
          : 'unknown'
  return <span className={`payment-badge payment-${key}`}>{label}</span>
}
