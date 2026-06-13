export function BarList({ title, rows, valueKey = 'value', labelKey = 'label' }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return (
    <section className="panel compact">
      <div className="panel-heading">
        <h2>{title}</h2>
      </div>
      <div className="bar-list">
        {rows.map((row) => (
          <div className="bar-row" key={row[labelKey]}>
            <span>{row[labelKey]}</span>
            <div>
              <i style={{ width: `${(Number(row[valueKey] || 0) / max) * 100}%` }} />
            </div>
            <strong>{row[valueKey]}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function objectRows(object) {
  return Object.entries(object || {}).map(([label, value]) => ({ label, value }));
}
