import React from 'react';
import { useNavigate } from 'react-router-dom';
import { achievementsData, achievementCategories } from '../data/achievementsData';
import './Achievements.css';

const Achievements = () => {
    const navigate = useNavigate();

    const handleCategoryClick = (categoryId) => {
        navigate(`/achievements/${categoryId}`);
    };

    return (
        <section className="achievements-section">
            <div className="achievements-background">
                <div className="floating-orb orb-1"></div>
                <div className="floating-orb orb-2"></div>
                <div className="floating-orb orb-3"></div>
            </div>

            <div className="achievements-container">
                <div className="achievements-header">
                    <h2 className="achievements-title">
                        <span className="title-icon">🏆</span>
                        <span className="title-text">Our Achievements</span>
                    </h2>
                    <p className="achievements-subtitle">
                        Celebrating excellence across research, innovation, and education
                    </p>
                </div>

                <div className="category-grid">
                    {achievementCategories.map((category, index) => {
                        const count = achievementsData[category.key]?.length || 0;
                        const categoryImage = category.categoryImage || '/achievements/placeholder.jpg';

                        return (
                            <div
                                key={category.id}
                                className="category-card"
                                onClick={() => handleCategoryClick(category.id)}
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="category-image-container">
                                    <img
                                        src={categoryImage}
                                        alt={category.label}
                                        className="category-image"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                    <div className="category-overlay"></div>
                                </div>

                                <div className="category-content">
                                    <div className="category-icon-wrapper">
                                        <span className="category-icon" style={{ background: category.gradient }}>
                                            {category.icon}
                                        </span>
                                    </div>

                                    <h3 className="category-title">{category.label}</h3>
                                    <p className="category-description">{category.description}</p>

                                    <div className="category-footer">
                                        <div className="category-count">
                                            <span className="count-number">{count}</span>
                                            <span className="count-label">{count === 1 ? 'Achievement' : 'Achievements'}</span>
                                        </div>
                                        <div className="category-arrow">
                                            <span>Explore</span>
                                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="category-shine"></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default Achievements;
