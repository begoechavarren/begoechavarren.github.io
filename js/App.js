const { useState, useEffect, useCallback } = React;

const getSeasonName = (seasonNumber) => {
    const seasonMap = {
        '1': 'Winter (Dec-Feb)',
        '2': 'Summer/Monsoon (Jun-Aug)', 
        '3': 'Autumn (Sep-Nov)',
        '4': 'Spring (Mar-May)'
    };
    return seasonMap[seasonNumber] || `Season ${seasonNumber}`;
};

const App = () => {
    const [appData, setAppData] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [filters, setFilters] = useState({
        peakId: null,
        season: null,
        nation: null,
        successOnly: false,
        heightRange: [0, 9000],
        teamSizeRange: [1, 50]
    });
    const [selectedPeak, setSelectedPeak] = useState(null);
    const [selectedExpedition, setSelectedExpedition] = useState(null);

    const handleDataLoaded = useCallback((loadedData) => {
        setAppData(loadedData);
        
        if (loadedData.data?.expeditions?.length > 0 && !selectedYear) {
            const years = loadedData.data.expeditions.map(exp => exp.YEAR).filter(year => year > 0);
            const minYear = Math.min(...years);
            setSelectedYear(minYear);
        }
    }, [selectedYear]);

    const handleYearChange = useCallback((year) => {
        setSelectedYear(year);
    }, []);

    const handlePlayToggle = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const handleFiltersChange = useCallback((newFilters) => {
        setFilters(newFilters);
    }, []);

    const handlePanelToggle = useCallback(() => {
        setIsPanelCollapsed(prev => !prev);
    }, []);

    const handlePeakClick = useCallback((peak) => {
        setSelectedPeak(peak);
        setFilters(prev => ({ ...prev, peakId: peak.PEAKID }));
    }, []);

    const handleExpeditionClick = useCallback((expedition, peak) => {
        setSelectedExpedition({ expedition, peak });
    }, []);

    useEffect(() => {
        const handleKeyPress = (event) => {
            switch (event.key) {
                case ' ':
                    event.preventDefault();
                    handlePlayToggle();
                    break;
                case 'ArrowLeft':
                    if (selectedYear && appData) {
                        const years = appData.rawData.expeditions.map(exp => exp.YEAR).filter(year => year > 0);
                        const minYear = Math.min(...years);
                        if (selectedYear > minYear) {
                            setSelectedYear(selectedYear - 1);
                        }
                    }
                    break;
                case 'ArrowRight':
                    if (selectedYear && appData) {
                        const years = appData.rawData.expeditions.map(exp => exp.YEAR).filter(year => year > 0);
                        const maxYear = Math.max(...years);
                        if (selectedYear < maxYear) {
                            setSelectedYear(selectedYear + 1);
                        }
                    }
                    break;
                case 'Escape':
                    setSelectedPeak(null);
                    setSelectedExpedition(null);
                    break;
                case 'f':
                    handlePanelToggle();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedYear, appData, handlePlayToggle, handlePanelToggle]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsPanelCollapsed(true);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="h-screen flex flex-col bg-slate-900 text-white">
            <DataProcessor
                onDataLoaded={handleDataLoaded}
                selectedYear={selectedYear}
                filters={filters}
            />

            <div className="flex-1 flex">
                <div className="flex-1 relative">
                    {appData && (
                        <ThreeVisualization
                            data={appData.data}
                            statistics={appData.statistics}
                            selectedYear={selectedYear}
                            onPeakClick={handlePeakClick}
                            onExpeditionClick={handleExpeditionClick}
                        />
                    )}
                    
                    {appData && (
                        <ControlPanel
                            data={appData.data}
                            filters={filters}
                            onFiltersChange={handleFiltersChange}
                            isCollapsed={isPanelCollapsed}
                            onToggle={handlePanelToggle}
                        />
                    )}

                    {!appData && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="loading-spinner w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-slate-400">Loading 3D visualization...</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-96 border-l border-slate-700 hidden lg:block">
                    {appData ? (
                        <AnalyticsDashboard
                            data={appData.data}
                            statistics={appData.statistics}
                            selectedYear={selectedYear}
                            filters={filters}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="loading-spinner w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-slate-400">Loading analytics...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-slate-700">
                {appData ? (
                    <TimelineControl
                        data={appData.rawData}
                        selectedYear={selectedYear}
                        onYearChange={handleYearChange}
                        isPlaying={isPlaying}
                        onPlayToggle={handlePlayToggle}
                    />
                ) : (
                    <div className="h-32 flex items-center justify-center">
                        <div className="text-center">
                            <div className="loading-spinner w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                            <p className="text-sm text-slate-400">Loading timeline...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Expedition Details Modal */}
            {selectedExpedition && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-white">
                                Expedition to {selectedExpedition.peak.PKNAME}
                            </h2>
                            <button
                                onClick={() => setSelectedExpedition(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-slate-400">Year</p>
                                    <p className="text-white font-medium">{selectedExpedition.expedition.YEAR}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Season</p>
                                    <p className="text-white font-medium">{getSeasonName(selectedExpedition.expedition.SEASON) || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Nation</p>
                                    <p className="text-white font-medium">{selectedExpedition.expedition.NATION || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Team Size</p>
                                    <p className="text-white font-medium">{selectedExpedition.expedition.TOTMEMBERS} members</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Success</p>
                                    <p className={`font-medium ${selectedExpedition.expedition.SUCCESS ? 'text-green-400' : 'text-red-400'}`}>
                                        {selectedExpedition.expedition.SUCCESS ? 'Successful' : 'Failed'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Oxygen Used</p>
                                    <p className="text-white font-medium">{selectedExpedition.expedition.O2USED ? 'Yes' : 'No'}</p>
                                </div>
                            </div>
                            
                            {selectedExpedition.expedition.DEATHS > 0 && (
                                <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3">
                                    <p className="text-red-400 font-medium">⚠️ {selectedExpedition.expedition.DEATHS} fatalities occurred</p>
                                </div>
                            )}
                            
                            <div>
                                <p className="text-slate-400 mb-2">Peak Information</p>
                                <div className="bg-slate-700 rounded-lg p-3">
                                    <p className="text-white font-medium">{selectedExpedition.peak.PKNAME}</p>
                                    <p className="text-slate-300">{selectedExpedition.peak.HEIGHTM.toLocaleString()}m</p>
                                    <p className="text-slate-400 text-sm">{selectedExpedition.peak.LOCATION}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Overlay */}
            <div className="absolute bottom-20 right-4 text-xs text-slate-500 bg-slate-800 bg-opacity-80 rounded-lg p-2 hidden lg:block">

            </div>

            {/* Mobile Warning */}
            <div className="lg:hidden fixed inset-0 bg-slate-900 flex items-center justify-center z-40">
                <div className="text-center p-6">
                    <h2 className="text-xl font-bold text-white mb-4">📱 Mobile View</h2>
                    <p className="text-slate-400 mb-4">
                        This application is optimized for desktop viewing. 
                        Some features may be limited on mobile devices.
                    </p>
                    <button
                        onClick={() => document.querySelector('.lg\\:hidden').style.display = 'none'}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                    >
                        Continue Anyway
                    </button>
                </div>
            </div>
        </div>
    );
};

// Render the application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App)); 