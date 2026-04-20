export function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'info' | 'success' | 'warn' | 'danger'
}) {
  return <span className={`badge ${tone}`}>{children}</span>
}
