const { useState, useEffect, useMemo } = React;

const getSeasonName = (seasonNumber) => {
    const seasonMap = {
        '1': 'Winter (Dec-Feb)',
        '2': 'Summer/Monsoon (Jun-Aug)', 
        '3': 'Autumn (Sep-Nov)',
        '4': 'Spring (Mar-May)'
    };
    return seasonMap[seasonNumber] || `Season ${seasonNumber}`;
};

const ControlPanel = ({ data, filters, onFiltersChange, isCollapsed, onToggle }) => {
    const [localFilters, setLocalFilters] = useState(filters);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    const filterOptions = useMemo(() => {
        if (!data) return { peaks: [], seasons: [], nations: [] };

        const peaks = data.peaks?.map(peak => ({
            id: peak.PEAKID,
            name: peak.PKNAME,
            height: peak.HEIGHTM
        })).sort((a, b) => b.height - a.height) || [];

        const seasons = [...new Set(data.expeditions?.map(exp => exp.SEASON).filter(Boolean) || [])];
        
        const nations = [...new Set(data.expeditions?.map(exp => exp.NATION).filter(Boolean) || [])]
            .sort()
            .slice(0, 50);

        return { peaks, seasons, nations };
    }, [data]);

    const filteredPeaks = useMemo(() => {
        if (!searchTerm) return filterOptions.peaks.slice(0, 20);
        
        return filterOptions.peaks.filter(peak =>
            peak.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10);
    }, [filterOptions.peaks, searchTerm]);

    const handleFilterChange = (key, value) => {
        const newFilters = { ...localFilters, [key]: value };
        setLocalFilters(newFilters);
        onFiltersChange(newFilters);
    };

    const clearFilters = () => {
        const clearedFilters = {
            peakId: null,
            season: null,
            nation: null,
            successOnly: false,
            heightRange: [0, 9000],
            teamSizeRange: [1, 50]
        };
        setLocalFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (localFilters.peakId) count++;
        if (localFilters.season) count++;
        if (localFilters.nation) count++;
        if (localFilters.successOnly) count++;
        return count;
    };

    if (isCollapsed) {
        return (
            <div className="absolute top-4 right-4 z-10">
                <button
                    onClick={onToggle}
                    className="control-panel rounded-lg p-3 text-white hover:bg-slate-700 transition-colors"
                    title="Open control panel"
                >
                    <div className="flex items-center space-x-2">
                        <span>⚙️</span>
                        {getActiveFilterCount() > 0 && (
                            <div className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {getActiveFilterCount()}
                            </div>
                        )}
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="absolute top-4 right-4 z-10 w-80 max-h-[80vh] overflow-y-auto">
            <div className="control-panel rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Filters & Controls</h3>
                    <div className="flex items-center space-x-2">
                        {getActiveFilterCount() > 0 && (
                            <div className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {getActiveFilterCount()}
                            </div>
                        )}
                        <button
                            onClick={onToggle}
                            className="text-slate-400 hover:text-white"
                            title="Close panel"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Peak Filter
                        </label>
                        <select
                            value={localFilters.peakId || ''}
                            onChange={(e) => handleFilterChange('peakId', e.target.value || null)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All peaks</option>
                            {filteredPeaks.map(peak => (
                                <option key={peak.id} value={peak.id}>
                                    {peak.name} ({peak.height}m)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Season
                        </label>
                        <select
                            value={localFilters.season || ''}
                            onChange={(e) => handleFilterChange('season', e.target.value || null)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All seasons</option>
                            {filterOptions.seasons.map(season => (
                                <option key={season} value={season}>
                                    {getSeasonName(season)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Expedition Nation
                        </label>
                        <select
                            value={localFilters.nation || ''}
                            onChange={(e) => handleFilterChange('nation', e.target.value || null)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All nations</option>
                            {filterOptions.nations.map(nation => (
                                <option key={nation} value={nation}>
                                    {nation}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center space-x-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={localFilters.successOnly || false}
                                onChange={(e) => handleFilterChange('successOnly', e.target.checked)}
                                className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                            />
                            <span>Show only successful expeditions</span>
                        </label>
                    </div>

                    {getActiveFilterCount() > 0 && (
                        <button
                            onClick={clearFilters}
                            className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                            Clear All Filters ({getActiveFilterCount()})
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}; 