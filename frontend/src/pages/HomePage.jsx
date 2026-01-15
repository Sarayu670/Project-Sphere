import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as api from '../services/api';
import './HomePage.css';

const API_URL = '/api';

const HomePage = () => {
  const navigate = useNavigate();
  const [guides, setGuides] = useState([]);
  const [problems, setProblems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGuides, setFilteredGuides] = useState([]);
  const [filteredProblems, setFilteredProblems] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [guideBatches, setGuideBatches] = useState([]);
  const [searchType, setSearchType] = useState('guides'); // 'guides' or 'problems'
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [guidesRes, problemsRes, projectsRes] = await Promise.all([
        axios.get(`${API_URL}/guides`),
        axios.get(`${API_URL}/problems`),
        api.getAllProjects()
      ]);
      setGuides(guidesRes.data.data || []);
      setProblems(problemsRes.data.data || []);
      setProjects(projectsRes.data.data || []);
      setFilteredGuides(guidesRes.data.data || []);
      setFilteredProblems(problemsRes.data.data || []);
      setFilteredProjects(projectsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Debounced search function
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      performSearch(searchTerm);
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(delaySearch);
  }, [searchTerm]);

  const performSearch = async (value) => {
    setSelectedGuide(null);
    setGuideBatches([]);

    if (!value.trim()) {
      // Show all results if search is empty
      setFilteredGuides(guides);
      setFilteredProblems(problems);
      setFilteredBatches(batches);
      setFilteredProjects(projects);
      return;
    }

    setIsSearching(true);

    try {
      // Search guides, problems, batches, and projects
      const [guidesRes, problemsRes, batchesRes, projectsRes] = await Promise.all([
        api.searchGuides(value),
        api.searchProblems(value),
        api.searchBatches(value),
        api.searchProjects(value)
      ]);

      setFilteredGuides(guidesRes.data.data || []);
      setFilteredProblems(problemsRes.data.data || []);
      setFilteredBatches(batchesRes.data.data || []);
      setFilteredProjects(projectsRes.data.data || []);
    } catch (error) {
      console.error('Error during search:', error);
      // Fallback to local filtering
      setFilteredGuides(guides.filter(guide =>
        guide.name.toLowerCase().includes(value.toLowerCase())
      ));
      setFilteredProblems(problems.filter(problem =>
        problem.title.toLowerCase().includes(value.toLowerCase())
      ));
      setFilteredBatches(batches.filter(batch =>
        batch.teamName.toLowerCase().includes(value.toLowerCase()) ||
        batch.leaderStudentId?.name?.toLowerCase().includes(value.toLowerCase()) ||
        batch.guideId?.name?.toLowerCase().includes(value.toLowerCase())
      ));
      setFilteredProjects(projects.filter(project =>
        project.guideName.toLowerCase().includes(value.toLowerCase()) ||
        project.projectTitle.toLowerCase().includes(value.toLowerCase())
      ));
    } finally {
      setIsSearching(false);
    }
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
        <h2>Find Your Guide & Problems</h2>
        <p className="section-subtitle">Search for guides and problem statements</p>

        <div className="search-container">
          <input
            type="text"
            placeholder="Search by Guide Name or Project Title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            disabled={isSearching}
          />
          {isSearching && <span className="search-spinner">⏳</span>}
        </div>

        <div className="guide-content">
          {!selectedGuide ? (
            <>
              {/* Guides Section */}
              <div className="search-results-section">
                <h3>Guides ({filteredGuides.length})</h3>
                {filteredGuides.length > 0 ? (
                  <div className="guides-list">
                    {filteredGuides.map(guide => (
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
                    ))}
                  </div>
                ) : (
                  <div className="no-results">
                    <p>No guides found</p>
                  </div>
                )}
              </div>

              {/* Problems Section */}
              <div className="search-results-section">
                <h3>Problem Statements ({filteredProblems.length})</h3>
                {filteredProblems.length > 0 ? (
                  <div className="problems-list">
                    {filteredProblems.map(problem => (
                      <div key={problem._id} className="problem-card">
                        <div className="problem-header">
                          <h4>{problem.title}</h4>
                          <span className="coe-badge">{problem.coeId?.name || 'N/A'}</span>
                        </div>
                        <p className="problem-description">
                          {problem.description?.substring(0, 100)}
                          {problem.description && problem.description.length > 100 ? '...' : ''}
                        </p>
                        <div className="problem-meta">
                          <span className="year-badge">Year: {problem.targetYear}</span>
                          <span className="guide-name">Guide: {problem.guideId?.name || 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-results">
                    <p>No problem statements found</p>
                  </div>
                )}
              </div>

              {/* Batches Section */}
              <div className="search-results-section">
                <h3>Projects & Batches ({filteredBatches.length})</h3>
                {filteredBatches.length > 0 ? (
                  <div className="batches-list">
                    {filteredBatches.map(batch => (
                      <div key={batch._id} className="batch-card">
                        <div className="batch-header">
                          <h4>{batch.teamName}</h4>
                          <span className="status-badge">{batch.status}</span>
                        </div>
                        <div className="batch-details">
                          <p className="batch-info">
                            <strong>Leader:</strong> {batch.leaderStudentId?.name || 'N/A'}
                          </p>
                          <p className="batch-info">
                            <strong>Roll:</strong> {batch.leaderStudentId?.rollNumber || 'N/A'}
                          </p>
                          <p className="batch-info">
                            <strong>Guide:</strong> {batch.guideId?.name || 'N/A'}
                          </p>
                          {batch.teamMembers && batch.teamMembers.length > 0 && (
                            <p className="batch-info">
                              <strong>Team Members:</strong> {batch.teamMembers.length} students
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-results">
                    <p>No batches found</p>
                  </div>
                )}
              </div>

              {/* Projects Section - Excel Import Data */}
              <div className="search-results-section">
                <h3>Projects & Teams ({filteredProjects.length})</h3>
                {filteredProjects.length > 0 ? (
                  <div className="projects-list">
                    {filteredProjects.map(project => (
                      <div key={project._id} className="project-card">
                        <div className="project-header">
                          <h4>{project.teamName}</h4>
                          <span className="coe-badge">{project.coe}</span>
                        </div>
                        <div className="project-details">
                          <p className="project-info">
                            <strong>Project Title:</strong> {project.projectTitle}
                          </p>
                          <p className="project-info">
                            <strong>Guide:</strong> {project.guideName}
                          </p>
                          <p className="project-info">
                            <strong>Students:</strong> {project.students.join(', ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-results">
                    <p>No projects found</p>
                  </div>
                )}
              </div>

              {searchTerm && filteredGuides.length === 0 && filteredProblems.length === 0 && filteredBatches.length === 0 && filteredProjects.length === 0 && (
                <div className="no-results-message">
                  <p>No guides, problems, or batches found matching "{searchTerm}"</p>
                </div>
              )}
            </>
          ) : (
            <div className="guide-detail">
              <button className="back-btn" onClick={() => setSelectedGuide(null)}>
                ← Back to Search
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
