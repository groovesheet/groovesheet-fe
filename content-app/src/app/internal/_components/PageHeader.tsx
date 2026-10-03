/* Every internal page opens with one of these: title, optional one-line
   description, right-aligned actions slot. */
export default function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="int-page-header">
      <div style={{ minWidth: 0 }}>
        <h1 className="int-page-title">{title}</h1>
        {desc ? <p className="int-page-desc">{desc}</p> : null}
      </div>
      {actions ? <div className="int-page-actions">{actions}</div> : null}
    </div>
  );
}
