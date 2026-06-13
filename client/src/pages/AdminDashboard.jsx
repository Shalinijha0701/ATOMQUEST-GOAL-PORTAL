import { Download, RefreshCcw, ShieldAlert, Unlock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, downloadCsv } from '../api/client.js';
import { BarList, objectRows } from '../components/SimpleCharts.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function AdminDashboard({ bootstrap }) {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [escalations, setEscalations] = useState([]);
  const [message, setMessage] = useState('');

  async function load() {
    const [dash, overview, esc] = await Promise.all([
      api('/admin/dashboard'),
      api(`/analytics/overview?cycleId=${bootstrap.activeCycle.id}`),
      api('/admin/escalations'),
    ]);
    setDashboard(dash);
    setAnalytics(overview);
    setEscalations(esc.escalations);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [bootstrap.activeCycle.id]);

  async function unlock(sheet) {
    const reason = window.prompt('Unlock reason', 'Admin exception for approved goal edit');
    if (!reason) return;
    try {
      await api(`/admin/sheets/${sheet.id}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setMessage(`${sheet.employee.name}'s sheet unlocked`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function runEscalations() {
    try {
      const data = await api('/admin/escalations/run', { method: 'POST' });
      setMessage(`${data.total} escalation(s) generated`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!dashboard || !analytics) return <div className="loading">Loading admin workspace...</div>;

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Admin / HR Workspace</span>
          <h1>Governance Dashboard</h1>
          <p>Monitor completion, manage exceptions, export reports, and audit every post-lock change.</p>
        </div>
        <div className="toolbar">
          <button className="secondary-button" onClick={load}>
            <RefreshCcw size={17} />
            Refresh
          </button>
          <button className="primary-button" onClick={() => downloadCsv(`/reports/achievements.csv?cycleId=${bootstrap.activeCycle.id}&quarter=Q1`, 'achievement-report-q1.csv')}>
            <Download size={17} />
            CSV
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <StatCard label="Employees" value={dashboard.stats.employees} tone="blue" />
        <StatCard label="Approved" value={dashboard.stats.approved} tone="green" />
        <StatCard label="Pending" value={dashboard.stats.submitted} tone="amber" />
        <StatCard label="Shared KPIs" value={dashboard.stats.sharedGoals} tone="violet" />
      </div>

      {message ? <div className="inline-alert">{message}</div> : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Completion Dashboard</h2>
            <p>Which employees and managers have completed the cycle activities.</p>
          </div>
        </div>
        <div className="data-table">
          <div className="data-row data-header six-col">
            <span>Employee</span>
            <span>Manager</span>
            <span>Sheet</span>
            <span>Weightage</span>
            <span>Check-ins</span>
            <span></span>
          </div>
          {dashboard.completion.map((sheet) => (
            <div className="data-row six-col" key={sheet.id}>
              <strong>{sheet.employee.name}</strong>
              <span>{sheet.manager.name}</span>
              <StatusBadge status={sheet.status} />
              <span>{sheet.totalWeightage}%</span>
              <span>{sheet.checkIns.length}/4</span>
              <button className="icon-button" title="Unlock sheet" onClick={() => unlock(sheet)}>
                <Unlock size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="analytics-grid">
        <BarList title="Goal Distribution by Thrust Area" rows={objectRows(analytics.distribution.thrustArea)} />
        <BarList title="Goal Distribution by UoM" rows={objectRows(analytics.distribution.uomType)} />
        <BarList title="Sheet Status" rows={objectRows(analytics.distribution.status)} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quarter-on-Quarter Trend</h2>
            <p>Average progress score by update window.</p>
          </div>
        </div>
        <div className="trend-line">
          {analytics.trend.map((item) => (
            <div key={item.quarter}>
              <strong>{item.averageProgress}%</strong>
              <span>{item.quarter}</span>
              <i style={{ height: `${Math.max(8, item.averageProgress)}%` }} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Escalation Module</h2>
            <p>Rule-based reminders for missed submissions, approvals, and check-ins.</p>
          </div>
          <button className="primary-button" onClick={runEscalations}>
            <ShieldAlert size={17} />
            Run Rules
          </button>
        </div>
        <div className="data-table">
          {escalations.slice(0, 6).map((item) => (
            <div className="data-row" key={item.id}>
              <strong>{item.type}</strong>
              <span>{item.message}</span>
              <StatusBadge status={item.severity} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Audit Trail</h2>
            <p>Who changed what and when.</p>
          </div>
        </div>
        <div className="audit-list">
          {dashboard.recentAudit.map((log) => (
            <div key={log.id}>
              <strong>{log.action}</strong>
              <span>{log.entityType} · {new Date(log.createdAt).toLocaleString()}</span>
              {log.reason ? <small>{log.reason}</small> : null}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
