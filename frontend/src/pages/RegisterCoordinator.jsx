import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const BRANCHES = ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const YEARS = ['2nd', '3rd', '4th'];

function RegisterCoordinator() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', department: '',
    branch: 'CSE', section: 'A', year: '3rd'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => setForm(current => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.email.toLowerCase().endsWith('@gmail.com') && !form.email.toLowerCase().endsWith('.ac.in')) {
      setError('Please use a valid @gmail.com or university (.ac.in) email address');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(form.name, form.email, form.password, 'guide', {
        department: form.department,
        isCoordinator: true,
        coordinatorBranch: form.branch,
        coordinatorSection: form.section,
        coordinatorYear: form.year
      });
      navigate('/coordinator');
    } catch (err) {
      setError(err.response?.data?.message || 'Coordinator registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link to="/home" className="back-link">← Back to Home</Link>
        <div className="auth-header">
          <span className="auth-icon">🏫</span>
          <h1>G. Narayanamma Institute of Technology & Science</h1>
          <p>Class Coordinator Registration</p>
          <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
            One fixed year, branch, and section
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Full Name</label><input value={form.name} onChange={update('name')} required /></div>
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={update('email')} required /></div>
          <div className="form-group"><label>Department</label><input value={form.department} onChange={update('department')} placeholder="e.g., Computer Science" required /></div>
          <div className="form-group"><label>Branch</label><select value={form.branch} onChange={update('branch')}>{BRANCHES.map(branch => <option key={branch}>{branch}</option>)}</select></div>
          <div className="form-group"><label>Section</label><select value={form.section} onChange={update('section')}>{SECTIONS.map(section => <option key={section}>{section}</option>)}</select></div>
          <div className="form-group"><label>Year</label><select value={form.year} onChange={update('year')}>{YEARS.map(year => <option key={year} value={year}>{year} Year</option>)}</select></div>
          <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={update('password')} minLength={6} required /></div>
          <div className="form-group"><label>Confirm Password</label><input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} required /></div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register as Coordinator'}
          </button>
        </form>

        <div className="auth-footer">
          <p>An existing guide can use this form with their current email and password to enable coordinator access.</p>
          <p>Already have an account? <Link to="/login">Login</Link></p>
          <p>Register as <Link to="/register/guide">Guide</Link></p>
        </div>
      </div>
    </div>
  );
}

export default RegisterCoordinator;
