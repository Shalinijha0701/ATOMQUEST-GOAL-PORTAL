import { RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AchievementPanel from '../components/AchievementPanel.jsx';
import GoalSheetEditor from '../components/GoalSheetEditor.jsx';
import StatCard from '../components/StatCard.jsx';

export default function EmployeeDashboard({ bootstrap }) {
  const [sheet, setSheet] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api(`/goals/mine?cycleId=${bootstrap.activeCycle.id}`);
    setSheet(data.sheet || {
      status: 'draft',
      cycleId: bootstrap.activeCycle.id,
      goals: [],
      totalWeightage: 0,
    });
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [bootstrap.activeCycle.id]);

  async function save(goals) {
    setBusy(true);
    setMessage('');
    try {
      const data = await api('/goals/mine', {
        method: 'PUT',
        body: JSON.stringify({ cycleId: bootstrap.activeCycle.id, goals }),
      });
      setSheet(data.sheet);
      setMessage('Goal sheet saved');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMessage('');
    try {
      const data = await api('/goals/mine/submit', {
        method: 'POST',
        body: JSON.stringify({ cycleId: bootstrap.activeCycle.id }),
      });
      setSheet(data.sheet);
      setMessage('Submitted to L1 manager');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Employee Workspace</span>
          <h1>My Goal Sheet</h1>
          <p>Create goals, validate weightage, submit for approval, and update quarterly achievements after lock.</p>
        </div>
        <button className="secondary-button" onClick={() => load()}>
          <RefreshCcw size={17} />
          Refresh
        </button>
      </header>

      <div className="stats-grid">
        <StatCard label="Sheet Status" value={sheet?.status || 'draft'} tone="blue" />
        <StatCard label="Total Weightage" value={`${sheet?.totalWeightage || 0}%`} tone={(sheet?.totalWeightage || 0) === 100 ? 'green' : 'amber'} />
        <StatCard label="Goals" value={sheet?.goals?.length || 0} tone="violet" detail="Max 8" />
      </div>

      {message ? <div className="inline-alert">{message}</div> : null}

      <GoalSheetEditor
        sheet={sheet}
        thrustAreas={bootstrap.thrustAreas}
        mode="employee"
        onSave={save}
        onSubmit={submit}
        busy={busy}
      />

      <AchievementPanel sheet={sheet} onUpdated={load} />
    </>
  );
}
