export default function AdminPageHeader({ eyebrow = 'Workspace', title, description, meta, children }) {
  return (
    <header className="admin-page-header">
      <div>
        <span className="section-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p className="subtitle">{description}</p> : null}
      </div>
      {children || meta ? <div className="admin-page-header-side">{children || <span className="admin-page-meta">{meta}</span>}</div> : null}
    </header>
  )
}
