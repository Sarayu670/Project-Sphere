import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

function Layout() {
  const { user, logout } = useAuth();

  const getRoleColor = () => {
    switch (user?.role) {
      case 'admin': return '#e53e3e';
      case 'guide': return '#38a169';
      case 'student': return '#3182ce';
      default: return '#667eea';
    }
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">📚</span>
            <span className="logo-text">ProjectSphere</span>
          </div>
          <div className="user-info">
            <button onClick={() => window.location.href = '/home'} className="home-btn" style={{
              marginRight: '15px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-color)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}>
              🏠 Home
            </button>
            <span className="user-name">{user?.name}</span>
            <span className="user-role" style={{ background: getRoleColor() }}>
              {user?.role?.toUpperCase()}
            </span>
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;

