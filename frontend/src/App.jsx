import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterGuide from './pages/RegisterGuide';
import RegisterAdmin from './pages/RegisterAdmin';
import StudentDashboard from './pages/student/StudentDashboard';
import GuideDashboard from './pages/guide/GuideDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import Layout from './components/Layout';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'white',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
      <Route path="/register/guide" element={!user ? <RegisterGuide /> : <Navigate to="/" />} />
      <Route path="/register/admin" element={!user ? <RegisterAdmin /> : <Navigate to="/" />} />
      
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
        {user?.role === 'student' && (
          <Route index element={<StudentDashboard />} />
        )}
        {user?.role === 'guide' && (
          <Route index element={<GuideDashboard />} />
        )}
        {user?.role === 'admin' && (
          <Route index element={<AdminDashboard />} />
        )}
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}

export default App;

