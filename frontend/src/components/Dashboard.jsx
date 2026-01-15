import './Dashboard.css';

const Dashboard = ({ voiceFeatures, personalityProfile, momentum, reason, isListening }) => {
    const formatValue = (value) => {
        return typeof value === 'number' ? value.toFixed(2) : '0.00';
    };

    const getFeatureColor = (key) => {
        const colors = {
            energy: '#00cc88',
            confidence: '#4facfe',
            stress: '#fa709a',
            tempo: '#fbbf24',
            clarity: '#a855f7'
        };
        return colors[key] || '#00cc88';
    };

    const getFeatureLabel = (key, value) => {
        const labels = {
            energy: { low: 'Lethargic', mid: 'Calm', high: 'Animated', vhigh: 'Hyper' },
            confidence: { low: 'Timid', mid: 'Hesitant', high: 'Assured', vhigh: 'Dominant' },
            stress: { low: 'Relaxed', mid: 'Neutral', high: 'Anxious', vhigh: 'Panicked' },
            tempo: { low: 'Dragging', mid: 'Measured', high: 'Brisk', vhigh: 'Frantic' },
            clarity: { low: 'Mumbled', mid: 'Unclear', high: 'Clear', vhigh: 'Crisp' }
        };
        const set = labels[key];
        if (!set) return '';
        if (value < 0.3) return set.low;
        if (value < 0.5) return set.mid;
        if (value < 0.7) return set.high;
        return set.vhigh;
    };

    return (
        <div className="dashboard">
            {/* Voice Features Grid - HIGHLIGHTED */}
            <div className="dashboard-section highlight-biomarkers">
                <h2 className="section-title">Vocal Biomarker Analysis</h2>
                <div className="features-grid">
                    {voiceFeatures ? Object.entries(voiceFeatures).map(([key, value]) => (
                        <div key={key} className="feature-card highlight-card">
                            <div className="feature-header">
                                <span className="feature-name high-impact">{key}</span>
                                <span className="feature-value">{formatValue(value)}</span>
                            </div>
                            <div className="feature-bar">
                                <div
                                    className="feature-bar-fill"
                                    style={{
                                        width: `${value * 100}%`,
                                        background: getFeatureColor(key)
                                    }}
                                />
                            </div>
                            <div className="feature-label high-contrast">
                                {getFeatureLabel(key, value)}
                            </div>
                        </div>
                    )) : (
                        <div className="placeholder-text">System standby... awaiting vocal biomarker stream</div>
                    )}
                </div>
            </div>

            {/* Momentum and Decision Layers Grouped */}
            <div className="analysis-group">
                {/* Momentum Indicators */}
                {momentum && (
                    <div className="dashboard-section momentum-section">
                        <h2 className="section-title">Momentum Trends</h2>
                        <div className="momentum-grid">
                            {Object.entries(momentum).map(([key, value]) => (
                                <div key={key} className="momentum-card">
                                    <div className="momentum-name">
                                        {key.replace('_trend', '').replace('_', ' ')}
                                    </div>
                                    <div className={`momentum-indicator ${value > 0.1 ? 'rising' : value < -0.1 ? 'falling' : 'stable'}`}>
                                        <span className="trend-icon">{value > 0.1 ? '▲' : value < -0.1 ? '▼' : '●'}</span>
                                        {value > 0.1 ? 'Rising' : value < -0.1 ? 'Falling' : 'Stable'}
                                    </div>
                                    <div className="momentum-value">
                                        {formatValue(value)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Personality Profile */}
                {personalityProfile && (
                    <div className="dashboard-section decision-section">
                        <h2 className="section-title">Transparent Decision Layers</h2>
                        <div className="personality-grid">
                            {Object.entries(personalityProfile).map(([layer, value]) => (
                                <div key={layer} className="personality-card active-layer">
                                    <div className="personality-layer">
                                        {layer.replace('_', ' ')}
                                    </div>
                                    <div className="personality-value highlighted-value">
                                        {value.replace(/_/g, ' ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {reason && (
                            <div className="personality-reason-box">
                                <div className="reason-label">DECISION RATIONALE:</div>
                                <div className="reason-text">{reason}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
