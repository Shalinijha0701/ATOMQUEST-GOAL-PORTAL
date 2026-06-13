import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api/client.js';

const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

function existingFor(sheet, goalId, quarter) {
  return sheet?.achievements?.find((item) => item.goalId === goalId && item.quarter === quarter);
}

export default function AchievementPanel({ sheet, onUpdated }) {
  const [quarter, setQuarter] = useState('Q1');
  const [forms, setForms] = useState({});
  const [message, setMessage] = useState('');

  const rows = useMemo(() => {
    return (sheet?.goals || []).map((goal) => {
      const existing = existingFor(sheet, goal.id, quarter);
      const draft = forms[goal.id] || {};
      return {
        goal,
        values: {
          actual: draft.actual ?? existing?.actual ?? '',
          actualDate: draft.actualDate ?? existing?.actualDate ?? '',
          status: draft.status ?? existing?.status ?? 'Not Started',
          notes: draft.notes ?? existing?.notes ?? '',
        },
        score: existing?.progressScore,
      };
    });
  }, [sheet, quarter, forms]);

  function update(goalId, field, value) {
    setForms((current) => ({
      ...current,
      [goalId]: {
        ...(current[goalId] || {}),
        [field]: value,
      },
    }));
  }

  async function save(goal, values) {
    setMessage('');
    try {
      await api(`/goals/${sheet.id}/goals/${goal.id}/achievements/${quarter}`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setMessage('Achievement updated');
      setForms((current) => ({ ...current, [goal.id]: undefined }));
      await onUpdated?.();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!sheet || sheet.status !== 'approved') {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quarterly Achievement</h2>
            <p>Available after manager approval locks the sheet.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Quarterly Achievement</h2>
          <p>Planned target vs actual achievement with system-computed progress.</p>
        </div>
        <select value={quarter} onChange={(event) => setQuarter(event.target.value)}>
          {quarters.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      {message ? <div className="inline-alert">{message}</div> : null}

      <div className="achievement-list">
        {rows.map(({ goal, values, score }) => (
          <div className="achievement-row" key={goal.id}>
            <div>
              <strong>{goal.title}</strong>
              <span>{goal.thrustArea} · {goal.uomType} · target {goal.uomType === 'timeline' ? goal.targetDate : `${goal.target} ${goal.unitLabel || ''}`}</span>
            </div>

            {goal.uomType === 'timeline' ? (
              <input type="date" value={values.actualDate} onChange={(event) => update(goal.id, 'actualDate', event.target.value)} />
            ) : (
              <input type="number" value={values.actual} onChange={(event) => update(goal.id, 'actual', event.target.value)} placeholder="Actual" />
            )}

            <select value={values.status} onChange={(event) => update(goal.id, 'status', event.target.value)}>
              <option>Not Started</option>
              <option>On Track</option>
              <option>Completed</option>
            </select>

            <input value={values.notes} onChange={(event) => update(goal.id, 'notes', event.target.value)} placeholder="Notes" />
            <span className="score-pill">{score ?? 0}%</span>
            <button className="icon-button" title="Save achievement" onClick={() => save(goal, values)}>
              <Save size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
