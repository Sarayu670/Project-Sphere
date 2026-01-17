import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as api from '../services/api';
import GuideSearch from './admin/GuideSearch';
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
        <h2>Find Your Guide & Projects</h2>
        <p className="section-subtitle">Search for guides and view their assigned batches, students, and projects</p>

        <GuideSearch />
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
