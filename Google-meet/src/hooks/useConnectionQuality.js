import { useState, useEffect, useCallback, useRef } from 'react';

export const useConnectionQuality = (webrtcService, participants = []) => {
    const [connectionQualities, setConnectionQualities] = useState(new Map());
    const [networkStats, setNetworkStats] = useState({
        bandwidth: { upload: 0, download: 0 },
        latency: 0,
        packetLoss: 0,
        jitter: 0
    });
    const [overallQuality, setOverallQuality] = useState('good');

    const statsIntervalRef = useRef(null);
    const previousStatsRef = useRef(new Map());

    // Quality thresholds
    const qualityThresholds = {
        excellent: { latency: 50, packetLoss: 0.5, jitter: 10 },
        good: { latency: 150, packetLoss: 2, jitter: 30 },
        fair: { latency: 300, packetLoss: 5, jitter: 50 },
        poor: { latency: 500, packetLoss: 10, jitter: 100 }
    };

    // Calculate connection quality based on stats
    const calculateQuality = useCallback((stats) => {
        if (!stats || !stats.connection) return 'unknown';

        const { currentRoundTripTime } = stats.connection;
        const latency = currentRoundTripTime * 1000; // Convert to ms

        // Calculate packet loss percentage
        let packetLoss = 0;
        if (stats.audio?.inbound) {
            const { packetsReceived, packetsLost } = stats.audio.inbound;
            if (packetsReceived > 0) {
                packetLoss = (packetsLost / (packetsReceived + packetsLost)) * 100;
            }
        }

        // Get jitter
        const jitter = stats.audio?.inbound?.jitter || 0;

        // Determine quality level
        if (latency <= qualityThresholds.excellent.latency &&
            packetLoss <= qualityThresholds.excellent.packetLoss &&
            jitter <= qualityThresholds.excellent.jitter) {
            return 'excellent';
        } else if (latency <= qualityThresholds.good.latency &&
            packetLoss <= qualityThresholds.good.packetLoss &&
            jitter <= qualityThresholds.good.jitter) {
            return 'good';
        } else if (latency <= qualityThresholds.fair.latency &&
            packetLoss <= qualityThresholds.fair.packetLoss &&
            jitter <= qualityThresholds.fair.jitter) {
            return 'fair';
        } else {
            return 'poor';
        }
    }, []);

    // Get quality color
    const getQualityColor = useCallback((quality) => {
        switch (quality) {
            case 'excellent': return '#10B981'; // green-500
            case 'good': return '#3B82F6'; // blue-500
            case 'fair': return '#F59E0B'; // amber-500
            case 'poor': return '#EF4444'; // red-500
            default: return '#6B7280'; // gray-500
        }
    }, []);

    // Get quality icon
    const getQualityIcon = useCallback((quality) => {
        switch (quality) {
            case 'excellent': return '📶';
            case 'good': return '📶';
            case 'fair': return '📶';
            case 'poor': return '📶';
            default: return '❓';
        }
    }, []);

    // Calculate bandwidth from stats
    const calculateBandwidth = useCallback((currentStats, previousStats) => {
        if (!currentStats || !previousStats) return { upload: 0, download: 0 };

        const timeDiff = (Date.now() - previousStats.timestamp) / 1000; // seconds
        if (timeDiff <= 0) return { upload: 0, download: 0 };

        let upload = 0;
        let download = 0;

        // Calculate upload bandwidth
        if (currentStats.audio?.outbound && previousStats.audio?.outbound) {
            const bytesDiff = currentStats.audio.outbound.bytesSent - previousStats.audio.outbound.bytesSent;
            upload += (bytesDiff * 8) / timeDiff; // bits per second
        }

        if (currentStats.video?.outbound && previousStats.video?.outbound) {
            const bytesDiff = currentStats.video.outbound.bytesSent - previousStats.video.outbound.bytesSent;
            upload += (bytesDiff * 8) / timeDiff; // bits per second
        }

        // Calculate download bandwidth (this would need to be aggregated from all participants)
        // For now, we'll estimate based on inbound stats
        if (currentStats.audio?.inbound && previousStats.audio?.inbound) {
            const packetsReceived = currentStats.audio.inbound.packetsReceived - previousStats.audio.inbound.packetsReceived;
            download += packetsReceived * 160 * 8; // Estimate: 160 bytes per audio packet
        }

        if (currentStats.video?.inbound && previousStats.video?.inbound) {
            const packetsReceived = currentStats.video.inbound.packetsReceived - previousStats.video.inbound.packetsReceived;
            download += packetsReceived * 1200 * 8; // Estimate: 1200 bytes per video packet
        }

        return {
            upload: Math.max(0, upload),
            download: Math.max(0, download)
        };
    }, []);

    // Update connection stats for all participants
    const updateConnectionStats = useCallback(async () => {
        if (!webrtcService) return;

        const newQualities = new Map();
        let totalLatency = 0;
        let totalPacketLoss = 0;
        let totalJitter = 0;
        let validConnections = 0;

        for (const participant of participants) {
            try {
                const stats = await webrtcService.getConnectionStats(participant.id);
                if (stats) {
                    const quality = calculateQuality(stats);
                    newQualities.set(participant.id, {
                        quality,
                        stats,
                        timestamp: Date.now()
                    });

                    // Aggregate stats for overall quality
                    if (stats.connection) {
                        totalLatency += stats.connection.currentRoundTripTime * 1000;
                        validConnections++;
                    }

                    if (stats.audio?.inbound) {
                        const { packetsReceived, packetsLost, jitter } = stats.audio.inbound;
                        if (packetsReceived > 0) {
                            totalPacketLoss += (packetsLost / (packetsReceived + packetsLost)) * 100;
                            totalJitter += jitter;
                        }
                    }

                    // Calculate bandwidth
                    const previousStats = previousStatsRef.current.get(participant.id);
                    if (previousStats) {
                        const bandwidth = calculateBandwidth(stats, previousStats);
                        setNetworkStats(prev => ({
                            ...prev,
                            bandwidth: {
                                upload: prev.bandwidth.upload + bandwidth.upload,
                                download: prev.bandwidth.download + bandwidth.download
                            }
                        }));
                    }

                    // Store current stats for next calculation
                    previousStatsRef.current.set(participant.id, {
                        ...stats,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error(`Failed to get stats for participant ${participant.id}:`, error);
            }
        }

        setConnectionQualities(newQualities);

        // Calculate overall quality
        if (validConnections > 0) {
            const avgLatency = totalLatency / validConnections;
            const avgPacketLoss = totalPacketLoss / validConnections;
            const avgJitter = totalJitter / validConnections;

            const overallStats = {
                connection: { currentRoundTripTime: avgLatency / 1000 },
                audio: { inbound: { packetsReceived: 100, packetsLost: avgPacketLoss, jitter: avgJitter } }
            };

            const quality = calculateQuality(overallStats);
            setOverallQuality(quality);

            setNetworkStats(prev => ({
                ...prev,
                latency: avgLatency,
                packetLoss: avgPacketLoss,
                jitter: avgJitter
            }));
        }
    }, [webrtcService, participants, calculateQuality, calculateBandwidth]);

    // Start monitoring
    const startMonitoring = useCallback((interval = 5000) => {
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
        }

        statsIntervalRef.current = setInterval(updateConnectionStats, interval);
        updateConnectionStats(); // Initial update
    }, [updateConnectionStats]);

    // Stop monitoring
    const stopMonitoring = useCallback(() => {
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
        }
    }, []);

    // Get quality for specific participant
    const getParticipantQuality = useCallback((participantId) => {
        const qualityData = connectionQualities.get(participantId);
        return qualityData ? qualityData.quality : 'unknown';
    }, [connectionQualities]);

    // Get stats for specific participant
    const getParticipantStats = useCallback((participantId) => {
        const qualityData = connectionQualities.get(participantId);
        return qualityData ? qualityData.stats : null;
    }, [connectionQualities]);

    // Get quality summary
    const getQualitySummary = useCallback(() => {
        const summary = {
            excellent: 0,
            good: 0,
            fair: 0,
            poor: 0,
            unknown: 0
        };

        connectionQualities.forEach(({ quality }) => {
            summary[quality] = (summary[quality] || 0) + 1;
        });

        return summary;
    }, [connectionQualities]);

    // Format bandwidth for display
    const formatBandwidth = useCallback((bps) => {
        if (bps < 1000) {
            return `${Math.round(bps)} bps`;
        } else if (bps < 1000000) {
            return `${Math.round(bps / 1000)} Kbps`;
        } else {
            return `${Math.round(bps / 1000000)} Mbps`;
        }
    }, []);

    // Get network quality recommendations
    const getRecommendations = useCallback(() => {
        const recommendations = [];

        if (networkStats.latency > qualityThresholds.fair.latency) {
            recommendations.push('High latency detected. Consider moving closer to your router or using a wired connection.');
        }

        if (networkStats.packetLoss > qualityThresholds.fair.packetLoss) {
            recommendations.push('Packet loss detected. Check your network connection stability.');
        }

        if (networkStats.jitter > qualityThresholds.fair.jitter) {
            recommendations.push('High jitter detected. This may cause audio/video quality issues.');
        }

        if (networkStats.bandwidth.upload < 500000) { // Less than 500 Kbps
            recommendations.push('Low upload bandwidth. Consider reducing video quality or closing other applications.');
        }

        if (overallQuality === 'poor') {
            recommendations.push('Poor connection quality. Consider switching to audio-only mode.');
        }

        return recommendations;
    }, [networkStats, overallQuality]);

    // Start monitoring when participants change
    useEffect(() => {
        if (participants.length > 0 && webrtcService) {
            startMonitoring();
        } else {
            stopMonitoring();
        }

        return stopMonitoring;
    }, [participants.length, webrtcService, startMonitoring, stopMonitoring]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopMonitoring();
            previousStatsRef.current.clear();
        };
    }, [stopMonitoring]);

    return {
        // State
        connectionQualities: Array.from(connectionQualities.entries()).map(([id, data]) => ({
            participantId: id,
            ...data
        })),
        networkStats,
        overallQuality,

        // Actions
        startMonitoring,
        stopMonitoring,
        updateConnectionStats,

        // Getters
        getParticipantQuality,
        getParticipantStats,
        getQualitySummary,
        getQualityColor,
        getQualityIcon,
        formatBandwidth,
        getRecommendations,

        // Utils
        qualityThresholds
    };
};