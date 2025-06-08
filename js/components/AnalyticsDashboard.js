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

const AnalyticsDashboard = ({ data, statistics, selectedYear, filters }) => {
    const [activeTab, setActiveTab] = useState('overview');

    const metrics = useMemo(() => {
        if (!statistics || !data) return {};

        const expeditions = data.expeditions || [];
        const members = data.members || [];
        const peaks = data.peaks || [];

        const peakStats = peaks.map(peak => {
            const peakExpeditions = expeditions.filter(exp => exp.PEAKID === peak.PEAKID);
            const successfulExpeditions = peakExpeditions.filter(exp => exp.SUCCESS);
            const totalDeaths = peakExpeditions.reduce((sum, exp) => sum + exp.DEATHS, 0);
            
            return {
                peak: peak.PKNAME,
                height: peak.HEIGHTM,
                expeditions: peakExpeditions.length,
                successRate: peakExpeditions.length > 0 ? (successfulExpeditions.length / peakExpeditions.length) * 100 : 0,
                deaths: totalDeaths
            };
        }).sort((a, b) => b.expeditions - a.expeditions).slice(0, 10);

        const nationalityStats = _.chain(expeditions)
            .groupBy('NATION')
            .map((exps, nation) => ({
                nation: nation || 'Unknown',
                expeditions: exps.length,
                successRate: (exps.filter(e => e.SUCCESS).length / exps.length) * 100,
                deaths: exps.reduce((sum, exp) => sum + exp.DEATHS, 0)
            }))
            .orderBy('expeditions', 'desc')
            .take(10)
            .value();

        return {
            peakStats,
            nationalityStats
        };
    }, [data, statistics]);

    const renderOverviewTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="stats-card rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Total Expeditions</p>
                            <p className="text-2xl font-bold text-white">{statistics.totalExpeditions?.toLocaleString() || 0}</p>
                        </div>
                        <div className="text-blue-400 text-2xl">⛰️</div>
                    </div>
                </div>
                
                <div className="stats-card rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Success Rate</p>
                            <p className="text-2xl font-bold text-green-400">{statistics.successRate?.toFixed(1) || 0}%</p>
                        </div>
                        <div className="text-green-400 text-2xl">✓</div>
                    </div>
                </div>
                
                <div className="stats-card rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Total Deaths</p>
                            <p className="text-2xl font-bold text-red-400">{statistics.totalDeaths?.toLocaleString() || 0}</p>
                        </div>
                        <div className="text-red-400 text-2xl">💀</div>
                    </div>
                </div>
                
                <div className="stats-card rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Mortality Rate</p>
                            <p className="text-2xl font-bold text-red-400">{statistics.mortalityRate?.toFixed(2) || 0}%</p>
                        </div>
                        <div className="text-red-400 text-2xl">⚠️</div>
                    </div>
                </div>
            </div>

            <div className="stats-card rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Seasonal Breakdown</h3>
                <div className="space-y-3">
                    {statistics.seasonalStats?.map((season, index) => (
                        <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-slate-300">{getSeasonName(season.season)}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-white font-medium">{season.expeditions} expeditions</p>
                                <p className="text-sm text-slate-400">{season.successRate.toFixed(1)}% success</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="stats-card rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Oxygen Usage</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-400">Expeditions using oxygen</p>
                        <p className="text-xl font-bold text-cyan-400">{statistics.oxygenUsageRate?.toFixed(1) || 0}%</p>
                    </div>
                    <div className="text-cyan-400 text-2xl">🫁</div>
                </div>
            </div>
        </div>
    );

    const renderPeaksTab = () => (
        <div className="space-y-6">
            <div className="stats-card rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Most Popular Peaks</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {metrics.peakStats?.map((peak, index) => (
                        <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium">{peak.peak}</h4>
                                    <p className="text-sm text-slate-400">{peak.height.toLocaleString()}m</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-medium">{peak.expeditions} expeditions</p>
                                    <p className="text-sm text-green-400">{peak.successRate.toFixed(1)}% success</p>
                                    {peak.deaths > 0 && (
                                        <p className="text-sm text-red-400">{peak.deaths} deaths</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderTrendsTab = () => (
        <div className="space-y-6">
            <div className="stats-card rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Expedition Trends</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {statistics.yearlyStats?.slice(-15).map((year, index) => (
                        <div key={`year-${index}`} className="border-l-4 border-blue-500 pl-4 py-2">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium">{year.year}</h4>
                                    <p className="text-sm text-slate-400">Year Activity</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-medium">{year.expeditions} expeditions</p>
                                    <p className="text-sm text-green-400">{year.successRate.toFixed(1)}% success</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {metrics.nationalityStats?.slice(0, 8).map((nation, index) => (
                        <div key={`nation-${index}`} className="border-l-4 border-purple-500 pl-4 py-2">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium">{nation.nation}</h4>
                                    <p className="text-sm text-slate-400">Leading Nation</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-medium">{nation.expeditions} expeditions</p>
                                    <p className="text-sm text-green-400">{nation.successRate.toFixed(1)}% success</p>
                                    {nation.deaths > 0 && (
                                        <p className="text-sm text-red-400">{nation.deaths} deaths</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderDemographicsTab = () => {
        const totalMembers = data?.members?.length || 0;
        const genderStats = _.chain(data?.members || [])
            .groupBy('SEX')
            .map((members, gender) => ({
                gender: gender || 'Unknown',
                count: members.length,
                percentage: totalMembers > 0 ? (members.length / totalMembers) * 100 : 0,
                successRate: members.length > 0 ? (members.filter(m => m.MSUCCESS).length / members.length) * 100 : 0
            }))
            .orderBy('count', 'desc')
            .value();

        return (
            <div className="space-y-6">
                <div className="stats-card rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Total Members</p>
                            <p className="text-2xl font-bold text-white">{totalMembers.toLocaleString()}</p>
                        </div>
                        <div className="text-blue-400 text-2xl">#</div>
                    </div>
                </div>

                <div className="stats-card rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Gender Distribution</h3>
                    <div className="space-y-4">
                        {genderStats.map((stat, index) => (
                            <div key={index} className="border-l-4 border-cyan-500 pl-4 py-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-3 h-3 rounded-full ${stat.gender === 'M' ? 'bg-blue-500' : stat.gender === 'F' ? 'bg-pink-500' : 'bg-gray-500'}`}></div>
                                        <div>
                                            <h4 className="text-white font-medium">{stat.gender === 'M' ? 'Male' : stat.gender === 'F' ? 'Female' : 'Other'}</h4>
                                            <p className="text-sm text-slate-400">{stat.count.toLocaleString()} members</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-medium">{stat.percentage.toFixed(1)}%</p>
                                        <p className="text-sm text-green-400">{stat.successRate.toFixed(1)}% success</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: '📊' },
        { id: 'peaks', label: 'Peaks', icon: '⛰️' },
        { id: 'trends', label: 'Trends', icon: '📈' },
        { id: 'demographics', label: 'Demographics', icon: '👥' }
    ];

    return (
        <div className="h-full flex flex-col bg-slate-900/50">
            <div className="p-4 border-b border-slate-700">
                <h2 className="text-xl font-bold text-white mb-2">Analytics Dashboard</h2>
                {selectedYear && (
                    <p className="text-sm text-slate-400">Viewing data for {selectedYear}</p>
                )}
            </div>

            <div className="flex border-b border-slate-700">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <span className="mr-2">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'peaks' && renderPeaksTab()}
                {activeTab === 'trends' && renderTrendsTab()}
                {activeTab === 'demographics' && renderDemographicsTab()}
            </div>

            <div className="p-4 border-t border-slate-700 text-center">
                <p className="text-xs text-slate-500">
                    Data updated: {new Date().toLocaleDateString()}
                </p>
            </div>
        </div>
    );
}; 