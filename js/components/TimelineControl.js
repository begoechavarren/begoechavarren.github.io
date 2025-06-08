const { useState, useEffect, useRef, useMemo } = React;

const TimelineControl = ({ data, onYearChange, selectedYear, isPlaying, onPlayToggle }) => {
    const [yearRange, setYearRange] = useState({ min: 1950, max: 2025 });
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const intervalRef = useRef();
    const sliderRef = useRef();

    useEffect(() => {
        if (data?.expeditions?.length > 0) {
            const years = data.expeditions.map(exp => exp.YEAR).filter(year => year > 0);
            const min = Math.min(...years);
            const max = Math.max(...years);
            setYearRange({ min, max });
            
            if (!selectedYear) {
                onYearChange(min);
            }
        }
    }, [data, selectedYear, onYearChange]);

    useEffect(() => {
        if (isPlaying && selectedYear && selectedYear < yearRange.max) {
            intervalRef.current = setInterval(() => {
                const nextYear = selectedYear + 1;
                if (nextYear > yearRange.max) {
                    onPlayToggle();
                } else {
                    onYearChange(nextYear);
                }
            }, 1000 / playbackSpeed);
        } else {
            clearInterval(intervalRef.current);
        }

        return () => clearInterval(intervalRef.current);
    }, [isPlaying, selectedYear, yearRange.max, playbackSpeed, onYearChange, onPlayToggle]);

    const yearMarkers = useMemo(() => {
        const markers = [];
        const startDecade = Math.floor(yearRange.min / 10) * 10;
        const endDecade = Math.ceil(yearRange.max / 10) * 10;
        
        for (let year = startDecade; year <= endDecade; year += 10) {
            if (year >= yearRange.min && year <= yearRange.max) {
                markers.push(year);
            }
        }
        return markers;
    }, [yearRange]);

    const currentYearStats = useMemo(() => {
        if (!data?.expeditions?.length || !selectedYear) return null;

        const yearExpeditions = data.expeditions.filter(exp => exp.YEAR === selectedYear);
        const totalExpeditions = yearExpeditions.length;
        const successfulExpeditions = yearExpeditions.filter(exp => exp.SUCCESS).length;
        const deaths = yearExpeditions.reduce((sum, exp) => sum + exp.DEATHS, 0);

        return {
            totalExpeditions,
            successfulExpeditions,
            deaths,
            successRate: totalExpeditions > 0 ? (successfulExpeditions / totalExpeditions) * 100 : 0
        };
    }, [data, selectedYear]);

    const handleSliderChange = (event) => {
        const year = parseInt(event.target.value);
        onYearChange(year);
    };

    const handleSpeedChange = (speed) => {
        setPlaybackSpeed(speed);
    };

    const jumpToYear = (year) => {
        onYearChange(year);
    };

    const getYearPosition = (year) => {
        const range = yearRange.max - yearRange.min;
        return ((year - yearRange.min) / range) * 100;
    };

    return (
        <div className="timeline-container border-t border-slate-600 p-4 bg-slate-800 min-h-[8rem]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => jumpToYear(yearRange.min)}
                        className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                        title="Jump to start"
                    >
                        ⏮️
                    </button>
                    
                    <button
                        onClick={onPlayToggle}
                        className="p-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-lg"
                        title={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? '⏸️' : '▶️'}
                    </button>
                    
                    <button
                        onClick={() => jumpToYear(yearRange.max)}
                        className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                        title="Jump to end"
                    >
                        ⏭️
                    </button>
                </div>

                <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">{selectedYear || yearRange.min}</div>
                    {currentYearStats && (
                        <div className="text-sm text-slate-400">
                            {currentYearStats.totalExpeditions} expeditions • {currentYearStats.successRate.toFixed(0)}% success
                            {currentYearStats.deaths > 0 && ` • ${currentYearStats.deaths} deaths`}
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-400">Speed:</span>
                    {[0.5, 1, 2, 4].map(speed => (
                        <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={`px-3 py-1 rounded text-sm transition-colors ${
                                playbackSpeed === speed
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative mb-4">
                <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none">
                    {yearMarkers.map((year) => (
                        <div
                            key={year}
                            className="absolute w-0.5 h-6 bg-slate-500 opacity-60"
                            style={{ left: `${getYearPosition(year)}%` }}
                            title={`${year}`}
                        />
                    ))}
                </div>

                <div className="relative mt-6">
                    <input
                        ref={sliderRef}
                        type="range"
                        min={yearRange.min}
                        max={yearRange.max}
                        value={selectedYear || yearRange.min}
                        onChange={handleSliderChange}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer timeline-slider"
                        style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((selectedYear - yearRange.min) / (yearRange.max - yearRange.min)) * 100}%, #475569 ${((selectedYear - yearRange.min) / (yearRange.max - yearRange.min)) * 100}%, #475569 100%)`
                        }}
                    />
                    
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                        {yearMarkers.map((year) => (
                            <span 
                                key={year}
                                style={{ position: 'absolute', left: `${getYearPosition(year)}%`, transform: 'translateX(-50%)' }}
                            >
                                {year}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center">
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-400">Quick jump:</span>
                    {yearMarkers.map(year => (
                        <button
                            key={year}
                            onClick={() => jumpToYear(year)}
                            className={`px-2 py-1 rounded text-xs transition-colors ${
                                selectedYear === year
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </div>

            {isPlaying && (
                <div className="mt-4 p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Playing...</span>
                        <span className="text-slate-400">
                            {selectedYear} / {yearRange.max} 
                            ({Math.round(((selectedYear - yearRange.min) / (yearRange.max - yearRange.min)) * 100)}%)
                        </span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-1 mt-2">
                        <div 
                            className="bg-blue-500 h-1 rounded-full transition-all duration-1000"
                            style={{ width: `${((selectedYear - yearRange.min) / (yearRange.max - yearRange.min)) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            <style jsx>{`
                .timeline-slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid #ffffff;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                }
                
                .timeline-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid #ffffff;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                }
            `}</style>
        </div>
    );
}; 