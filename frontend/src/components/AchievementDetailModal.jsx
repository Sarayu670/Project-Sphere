import React, { useState, useEffect } from 'react';
import './AchievementDetailModal.css';

const AchievementDetailModal = ({ achievement, category, onClose }) => {
    // Handle ESC key to close modal
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button className="modal-close-btn" onClick={onClose} aria-label="Close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>

                {/* Modal Content */}
                <div className="modal-content">
                    {/* Details Section */}
                    <div className="modal-details-section">
                        <div>
                            <div className="details-header">
                                <div className="category-badge" style={{ background: category.gradient }}>
                                    <span className="badge-icon">{category.icon}</span>
                                    <span className="badge-label">{category.label}</span>
                                </div>
                            </div>

                            <h2 className="modal-title">{achievement.title}</h2>

                            <div className="modal-meta-grid">
                                {achievement.date && (
                                    <div className="meta-item">
                                        <span className="meta-icon">📅</span>
                                        <div>
                                            <span className="meta-label">Date</span>
                                            <span className="meta-value">{achievement.date || achievement.year}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.authors && (
                                    <div className="meta-item">
                                        <span className="meta-icon">👥</span>
                                        <div>
                                            <span className="meta-label">Authors</span>
                                            <span className="meta-value">{achievement.authors}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.venue && (
                                    <div className="meta-item">
                                        <span className="meta-icon">📍</span>
                                        <div>
                                            <span className="meta-label">Venue</span>
                                            <span className="meta-value">{achievement.venue}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.inventors && (
                                    <div className="meta-item">
                                        <span className="meta-icon">💡</span>
                                        <div>
                                            <span className="meta-label">Inventors</span>
                                            <span className="meta-value">{achievement.inventors}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.status && (
                                    <div className="meta-item">
                                        <span className="meta-icon">✓</span>
                                        <div>
                                            <span className="meta-label">Status</span>
                                            <span className="meta-value status-value">{achievement.status}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.institution && (
                                    <div className="meta-item">
                                        <span className="meta-icon">🏛️</span>
                                        <div>
                                            <span className="meta-label">Institution</span>
                                            <span className="meta-value">{achievement.institution}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.fundingAgency && (
                                    <div className="meta-item">
                                        <span className="meta-icon">💰</span>
                                        <div>
                                            <span className="meta-label">Funding Agency</span>
                                            <span className="meta-value">{achievement.fundingAgency}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.principalInvestigators && (
                                    <div className="meta-item">
                                        <span className="meta-icon">🔬</span>
                                        <div>
                                            <span className="meta-label">Principal Investigators</span>
                                            <span className="meta-value">{achievement.principalInvestigators}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.duration && (
                                    <div className="meta-item">
                                        <span className="meta-icon">⏱️</span>
                                        <div>
                                            <span className="meta-label">Duration</span>
                                            <span className="meta-value">{achievement.duration}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.amount && (
                                    <div className="meta-item">
                                        <span className="meta-icon">💵</span>
                                        <div>
                                            <span className="meta-label">Amount</span>
                                            <span className="meta-value">{achievement.amount}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.recipient && (
                                    <div className="meta-item">
                                        <span className="meta-icon">🏆</span>
                                        <div>
                                            <span className="meta-label">Recipient</span>
                                            <span className="meta-value">{achievement.recipient}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.students && achievement.students.length > 0 && (
                                    <div className="meta-item students-item">
                                        <span className="meta-icon">👨‍🎓</span>
                                        <div>
                                            <span className="meta-label">Student Team Members</span>
                                            <div className="students-list">
                                                {achievement.students.map((student, idx) => (
                                                    <span key={idx} className="student-name">{student}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {achievement.organization && (
                                    <div className="meta-item">
                                        <span className="meta-icon">🏢</span>
                                        <div>
                                            <span className="meta-label">Organization</span>
                                            <span className="meta-value">{achievement.organization}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.participants && (
                                    <div className="meta-item">
                                        <span className="meta-icon">👨‍🎓</span>
                                        <div>
                                            <span className="meta-label">Participants</span>
                                            <span className="meta-value">{achievement.participants}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.venue && category.id === 'workshops' && (
                                    <div className="meta-item">
                                        <span className="meta-icon">📍</span>
                                        <div>
                                            <span className="meta-label">Venue</span>
                                            <span className="meta-value">{achievement.venue}</span>
                                        </div>
                                    </div>
                                )}

                                {achievement.coe && (
                                    <div className="meta-item">
                                        <span className="meta-icon">🎯</span>
                                        <div>
                                            <span className="meta-label">COE</span>
                                            <span className="meta-value">{achievement.coe}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="description-section">
                                <h3 className="section-title">Description</h3>
                                <p className="description-text">{achievement.description}</p>
                            </div>

                            {achievement.details && (
                                <div className="additional-details">
                                    {achievement.details.abstract && (
                                        <div className="detail-block">
                                            <h4 className="detail-title">Abstract</h4>
                                            <p className="detail-text">{achievement.details.abstract}</p>
                                        </div>
                                    )}

                                    {achievement.details.objectives && (
                                        <div className="detail-block">
                                            <h4 className="detail-title">Objectives</h4>
                                            <ul className="detail-list">
                                                {achievement.details.objectives.map((obj, idx) => (
                                                    <li key={idx}>{obj}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {achievement.details.outcomes && (
                                        <div className="detail-block">
                                            <h4 className="detail-title">Outcomes</h4>
                                            <ul className="detail-list">
                                                {achievement.details.outcomes.map((outcome, idx) => (
                                                    <li key={idx}>{outcome}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {achievement.details.topics && (
                                        <div className="detail-block">
                                            <h4 className="detail-title">Topics Covered</h4>
                                            <ul className="detail-list">
                                                {achievement.details.topics.map((topic, idx) => (
                                                    <li key={idx}>{topic}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {achievement.details.keywords && (
                                        <div className="detail-block">
                                            <h4 className="detail-title">Keywords</h4>
                                            <div className="keywords-container">
                                                {achievement.details.keywords.map((keyword, idx) => (
                                                    <span key={idx} className="keyword-tag">{keyword}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {achievement.details.collaborators && (
                                        <div className="detail-block">
                                            <h4 className="detail-title">Collaborators</h4>
                                            <ul className="detail-list">
                                                {achievement.details.collaborators.map((collab, idx) => (
                                                    <li key={idx}>{collab}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AchievementDetailModal;
