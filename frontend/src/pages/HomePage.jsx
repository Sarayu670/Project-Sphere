import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProjectDirectory from './ProjectDirectory';
import './HomePage.css';

const API_URL = '/api';

const HomePage = () => {
  const navigate = useNavigate();
  const [guides, setGuides] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGuides, setFilteredGuides] = useState([]);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [guideBatches, setGuideBatches] = useState([]);
  const [activeSection, setActiveSection] = useState('guides'); // 'guides' or 'projects'

  useEffect(() => {
    fetchGuides();
  }, []);

  const fetchGuides = async () => {
    try {
      const response = await axios.get(`${API_URL}/guides`);
      setGuides(response.data.data || []);
      setFilteredGuides(response.data.data || []);
    } catch (error) {
      console.error('Error fetching guides:', error);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    const filtered = guides.filter(guide =>
      guide.name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredGuides(filtered);
    setSelectedGuide(null);
    setGuideBatches([]);
  };

  const handleGuideSelect = async (guide) => {
    setSelectedGuide(guide);
    try {
      // Fetch batches for this guide
      const response = await axios.get(`${API_URL}/batches/guide/${guide._id}`);
      setGuideBatches(response.data.data || []);
    } catch (error) {
      console.error('Error fetching guide batches:', error);
      setGuideBatches([]);
    }
  };

  const toggleSection = (section) => {
    setActiveSection(section);
    setSelectedGuide(null);
    setGuideBatches([]);
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="logo">🚀 Project Sphere</h1>
            <p className="tagline">Collaborate. Create. Succeed.</p>
          </div>
          <div className="auth-buttons">
            <button className="btn btn-secondary" onClick={() => navigate('/login')}>
              Sign In
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/register')}>
              Get Started
            </button>
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <h2>Welcome to Project Sphere</h2>
          <p>A comprehensive platform for managing academic projects, connecting students with guides, and tracking progress in real-time.</p>
          <div className="hero-features">
            <div className="feature">
              <span className="feature-icon">📋</span>
              <h3>Problem Statements</h3>
              <p>Access curated problem statements from various domains</p>
            </div>
            <div className="feature">
              <span className="feature-icon">👥</span>
              <h3>Team Collaboration</h3>
              <p>Form teams and work together on projects</p>
            </div>
            <div className="feature">
              <span className="feature-icon">💬</span>
              <h3>Direct Communication</h3>
              <p>Chat with guides for real-time feedback</p>
            </div>
            <div className="feature">
              <span className="feature-icon">📊</span>
              <h3>Progress Tracking</h3>
              <p>Monitor timeline and submission progress</p>
            </div>
          </div>
        </div>
      </section>

      <section className="coe-section">
        <h2>Center of Excellence (COE)</h2>
        <p className="section-subtitle">We support projects across multiple domains</p>
        <div className="coe-grid">
          <div className="coe-card">
            <span className="coe-icon">🤖</span>
            <h3>Artificial Intelligence</h3>
            <p>Machine Learning, Deep Learning, NLP projects</p>
          </div>
          <div className="coe-card">
            <span className="coe-icon">☁️</span>
            <h3>Cloud Computing</h3>
            <p>AWS, Azure, and Infrastructure projects</p>
          </div>
          <div className="coe-card">
            <span className="coe-icon">📱</span>
            <h3>Mobile Development</h3>
            <p>iOS, Android, and Cross-platform apps</p>
          </div>
          <div className="coe-card">
            <span className="coe-icon">🔐</span>
            <h3>Cybersecurity</h3>
            <p>Security, Ethical Hacking projects</p>
          </div>
        </div>
      </section>

      <section className="guide-search-section">
        <h2>Explore Projects & Guides</h2>
        <p className="section-subtitle">Search for guides and projects from our database</p>
        
        <div className="section-tabs">
          <button 
            className={`section-tab ${activeSection === 'guides' ? 'active' : ''}`}
            onClick={() => { setActiveSection('guides'); setSelectedGuide(null); }}
          >
            👨‍🏫 Find Guides
          </button>
          <button 
            className={`section-tab ${activeSection === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveSection('projects')}
          >
            📚 Browse Projects
          </button>
        </div>

        {activeSection === 'guides' ? (
          <>
            <div className="search-container">
              <input
                type="text"
                placeholder="Search guide name..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="guide-content">
              {!selectedGuide ? (
                <div className="guides-list">
                  {filteredGuides.length > 0 ? (
                    filteredGuides.map(guide => (
                      <div
                        key={guide._id}
                        className="guide-card"
                        onClick={() => handleGuideSelect(guide)}
                      >
                        <div className="guide-avatar">👨‍🏫</div>
                        <div className="guide-info">
                          <h3>{guide.name}</h3>
                          <p className="guide-email">{guide.email}</p>
                          <p className="guide-batches">
                            {guide.assignedBatches || 0} / {guide.maxBatches || 3} teams
                          </p>
                        </div>
                        <div className="guide-action">
                          View Projects →
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-results">
                      <p>No guides found matching "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="guide-detail">
                  <button className="back-btn" onClick={() => setSelectedGuide(null)}>
                    ← Back to Guides
                  </button>
                  <div className="guide-detail-header">
                    <div className="guide-avatar-large">👨‍🏫</div>
                    <div className="guide-detail-info">
                      <h2>{selectedGuide.name}</h2>
                      <p>{selectedGuide.email}</p>
                      <p className="capacity">
                        Teams: {selectedGuide.assignedBatches || 0} / {selectedGuide.maxBatches || 3}
                      </p>
                    </div>
                  </div>

                  <h3>Projects Assigned to This Guide</h3>
                  {guideBatches.length > 0 ? (
                    <div className="batches-grid">
                      {guideBatches.map(batch => (
                        <div key={batch._id} className="batch-preview">
                          <h4>{batch.teamName}</h4>
                          <p><strong>Year:</strong> {batch.year}</p>
                          <p><strong>Status:</strong> {batch.status}</p>
                          {batch.problemId && (
                            <div className="problem-info">
                              <p><strong>Project:</strong> {batch.problemId.title}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-batches">
                      <p>No projects assigned yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <ProjectDirectory />
        )}
      </section>

      <section className="cta-section">
        <h2>Ready to Start Your Project Journey?</h2>
        <p>Join thousands of students collaborating on real-world projects</p>
        <div className="cta-buttons">
          <button className="btn btn-primary btn-large" onClick={() => navigate('/register')}>
            Create Account
          </button>
          <button className="btn btn-secondary btn-large" onClick={() => navigate('/login')}>
            Sign In to Your Account
          </button>
        </div>
      </section>

      <footer className="home-footer">
        <p>&copy; 2026 Project Sphere. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;
