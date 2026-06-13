export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${String(status || '').toLowerCase().replace(/\s+/g, '-')}`}>{status || 'None'}</span>;
}
