import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const demos = [
  { role: 'Employee', email: 'employee@atomquest.local', password: 'Employee@123', note: 'Draft and submit goals' },
  { role: 'Approved Employee', email: 'approved@atomquest.local', password: 'Employee@123', note: 'Update achievements' },
  { role: 'Manager L1', email: 'manager@atomquest.local', password: 'Manager@123', note: 'Approve and check in' },
  { role: 'Admin / HR', email: 'admin@atomquest.local', password: 'Admin@123', note: 'Governance and reports' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: demos[0].email, password: demos[0].password });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function useDemo(demo) {
    setForm({ email: demo.email, password: demo.password });
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-intro">
          <div className="brand">
            <div className="brand-mark">AQ</div>
            <div>
              <strong>AtomQuest</strong>
              <span>Goal Setting & Tracking Portal</span>
            </div>
          </div>
          <h1>Role-based goal lifecycle cockpit</h1>
          <p>Use a demo profile to test employee submission, L1 approval, quarterly check-ins, admin governance, audit, and reporting.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            Email
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          {error ? <div className="inline-alert">{error}</div> : null}
          <button className="primary-button" disabled={loading}>
            <ShieldCheck size={18} />
            Sign in
          </button>
        </form>
      </section>

      <section className="demo-grid">
        {demos.map((demo) => (
          <button className="demo-tile" key={demo.email} onClick={() => useDemo(demo)}>
            <span>{demo.role}</span>
            <strong>{demo.email}</strong>
            <small>{demo.note}</small>
            <ArrowRight size={18} />
          </button>
        ))}
      </section>
    </main>
  );
}
