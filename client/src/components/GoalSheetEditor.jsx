import { Plus, RotateCcw, Save, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import StatusBadge from './StatusBadge.jsx';

const blankGoal = {
  thrustArea: 'Revenue Growth',
  title: '',
  description: '',
  uomType: 'min',
  unitLabel: '',
  target: '',
  targetDate: '',
  weightage: 10,
  sharedGoalId: null,
  readOnlyFields: [],
};

function cloneGoals(sheet) {
  return (sheet?.goals || []).map((goal) => ({ ...goal }));
}

function isFieldLocked(goal, field) {
  return goal.readOnlyFields?.includes(field);
}

function isDisabled({ editable, mode, goal, field }) {
  if (!editable) return true;
  if (isFieldLocked(goal, field)) return true;
  if (mode === 'manager' && !['target', 'targetDate', 'weightage'].includes(field)) return true;
  return false;
}

export default function GoalSheetEditor({
  sheet,
  thrustAreas,
  mode = 'employee',
  onSave,
  onSubmit,
  onApprove,
  onReturn,
  busy,
}) {
  const [goals, setGoals] = useState(cloneGoals(sheet));
  const [returnReason, setReturnReason] = useState('');

  useEffect(() => {
    setGoals(cloneGoals(sheet));
  }, [sheet?.id, sheet?.status, sheet?.goals?.length]);

  const total = useMemo(() => goals.reduce((sum, goal) => sum + Number(goal.weightage || 0), 0), [goals]);
  const editable = mode === 'manager' ? sheet?.status === 'submitted' : ['draft', 'returned'].includes(sheet?.status || 'draft');

  function updateGoal(index, field, value) {
    setGoals((current) => current.map((goal, goalIndex) => {
      if (goalIndex !== index) return goal;
      const next = { ...goal, [field]: value };
      if (field === 'uomType' && value === 'zero') next.target = 0;
      if (field === 'uomType' && value === 'timeline') next.target = '';
      return next;
    }));
  }

  function addGoal() {
    setGoals((current) => [...current, { ...blankGoal, id: `draft_${Date.now()}` }]);
  }

  function removeGoal(index) {
    setGoals((current) => current.filter((_, goalIndex) => goalIndex !== index));
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Goal Sheet</h2>
          <p>{sheet?.employee?.name || 'My goals'} · <StatusBadge status={sheet?.status || 'draft'} /></p>
        </div>
        <div className={`weight-meter ${total === 100 ? 'ok' : 'warn'}`}>{total}%</div>
      </div>

      {sheet?.returnReason ? <div className="inline-alert">{sheet.returnReason}</div> : null}

      <div className="goal-table">
        <div className="goal-row goal-header">
          <span>Thrust Area</span>
          <span>Goal</span>
          <span>UoM</span>
          <span>Target</span>
          <span>Weight</span>
          <span></span>
        </div>

        {goals.map((goal, index) => (
          <div className="goal-row" key={goal.id || index}>
            <select
              value={goal.thrustArea}
              onChange={(event) => updateGoal(index, 'thrustArea', event.target.value)}
              disabled={isDisabled({ editable, mode, goal, field: 'thrustArea' })}
            >
              {thrustAreas.map((area) => <option key={area}>{area}</option>)}
            </select>

            <div className="goal-title-cell">
              <input
                value={goal.title}
                onChange={(event) => updateGoal(index, 'title', event.target.value)}
                placeholder="Goal title"
                disabled={isDisabled({ editable, mode, goal, field: 'title' })}
              />
              <textarea
                value={goal.description || ''}
                onChange={(event) => updateGoal(index, 'description', event.target.value)}
                placeholder="Description"
                disabled={isDisabled({ editable, mode, goal, field: 'description' })}
              />
              {goal.sharedGoalId ? <small>Shared KPI · recipients can adjust weightage only</small> : null}
            </div>

            <select
              value={goal.uomType}
              onChange={(event) => updateGoal(index, 'uomType', event.target.value)}
              disabled={isDisabled({ editable, mode, goal, field: 'uomType' })}
            >
              <option value="min">Min</option>
              <option value="max">Max</option>
              <option value="timeline">Timeline</option>
              <option value="zero">Zero</option>
            </select>

            <div className="target-cell">
              {goal.uomType === 'timeline' ? (
                <input
                  type="date"
                  value={goal.targetDate || ''}
                  onChange={(event) => updateGoal(index, 'targetDate', event.target.value)}
                  disabled={isDisabled({ editable, mode, goal, field: 'targetDate' })}
                />
              ) : (
                <input
                  type="number"
                  value={goal.target ?? ''}
                  onChange={(event) => updateGoal(index, 'target', event.target.value)}
                  disabled={isDisabled({ editable, mode, goal, field: 'target' })}
                />
              )}
              <input
                value={goal.unitLabel || ''}
                onChange={(event) => updateGoal(index, 'unitLabel', event.target.value)}
                placeholder="Unit"
                disabled={isDisabled({ editable, mode, goal, field: 'unitLabel' })}
              />
            </div>

            <input
              type="number"
              min="10"
              max="100"
              value={goal.weightage}
              onChange={(event) => updateGoal(index, 'weightage', Number(event.target.value))}
              disabled={isDisabled({ editable, mode, goal, field: 'weightage' })}
            />

            <button className="icon-button danger" onClick={() => removeGoal(index)} disabled={!editable || mode === 'manager' || goal.sharedGoalId} title="Remove goal">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <button className="secondary-button" onClick={addGoal} disabled={!editable || mode === 'manager' || goals.length >= 8}>
          <Plus size={17} />
          Add Goal
        </button>
        <button className="secondary-button" onClick={() => setGoals(cloneGoals(sheet))} disabled={!editable}>
          <RotateCcw size={17} />
          Reset
        </button>
        <button className="primary-button" onClick={() => onSave?.(goals)} disabled={!editable || busy}>
          <Save size={17} />
          Save
        </button>
        {mode === 'employee' ? (
          <button className="primary-button green" onClick={() => onSubmit?.()} disabled={!editable || total !== 100 || busy}>
            <Send size={17} />
            Submit
          </button>
        ) : null}
      </div>

      {mode === 'manager' ? (
        <div className="review-actions">
          <textarea
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
            placeholder="Return reason"
          />
          <button className="secondary-button danger" onClick={() => onReturn?.(returnReason)} disabled={busy || sheet?.status !== 'submitted'}>
            Return
          </button>
          <button className="primary-button green" onClick={() => onApprove?.()} disabled={busy || total !== 100 || sheet?.status !== 'submitted'}>
            Approve & Lock
          </button>
        </div>
      ) : null}
    </section>
  );
}
