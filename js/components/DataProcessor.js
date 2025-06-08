const { useState, useEffect, useMemo } = React;

const DataProcessor = ({ onDataLoaded, selectedYear, filters }) => {
    const [rawData, setRawData] = useState({
        expeditions: [],
        members: [],
        peaks: [],
        references: [],
        coordinates: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        try {
            setIsLoading(true);
            setLoadingProgress(0);
            setError(null);

            try {
                const [expeditionsResponse, peaksResponse, statsResponse, membersResponse] = await Promise.all([
                    fetch('./data/expeditions_processed.json'),
                    fetch('./data/peaks_processed.json'),
                    fetch('./data/summary_stats.json'),
                    fetch('./data/members_processed.json')
                ]);

                if (expeditionsResponse.ok && peaksResponse.ok && statsResponse.ok && membersResponse.ok) {
                    const [expeditions, peaks, stats, members] = await Promise.all([
                        expeditionsResponse.json(),
                        peaksResponse.json(), 
                        statsResponse.json(),
                        membersResponse.json()
                    ]);

                    setLoadingProgress(100);

                    const processedData = {
                        expeditions: expeditions,
                        members: members,
                        peaks: peaks,
                        references: [],
                        coordinates: [],
                        stats: stats
                    };

                    setRawData(processedData);
                    setIsLoading(false);
                    return;
                }
            } catch (jsonError) {
                console.warn('JSON loading failed, trying CSV:', jsonError);
            }

            await loadCSVData();

        } catch (err) {
            console.error('Data loading error:', err);
            setError(err.message);
            setIsLoading(false);
        }
    };

    const loadCSVData = async () => {
        const files = [
            { name: 'expeditions', path: './data/exped.csv' },
            { name: 'members', path: './data/members.csv' },
            { name: 'peaks', path: './data/peaks.csv' },
            { name: 'references', path: './data/refer.csv' },
            { name: 'coordinates', path: './data/peak_coordinates.csv' }
        ];

        const data = {};
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                const response = await fetch(file.path);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${file.name}: ${response.statusText}`);
                }
                
                const csvText = await response.text();
                const results = Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (header) => header.trim(),
                    transform: (value) => value.trim()
                });

                if (results.errors.length > 0) {
                    console.warn(`Parsing warnings for ${file.name}:`, results.errors);
                }

                data[file.name] = results.data;
                setLoadingProgress(((i + 1) / files.length) * 100);
                
            } catch (fileError) {
                console.error(`Error loading ${file.name}:`, fileError);
                throw new Error(`Failed to load ${file.name}: ${fileError.message}`);
            }
        }

        const processedData = {
            expeditions: cleanExpeditionData(data.expeditions),
            members: cleanMemberData(data.members),
            peaks: cleanPeakData(data.peaks, data.coordinates),
            references: cleanReferenceData(data.references),
            coordinates: data.coordinates || []
        };

        setRawData(processedData);
        setIsLoading(false);
    };

    const cleanExpeditionData = (data) => {
        return data.map((exp, index) => {
            const hasSuccess = exp.SUCCESS1 === 'True' || exp.SUCCESS1 === true ||
                             exp.SUCCESS2 === 'True' || exp.SUCCESS2 === true ||
                             exp.SUCCESS3 === 'True' || exp.SUCCESS3 === true ||
                             exp.SUCCESS4 === 'True' || exp.SUCCESS4 === true ||
                             exp.SUCCESS === 'True' || exp.SUCCESS === true ||
                             exp.SUCCESS1 === '1' || exp.SUCCESS1 === 'TRUE' ||
                             exp.SUCCESS2 === '1' || exp.SUCCESS2 === 'TRUE' ||
                             exp.SUCCESS3 === '1' || exp.SUCCESS3 === 'TRUE' ||
                             exp.SUCCESS4 === '1' || exp.SUCCESS4 === 'TRUE' ||
                             exp.SUCCESS === '1' || exp.SUCCESS === 'TRUE';

            return {
                ...exp,
                EXPID: exp.EXPID || '',
                PEAKID: exp.PEAKID || '',
                YEAR: parseInt(exp.YEAR) || 0,
                SEASON: exp.SEASON || '',
                NATION: exp.NATION || '',
                SUCCESS: hasSuccess,
                DEATHS: parseInt(exp.DEATHS) || 0,
                O2USED: exp.O2USED === '1' || exp.O2USED === 'TRUE',
                TOTMEMBERS: parseInt(exp.TOTMEMBERS) || 0,
                SMTMEMBERS: parseInt(exp.SMTMEMBERS) || 0,
                MDEATHS: parseInt(exp.MDEATHS) || 0,
                HDEATHS: parseInt(exp.HDEATHS) || 0,
                TOTHIRED: parseInt(exp.TOTHIRED) || 0,
                BCDATE: parseDate(exp.BCDATE),
                SMTDATE: parseDate(exp.SMTDATE),
                TERMDATE: parseDate(exp.TERMDATE)
            };
        }).filter(exp => exp.YEAR > 0 && exp.PEAKID);
    };

    const cleanMemberData = (data) => {
        return data.map(member => ({
            ...member,
            MEMBID: member.MEMBID || '',
            EXPID: member.EXPID || '',
            FNAME: member.FNAME || '',
            LNAME: member.LNAME || '',
            SEX: member.SEX || '',
            AGE: parseInt(member.AGE) || null,
            CITIZEN: member.CITIZEN || '',
            MSUCCESS: member.MSUCCESS === '1' || member.MSUCCESS === 'TRUE',
            DEATH: member.DEATH === '1' || member.DEATH === 'TRUE',
            LEADER: member.LEADER === '1' || member.LEADER === 'TRUE',
            HIRED: member.HIRED === '1' || member.HIRED === 'TRUE'
        })).filter(member => member.EXPID);
    };

    const cleanPeakData = (data, coordinateData = []) => {
        const coordMap = new Map();
        coordinateData.forEach(coord => {
            const names = [
                coord.PEAKNAME,
                coord.PEAKNAME?.replace(/\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)$/, ''),
                coord.PEAKNAME?.replace(/\s+Mount$/, ''),
                coord.PEAKNAME?.replace(/^Mount\s+/, ''),
            ].filter(Boolean);
            
            names.forEach(name => {
                if (name && coord.LATITUDE && coord.LONGITUDE) {
                    coordMap.set(name.toLowerCase().trim(), {
                        lat: parseFloat(coord.LATITUDE),
                        lng: parseFloat(coord.LONGITUDE)
                    });
                }
            });
        });

        return data.map(peak => {
            const cleanedPeak = {
                ...peak,
                PEAKID: peak.PEAKID || '',
                PKNAME: peak.PKNAME || '',
                LOCATION: peak.LOCATION || '',
                HEIGHTM: parseInt(peak.HEIGHTM) || 0,
                PYEAR: parseInt(peak.PYEAR) || null,
                OPEN: peak.OPEN === '1' || peak.OPEN === 'TRUE'
            };

            let coordinates = null;
            const peakName = peak.PKNAME?.toLowerCase().trim();
            
            if (peakName) {
                coordinates = coordMap.get(peakName);
                
                if (!coordinates) {
                    for (const [mapName, coords] of coordMap.entries()) {
                        if (peakName.includes(mapName) || mapName.includes(peakName)) {
                            coordinates = coords;
                            break;
                        }
                    }
                }
            }

            if (!coordinates) {
                coordinates = getRegionCoordinates(peak.LOCATION);
            }

            cleanedPeak.coordinates = coordinates;
            
            return cleanedPeak;
        }).filter(peak => peak.PEAKID && peak.HEIGHTM > 0);
    };

    const cleanReferenceData = (data) => {
        return data.map(ref => ({
            ...ref,
            REFID: ref.REFID || '',
            EXPID: ref.EXPID || '',
            RAUTHOR: ref.RAUTHOR || '',
            RTITLE: ref.RTITLE || '',
            RYEAR: parseInt(ref.RYEAR) || null
        })).filter(ref => ref.EXPID);
    };

    const parseDate = (dateStr) => {
        if (!dateStr || dateStr === '') return null;
        try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        } catch {
            return null;
        }
    };

    const getRegionCoordinates = (location) => {
        if (!location) return { lat: 28.0, lng: 84.0 };
        
        const loc = location.toLowerCase();
        
        const regionMap = {
            'khumbu': { lat: 27.95, lng: 86.85 },
            'everest': { lat: 27.95, lng: 86.85 },
            'annapurna': { lat: 28.55, lng: 83.85 },
            'dhaulagiri': { lat: 28.70, lng: 83.50 },
            'manaslu': { lat: 28.55, lng: 84.55 },
            'manang': { lat: 28.55, lng: 84.55 },
            'langtang': { lat: 28.25, lng: 85.50 },
            'jugal': { lat: 28.35, lng: 85.75 },
            'kangchenjunga': { lat: 27.70, lng: 88.15 },
            'makalu': { lat: 27.89, lng: 87.09 },
            'cho oyu': { lat: 28.09, lng: 86.66 },
            'lhotse': { lat: 27.96, lng: 86.93 },
            'ganesh': { lat: 28.35, lng: 85.10 },
            'rolwaling': { lat: 27.85, lng: 86.50 },
            'damodar': { lat: 28.70, lng: 84.05 },
            'peri': { lat: 28.85, lng: 84.40 },
            'mustang': { lat: 28.90, lng: 83.85 },
            'dolpo': { lat: 29.15, lng: 82.90 },
            'api': { lat: 30.00, lng: 80.93 },
            'saipal': { lat: 29.89, lng: 81.50 }
        };
        
        for (const [region, coords] of Object.entries(regionMap)) {
            if (loc.includes(region)) {
                return {
                    lat: coords.lat + (Math.random() - 0.5) * 0.1,
                    lng: coords.lng + (Math.random() - 0.5) * 0.1
                };
            }
        }
        
        return { 
            lat: 28.0 + Math.random() * 2, 
            lng: 84.0 + Math.random() * 6 
        };
    };

    const filteredData = useMemo(() => {
        if (!rawData.expeditions.length) return rawData;

        let filteredExpeditions = rawData.expeditions;

        if (selectedYear) {
            filteredExpeditions = filteredExpeditions.filter(exp => exp.YEAR === selectedYear);
        }

        if (filters.peakId) {
            const peakConsolidationMap = {
                'YALW': ['YALW', 'YALU'],
                'ANN1': ['ANN1', 'ANNM', 'ANNE'],
                'LHOT': ['LHOT', 'LHOM', 'LSHR'],
                'KANG': ['KANG', 'KANC', 'KANS', 'KANB'],
                'EVER': ['EVER', 'EVEK2'],
                'MANA': ['MANA', 'MANE'],
                'DHA1': ['DHA1', 'DHA2', 'DHA3', 'DHA4', 'DHA5', 'DHA6'],
            };
            
            const peakIds = peakConsolidationMap[filters.peakId] || [filters.peakId];
            filteredExpeditions = filteredExpeditions.filter(exp => peakIds.includes(exp.PEAKID));
        }

        if (filters.season) {
            filteredExpeditions = filteredExpeditions.filter(exp => exp.SEASON === filters.season);
        }

        if (filters.successOnly) {
            filteredExpeditions = filteredExpeditions.filter(exp => exp.SUCCESS);
        }

        const expeditionIds = new Set(filteredExpeditions.map(exp => exp.EXPID));
        const filteredMembers = rawData.members.filter(member => expeditionIds.has(member.EXPID));
        const filteredReferences = rawData.references.filter(ref => expeditionIds.has(ref.EXPID));

        const filteredPeaks = rawData.peaks;
        
        const peakIds = new Set(filteredExpeditions.map(exp => exp.PEAKID));
        const expeditionPeaks = rawData.peaks.filter(peak => peakIds.has(peak.PEAKID));

        return {
            expeditions: filteredExpeditions,
            members: filteredMembers,
            peaks: filteredPeaks,
            expeditionPeaks: expeditionPeaks,
            references: filteredReferences
        };
    }, [rawData, selectedYear, filters]);

    const statistics = useMemo(() => {
        const expeditions = filteredData.expeditions;
        const members = filteredData.members;

        const totalExpeditions = expeditions.length;
        
        if (totalExpeditions === 0) {
            return {
                totalExpeditions: 0,
                successfulExpeditions: 0,
                totalDeaths: 0,
                totalMembers: 0,
                successRate: 0,
                mortalityRate: 0,
                oxygenUsageRate: 0,
                seasonalStats: [],
                yearlyStats: []
            };
        }
        
        const successfulExpeditions = expeditions.filter(exp => {
            const isSuccess = exp.SUCCESS === true || exp.SUCCESS === 'True' || exp.SUCCESS === '1' || exp.SUCCESS === 'TRUE';
            return isSuccess;
        }).length;
        
        const totalDeaths = expeditions.reduce((sum, exp) => sum + (exp.DEATHS || 0), 0);
        const totalMembers = expeditions.reduce((sum, exp) => sum + (exp.TOTMEMBERS || 0), 0);
        
        const oxygenUsage = expeditions.filter(exp => {
            return exp.O2USED === true || exp.O2USED === 'True' || exp.O2USED === '1' || exp.O2USED === 'TRUE';
        }).length;

        const successRate = totalExpeditions > 0 ? (successfulExpeditions / totalExpeditions) * 100 : 0;
        const mortalityRate = totalMembers > 0 ? (totalDeaths / totalMembers) * 100 : 0;
        const oxygenUsageRate = totalExpeditions > 0 ? (oxygenUsage / totalExpeditions) * 100 : 0;

        const seasonalData = _.groupBy(expeditions, 'SEASON');
        const seasonalStats = Object.entries(seasonalData).map(([season, exps]) => ({
            season: season || 'Unknown',
            expeditions: exps.length,
            successRate: (exps.filter(e => e.SUCCESS === true || e.SUCCESS === 'True' || e.SUCCESS === '1' || e.SUCCESS === 'TRUE').length / exps.length) * 100
        }));

        const yearlyData = _.groupBy(expeditions, 'YEAR');
        const yearlyStats = Object.entries(yearlyData)
            .map(([year, exps]) => ({
                year: parseInt(year),
                expeditions: exps.length,
                successRate: (exps.filter(e => e.SUCCESS === true || e.SUCCESS === 'True' || e.SUCCESS === '1' || e.SUCCESS === 'TRUE').length / exps.length) * 100,
                deaths: exps.reduce((sum, exp) => sum + (exp.DEATHS || 0), 0)
            }))
            .sort((a, b) => a.year - b.year);

        const result = {
            totalExpeditions,
            successfulExpeditions,
            totalDeaths,
            totalMembers,
            successRate,
            mortalityRate,
            oxygenUsageRate,
            seasonalStats,
            yearlyStats
        };
        
        return result;
    }, [filteredData]);

    useEffect(() => {
        if (!isLoading) {
            onDataLoaded({
                data: filteredData,
                statistics,
                rawData
            });
        }
    }, [filteredData, statistics, isLoading, onDataLoaded, rawData]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="text-center">
                    <div className="loading-spinner w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold text-white mb-2">Loading Himalayan Data</h2>
                    <p className="text-slate-400 mb-4">Processing expedition records...</p>
                    <div className="w-64 bg-slate-700 rounded-full h-2">
                        <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${loadingProgress}%` }}
                        ></div>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{Math.round(loadingProgress)}% complete</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="text-center max-w-md">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl font-semibold text-white mb-2">Error Loading Data</h2>
                    <p className="text-slate-400 mb-4">{error}</p>
                    <button 
                        onClick={loadAllData}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    return null;
}; 