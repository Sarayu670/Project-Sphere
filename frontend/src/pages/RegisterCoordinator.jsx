import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const BRANCHES = ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const YEARS = ['2nd', '3rd', '4th'];

function RegisterCoordinator() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [section, setSection] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.toLowerCase().endsWith('@gmail.com') && !email.toLowerCase().endsWith('.ac.in')) {
      setError('Please use a valid @gmail.com or university (.ac.in) email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!branch || !section || !year) {
      setError('Please select Branch, Section, and Year for your coordinator assignment');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, 'guide', {
        department,
        isCoordinator: true,
        coordinatorBranch: branch,
        coordinatorSection: section,
        coordinatorYear: year
      });
      navigate('/coordinator');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '520px' }}>
        <Link to="/home" className="back-link">← Back to Home</Link>
        <div className="auth-header">
          <span className="auth-icon">🏫</span>
          <h1>G. Narayanamma Institute of Technology &amp; Science</h1>
          <p>Class Coordinator Registration</p>
          <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
            Section Coordinator Access
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g., Computer Science"
            />
          </div>

          {/* Section Assignment */}
          <div style={{
            background: 'var(--bg-subtle, #f7fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <p style={{ fontWeight: '600', color: 'var(--text)', marginBottom: '12px', fontSize: '14px' }}>
              📋 Assigned Section
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Branch</label>
                <select value={branch} onChange={(e) => setBranch(e.target.value)} required>
                  <option value="">Select</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Section</label>
                <select value={section} onChange={(e) => setSection(e.target.value)} required>
                  <option value="">Select</option>
                  {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Year</label>
                <select value={year} onChange={(e) => setYear(e.target.value)} required>
                  <option value="">Select</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            {branch && section && year && (
              <p style={{ marginTop: '10px', fontSize: '13px', color: '#38a169', fontWeight: '600' }}>
                ✓ You will coordinate: {branch} - Section {section} ({year} Year)
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                minLength={6}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex="-1">
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating Account...' : '🏫 Register as Coordinator'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Login</Link></p>
          <p>Register as <Link to="/register/guide">Guide</Link> · <Link to="/register/admin">Admin</Link></p>
        </div>
      </div>
    </div>
  );
}

export default RegisterCoordinator;
