import Link from 'next/link'

export type WorkspaceNavItem = {
  label: string
  href: string
  description?: string
}

export function WorkspaceNav({
  title,
  subtitle,
  items,
  activeHref,
}: {
  title: string
  subtitle: string
  items: WorkspaceNavItem[]
  activeHref: string
}) {
  return (
    <section className="workspace-nav" aria-label={`${title} navigation`}>
      <div className="workspace-nav-copy">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="workspace-nav-items">
        {items.map((item, index) => (
          <Link
            key={item.href}
            className={`workspace-nav-item ${item.href === activeHref ? 'active' : ''}`}
            href={item.href as never}
            aria-current={item.href === activeHref ? 'page' : undefined}
          >
            <span className="workspace-nav-step">{index + 1}</span>
            <span className="workspace-nav-item-copy">
              <span>{item.label}</span>
              {item.description ? <small>{item.description}</small> : null}
            </span>
            {index < items.length - 1 ? <span className="workspace-nav-arrow" aria-hidden="true">→</span> : null}
          </Link>
        ))}
      </div>
    </section>
  )
}
