import { Megaphone, RefreshCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import GoalSheetEditor from '../components/GoalSheetEditor.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function ManagerDashboard({ bootstrap }) {
  const [team, setTeam] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkIn, setCheckIn] = useState({});
  const [sharedGoal, setSharedGoal] = useState({
    cycleId: bootstrap.activeCycle.id,
    thrustArea: 'Customer Success',
    title: 'Improve strategic account health score',
    description: 'Department-level KPI pushed by L1 manager.',
    uomType: 'min',
    target: 80,
    defaultWeightage: 10,
    primaryOwnerId: '',
    recipientIds: [],
  });

  async function load() {
    const [teamData, submissionData] = await Promise.all([
      api(`/manager/team?cycleId=${bootstrap.activeCycle.id}`),
      api(`/manager/submissions?cycleId=${bootstrap.activeCycle.id}&status=submitted`),
    ]);
    setTeam(teamData.team);
    setSubmissions(submissionData.sheets);
    if (!selectedId && submissionData.sheets[0]) setSelectedId(submissionData.sheets[0].id);
    if (!sharedGoal.primaryOwnerId && teamData.team[0]) {
      setSharedGoal((current) => ({
        ...current,
        primaryOwnerId: teamData.team[0].employee.id,
        recipientIds: teamData.team.map((item) => item.employee.id),
      }));
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [bootstrap.activeCycle.id]);

  const selected = useMemo(() => submissions.find((sheet) => sheet.id === selectedId) || submissions[0], [selectedId, submissions]);
  const approvedSheets = team.map((item) => item.sheet).filter((sheet) => sheet?.status === 'approved');

  async function saveReview(goals) {
    setBusy(true);
    try {
      const data = await api(`/manager/sheets/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ goals }),
      });
      setSubmissions((current) => current.map((sheet) => (sheet.id === data.sheet.id ? data.sheet : sheet)));
      setMessage('Review edits saved');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    try {
      await api(`/manager/sheets/${selected.id}/approve`, { method: 'POST' });
      setMessage('Goal sheet approved and locked');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function returnSheet(reason) {
    setBusy(true);
    try {
      await api(`/manager/sheets/${selected.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setMessage('Returned for rework');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCheckIn(sheet) {
    const draft = checkIn[sheet.id] || {};
    setBusy(true);
    try {
      await api('/manager/checkins', {
        method: 'POST',
        body: JSON.stringify({
          goalSheetId: sheet.id,
          quarter: draft.quarter || 'Q1',
          comment: draft.comment || '',
          discussionDate: draft.discussionDate,
        }),
      });
      setMessage('Check-in completed');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function pushSharedGoal() {
    setBusy(true);
    try {
      const data = await api('/manager/shared-goals', {
        method: 'POST',
        body: JSON.stringify(sharedGoal),
      });
      setMessage(data.warnings?.length ? data.warnings.join(' | ') : 'Shared KPI pushed to team');
      await load();
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
          <span className="eyebrow">Manager L1 Workspace</span>
          <h1>Team Goals & Check-ins</h1>
          <p>Review submitted sheets, edit targets inline, approve and lock, then record quarterly feedback.</p>
        </div>
        <button className="secondary-button" onClick={load}>
          <RefreshCcw size={17} />
          Refresh
        </button>
      </header>

      <div className="stats-grid">
        <StatCard label="Team Members" value={team.length} tone="blue" />
        <StatCard label="Pending Approval" value={submissions.length} tone="amber" />
        <StatCard label="Approved Sheets" value={approvedSheets.length} tone="green" />
      </div>

      {message ? <div className="inline-alert">{message}</div> : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Team Completion</h2>
            <p>Real-time completion status by employee.</p>
          </div>
        </div>
        <div className="data-table">
          <div className="data-row data-header">
            <span>Employee</span>
            <span>Role</span>
            <span>Sheet</span>
            <span>Check-ins</span>
          </div>
          {team.map((item) => (
            <div className="data-row" key={item.employee.id}>
              <strong>{item.employee.name}</strong>
              <span>{item.employee.title}</span>
              <StatusBadge status={item.sheet?.status || 'missing'} />
              <span>{item.checkInCount}/4</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel approval-selector">
        <div className="panel-heading">
          <div>
            <h2>Approval Queue</h2>
            <p>Select a submitted sheet to review.</p>
          </div>
          <select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>
            {submissions.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.employee.name}</option>)}
          </select>
        </div>
      </section>

      {selected ? (
        <GoalSheetEditor
          sheet={selected}
          thrustAreas={bootstrap.thrustAreas}
          mode="manager"
          onSave={saveReview}
          onApprove={approve}
          onReturn={returnSheet}
          busy={busy}
        />
      ) : (
        <section className="panel">
          <div className="empty-state">No submitted goal sheets are waiting for approval.</div>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quarterly Check-ins</h2>
            <p>Log structured manager comments for approved sheets.</p>
          </div>
        </div>
        <div className="checkin-list">
          {approvedSheets.map((sheet) => (
            <div className="checkin-row" key={sheet.id}>
              <strong>{sheet.employee.name}</strong>
              <select value={checkIn[sheet.id]?.quarter || 'Q1'} onChange={(event) => setCheckIn({ ...checkIn, [sheet.id]: { ...(checkIn[sheet.id] || {}), quarter: event.target.value } })}>
                <option>Q1</option>
                <option>Q2</option>
                <option>Q3</option>
                <option>Q4</option>
              </select>
              <input type="date" value={checkIn[sheet.id]?.discussionDate || ''} onChange={(event) => setCheckIn({ ...checkIn, [sheet.id]: { ...(checkIn[sheet.id] || {}), discussionDate: event.target.value } })} />
              <input value={checkIn[sheet.id]?.comment || ''} onChange={(event) => setCheckIn({ ...checkIn, [sheet.id]: { ...(checkIn[sheet.id] || {}), comment: event.target.value } })} placeholder="Manager comment" />
              <button className="icon-button" title="Save check-in" onClick={() => saveCheckIn(sheet)} disabled={busy}>
                <Save size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Shared Department KPI</h2>
            <p>Push a read-only KPI to multiple employees.</p>
          </div>
          <button className="primary-button" onClick={pushSharedGoal} disabled={busy}>
            <Megaphone size={17} />
            Push KPI
          </button>
        </div>
        <div className="shared-form">
          <select value={sharedGoal.thrustArea} onChange={(event) => setSharedGoal({ ...sharedGoal, thrustArea: event.target.value })}>
            {bootstrap.thrustAreas.map((area) => <option key={area}>{area}</option>)}
          </select>
          <input value={sharedGoal.title} onChange={(event) => setSharedGoal({ ...sharedGoal, title: event.target.value })} />
          <select value={sharedGoal.uomType} onChange={(event) => setSharedGoal({ ...sharedGoal, uomType: event.target.value })}>
            <option value="min">Min</option>
            <option value="max">Max</option>
            <option value="timeline">Timeline</option>
            <option value="zero">Zero</option>
          </select>
          <input type="number" value={sharedGoal.target} onChange={(event) => setSharedGoal({ ...sharedGoal, target: event.target.value })} placeholder="Target" />
          <input type="number" value={sharedGoal.defaultWeightage} onChange={(event) => setSharedGoal({ ...sharedGoal, defaultWeightage: event.target.value })} placeholder="Weightage" />
        </div>
      </section>
    </>
  );
}
