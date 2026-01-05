import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const YEARS = ['2nd', '3rd', '4th'];
const BRANCHES = ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [year, setYear] = useState('');
  const [branch, setBranch] = useState('');
  const [section, setSection] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!rollNumber) {
      setError('Please enter your roll number');
      return;
    }

    if (!year || !branch || !section) {
      setError('Please select year, branch, and section');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password, 'student', { rollNumber, year, branch, section });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">🎓</span>
          <h1>G. Narayanamma Institute of Technology & Science</h1>
          <p>Student Registration Portal</p>
          <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
            Mini Project Management System
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
            <label>Roll Number</label>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
              placeholder="e.g., 22A81A0X01"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label>Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} required>
                <option value="">Select</option>
                {YEARS.map(y => <option key={y} value={y}>{y} Year</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Branch</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value)} required>
                <option value="">Select</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Section</label>
              <select value={section} onChange={(e) => setSection(e.target.value)} required>
                <option value="">Select</option>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Login</Link></p>
          <p>Register as <Link to="/register/guide">Guide</Link> | <Link to="/register/admin">Admin</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Register;

