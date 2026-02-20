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
            <header className="category-hero" style={{
                '--hero-bg': categoryInfo.gradient,
                '--hero-img': `url(${categoryInfo.categoryImage})`
            }}>
                <div className="hero-content-wrapper">
                    <div className="hero-main-info">
                        <div className="breadcrumb">
                            <span onClick={() => navigate('/home')} className="breadcrumb-link">Home</span>
                            <span className="breadcrumb-separator">/</span>
                            <span onClick={() => navigate('/home#achievements')} className="breadcrumb-link">Achievements</span>
                            <span className="breadcrumb-separator">/</span>
                            <span className="breadcrumb-current">{categoryInfo.label}</span>
                        </div>

                        <div className="hero-title-group">
                            <span className="hero-icon-large">{categoryInfo.icon}</span>
                            <div className="hero-text">
                                <h1 className="hero-title-main">{categoryInfo.label}</h1>
                                <p className="hero-tagline">{categoryInfo.description}</p>
                            </div>
                        </div>
                    </div>

                    <div className="hero-stats-panel">
                        <div className="stat-box">
                            <span className="stat-value">{achievements.length}</span>
                            <span className="stat-label-large">{achievements.length === 1 ? 'Achievement' : 'Achievements'}</span>
                        </div>
                        <div className="hero-status-pill">
                            <span className="status-dot"></span>
                            Active Category
                        </div>
                    </div>
                </div>

                <div className="hero-overlay-refined"></div>

                <div className="hero-wave-refined">
                    <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="white" />
                    </svg>
                </div>
            </header>

            {/* Achievements List */}
            <div className="achievements-list-container">
                <div className="achievements-list">
                    {achievements.map((achievement, index) => (
                        <div
                            key={achievement.id}
                            className="achievement-list-item"
                            style={{ animationDelay: `${index * 0.05}s` }}
                            onClick={() => handleAchievementClick(achievement)}
                        >
                            <div className="item-main-content">
                                <div className="item-meta">
                                    {achievement.date && (
                                        <span className="item-date">{achievement.date || achievement.year}</span>
                                    )}
                                    {achievement.status && (
                                        <span className="item-status">
                                            <span className="status-dot"></span>
                                            {achievement.status}
                                        </span>
                                    )}
                                </div>
                                <h3 className="item-title">{achievement.title}</h3>
                                {achievement.description && (
                                    <p className="item-description">{achievement.description}</p>
                                )}

                                <div className="item-footer">
                                    <button className="view-details-link">
                                        <span>Read more</span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="7" y1="17" x2="17" y2="7"></line>
                                            <polyline points="7 7 17 7 17 17"></polyline>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {achievement.images && achievement.images[0] && (
                                <div className="item-image-preview">
                                    <img
                                        src={achievement.images[0]}
                                        alt={achievement.title}
                                        className="preview-img"
                                        onError={(e) => {
                                            e.target.parentElement.style.display = 'none';
                                        }}
                                    />
                                    <div className="image-overlay-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                            <path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" />
                                            <path d="M2.45825 12C3.73228 7.94288 7.52281 5 12 5C16.4772 5 20.2677 7.94288 21.5417 12C20.2677 16.0571 16.4772 19 12 19C7.52281 19 3.73228 16.0571 2.45825 12Z" />
                                        </svg>
                                    </div>
                                </div>
                            )}
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
