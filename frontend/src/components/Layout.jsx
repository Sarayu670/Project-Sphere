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

