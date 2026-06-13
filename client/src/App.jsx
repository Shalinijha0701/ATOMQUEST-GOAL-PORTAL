import { useEffect, useState } from 'react';
import { downloadCsv, api } from './api/client.js';
import Layout from './components/Layout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ManagerDashboard from './pages/ManagerDashboard.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api('/meta/bootstrap')
      .then(setBootstrap)
      .catch((err) => setError(err.message));
  }, [user]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <LoginPage />;
  if (error) return <div className="loading">{error}</div>;
  if (!bootstrap) return <div className="loading">Preparing workspace...</div>;

  function exportReport() {
    const quarter = 'Q1';
    return downloadCsv(`/reports/achievements.csv?cycleId=${bootstrap.activeCycle.id}&quarter=${quarter}`, `achievement-report-${quarter}.csv`);
  }

  return (
    <Layout bootstrap={bootstrap} onExport={exportReport}>
      {user.role === 'admin' ? <AdminDashboard bootstrap={bootstrap} /> : null}
      {user.role === 'manager' ? <ManagerDashboard bootstrap={bootstrap} /> : null}
      {user.role === 'employee' ? <EmployeeDashboard bootstrap={bootstrap} /> : null}
    </Layout>
  );
}
