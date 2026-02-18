import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { achievementsData, achievementCategories } from '../data/achievementsData';
import AchievementDetailModal from '../components/AchievementDetailModal';
import './AchievementCategory.css';

const AchievementCategory = () => {
    const { category } = useParams();
    const navigate = useNavigate();
    const [selectedAchievement, setSelectedAchievement] = useState(null);

    const categoryInfo = achievementCategories.find(cat => cat.id === category);
    const achievements = categoryInfo ? achievementsData[categoryInfo.key] : [];

    if (!categoryInfo) {
        return (
            <div className="category-not-found">
                <h2>Category Not Found</h2>
                <button className="btn btn-primary" onClick={() => navigate('/home')}>
                    Back to Home
                </button>
            </div>
        );
    }

    const handleAchievementClick = (achievement) => {
        setSelectedAchievement(achievement);
    };

    const handleCloseModal = () => {
        setSelectedAchievement(null);
    };

    return (
        <div className="achievement-category-page">
            {/* Hero Header */}
            <div className="category-hero" style={{ background: categoryInfo.gradient }}>
                <div className="hero-content">
                    <div className="breadcrumb">
                        <span onClick={() => navigate('/home')} className="breadcrumb-link">Home</span>
                        <span className="breadcrumb-separator">/</span>
                        <span onClick={() => navigate('/home#achievements')} className="breadcrumb-link">Achievements</span>
                        <span className="breadcrumb-separator">/</span>
                        <span className="breadcrumb-current">{categoryInfo.label}</span>
                    </div>

                    <div className="hero-title-section">
                        <span className="hero-icon">{categoryInfo.icon}</span>
                        <h1 className="hero-title">{categoryInfo.label}</h1>
                    </div>

                    <p className="hero-description">{categoryInfo.description}</p>

                    <div className="hero-stats">
                        <div className="stat-item">
                            <span className="stat-number">{achievements.length}</span>
                            <span className="stat-label">{achievements.length === 1 ? 'Achievement' : 'Achievements'}</span>
                        </div>
                    </div>
                </div>

                <div className="hero-wave">
                    <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="white" />
                    </svg>
                </div>
            </div>

            {/* Achievements Grid */}
            <div className="achievements-grid-container">
                <div className="achievements-grid">
                    {achievements.map((achievement, index) => (
                        <div
                            key={achievement.id}
                            className="achievement-card"
                            style={{ animationDelay: `${index * 0.1}s` }}
                            onClick={() => handleAchievementClick(achievement)}
                        >
                            <div className="achievement-image-wrapper">
                                <img
                                    src={achievement.images[0]}
                                    alt={achievement.title}
                                    className="achievement-image"
                                    onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/400x300?text=Achievement';
                                    }}
                                />
                                <div className="achievement-image-overlay">
                                    <button className="view-details-btn">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                            <path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="white" strokeWidth="2" />
                                            <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="white" strokeWidth="2" />
                                        </svg>
                                        <span>View Details</span>
                                    </button>
                                </div>
                            </div>

                            <div className="achievement-card-content">
                                <h3 className="achievement-card-title">{achievement.title}</h3>

                                <div className="achievement-meta-info">
                                    {achievement.date && (
                                        <span className="meta-badge">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M4 0a1 1 0 0 0-1 1v1H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-1V1a1 1 0 1 0-2 0v1H5V1a1 1 0 0 0-1-1z" />
                                            </svg>
                                            {achievement.date || achievement.year}
                                        </span>
                                    )}

                                    {achievement.status && (
                                        <span className="meta-badge status-badge">{achievement.status}</span>
                                    )}

                                    {achievement.coe && (
                                        <span className="meta-badge coe-badge">{achievement.coe}</span>
                                    )}
                                </div>

                                <p className="achievement-card-description">{achievement.description}</p>

                                {achievement.images && achievement.images.length > 1 && (
                                    <div className="image-count-badge">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2z" />
                                            <path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.236.236 0 0 1 .02-.022z" fill="white" />
                                        </svg>
                                        {achievement.images.length} images
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {achievements.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">{categoryInfo.icon}</div>
                        <h3>No Achievements Yet</h3>
                        <p>Check back later for updates in this category</p>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedAchievement && (
                <AchievementDetailModal
                    achievement={selectedAchievement}
                    category={categoryInfo}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default AchievementCategory;
