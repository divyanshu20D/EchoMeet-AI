import { useState, useEffect, useCallback, useRef } from 'react';

export const useMediaStream = () => {
    const [localStream, setLocalStream] = useState(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [devices, setDevices] = useState({
        audioInputs: [],
        videoInputs: [],
        audioOutputs: []
    });
    const [selectedDevices, setSelectedDevices] = useState({
        audioInput: '',
        videoInput: '',
        audioOutput: ''
    });
    const [error, setError] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const streamRef = useRef(null);
    const screenStreamRef = useRef(null);

    // Default media constraints
    const defaultConstraints = {
        video: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            frameRate: { min: 15, ideal: 30, max: 60 }
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
        }
    };

    // Get available media devices
    const getDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();

            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

            setDevices({
                audioInputs,
                videoInputs,
                audioOutputs
            });

            // Set default devices if not already selected
            if (!selectedDevices.audioInput && audioInputs.length > 0) {
                setSelectedDevices(prev => ({
                    ...prev,
                    audioInput: audioInputs[0].deviceId
                }));
            }

            if (!selectedDevices.videoInput && videoInputs.length > 0) {
                setSelectedDevices(prev => ({
                    ...prev,
                    videoInput: videoInputs[0].deviceId
                }));
            }

            if (!selectedDevices.audioOutput && audioOutputs.length > 0) {
                setSelectedDevices(prev => ({
                    ...prev,
                    audioOutput: audioOutputs[0].deviceId
                }));
            }

            return { audioInputs, videoInputs, audioOutputs };
        } catch (error) {
            console.error('Failed to get media devices:', error);
            setError(error);
            return { audioInputs: [], videoInputs: [], audioOutputs: [] };
        }
    }, [selectedDevices]);

    // Initialize media stream
    const initializeStream = useCallback(async (constraints = defaultConstraints) => {
        try {
            // Add device constraints if devices are selected
            const finalConstraints = { ...constraints };

            if (selectedDevices.audioInput && finalConstraints.audio) {
                finalConstraints.audio = {
                    ...finalConstraints.audio,
                    deviceId: { exact: selectedDevices.audioInput }
                };
            }

            if (selectedDevices.videoInput && finalConstraints.video) {
                finalConstraints.video = {
                    ...finalConstraints.video,
                    deviceId: { exact: selectedDevices.videoInput }
                };
            }

            const stream = await navigator.mediaDevices.getUserMedia(finalConstraints);

            // Stop existing stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            streamRef.current = stream;
            setLocalStream(stream);
            setIsInitialized(true);
            setError(null);

            // Set initial audio/video state based on tracks
            const audioTrack = stream.getAudioTracks()[0];
            const videoTrack = stream.getVideoTracks()[0];

            setIsAudioEnabled(audioTrack ? audioTrack.enabled : false);
            setIsVideoEnabled(videoTrack ? videoTrack.enabled : false);

            return stream;
        } catch (error) {
            console.error('Failed to initialize media stream:', error);
            setError(error);
            throw error;
        }
    }, [selectedDevices]);

    // Toggle audio
    const toggleAudio = useCallback(() => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
                return audioTrack.enabled;
            }
        }
        return false;
    }, []);

    // Toggle video
    const toggleVideo = useCallback(() => {
        if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
                return videoTrack.enabled;
            }
        }
        return false;
    }, []);

    // Start screen sharing
    const startScreenShare = useCallback(async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: true
            });

            screenStreamRef.current = screenStream;

            // Replace video track in the main stream
            if (streamRef.current) {
                const videoTrack = screenStream.getVideoTracks()[0];
                const oldVideoTrack = streamRef.current.getVideoTracks()[0];

                if (oldVideoTrack) {
                    streamRef.current.removeTrack(oldVideoTrack);
                    oldVideoTrack.stop();
                }

                streamRef.current.addTrack(videoTrack);
                setLocalStream(new MediaStream(streamRef.current.getTracks()));
            }

            setIsScreenSharing(true);
            setError(null);

            // Handle screen share end
            screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                stopScreenShare();
            });

            return screenStream;
        } catch (error) {
            console.error('Failed to start screen share:', error);
            setError(error);
            throw error;
        }
    }, []);

    // Stop screen sharing
    const stopScreenShare = useCallback(async () => {
        try {
            // Stop screen stream
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
            }

            // Get camera stream back
            const videoConstraints = {
                ...defaultConstraints.video,
                deviceId: selectedDevices.videoInput ? { exact: selectedDevices.videoInput } : undefined
            };

            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false
            });

            // Replace screen share track with camera track
            if (streamRef.current) {
                const newVideoTrack = cameraStream.getVideoTracks()[0];
                const oldVideoTrack = streamRef.current.getVideoTracks()[0];

                if (oldVideoTrack) {
                    streamRef.current.removeTrack(oldVideoTrack);
                    oldVideoTrack.stop();
                }

                if (newVideoTrack) {
                    streamRef.current.addTrack(newVideoTrack);
                }

                setLocalStream(new MediaStream(streamRef.current.getTracks()));
            }

            setIsScreenSharing(false);
            setError(null);
        } catch (error) {
            console.error('Failed to stop screen share:', error);
            setError(error);
            throw error;
        }
    }, [selectedDevices.videoInput]);

    // Change audio input device
    const changeAudioInput = useCallback(async (deviceId) => {
        try {
            const audioConstraints = {
                ...defaultConstraints.audio,
                deviceId: { exact: deviceId }
            };

            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints,
                video: false
            });

            if (streamRef.current) {
                const newAudioTrack = audioStream.getAudioTracks()[0];
                const oldAudioTrack = streamRef.current.getAudioTracks()[0];

                if (oldAudioTrack) {
                    streamRef.current.removeTrack(oldAudioTrack);
                    oldAudioTrack.stop();
                }

                streamRef.current.addTrack(newAudioTrack);
                setLocalStream(new MediaStream(streamRef.current.getTracks()));
            }

            setSelectedDevices(prev => ({ ...prev, audioInput: deviceId }));
            setError(null);
        } catch (error) {
            console.error('Failed to change audio input:', error);
            setError(error);
            throw error;
        }
    }, []);

    // Change video input device
    const changeVideoInput = useCallback(async (deviceId) => {
        try {
            const videoConstraints = {
                ...defaultConstraints.video,
                deviceId: { exact: deviceId }
            };

            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false
            });

            if (streamRef.current) {
                const newVideoTrack = videoStream.getVideoTracks()[0];
                const oldVideoTrack = streamRef.current.getVideoTracks()[0];

                if (oldVideoTrack) {
                    streamRef.current.removeTrack(oldVideoTrack);
                    oldVideoTrack.stop();
                }

                streamRef.current.addTrack(newVideoTrack);
                setLocalStream(new MediaStream(streamRef.current.getTracks()));
            }

            setSelectedDevices(prev => ({ ...prev, videoInput: deviceId }));
            setError(null);
        } catch (error) {
            console.error('Failed to change video input:', error);
            setError(error);
            throw error;
        }
    }, []);

    // Change audio output device
    const changeAudioOutput = useCallback(async (deviceId) => {
        try {
            setSelectedDevices(prev => ({ ...prev, audioOutput: deviceId }));
            // Note: Changing audio output requires setting the sinkId on audio elements
            // This will be handled by the components that use this hook
        } catch (error) {
            console.error('Failed to change audio output:', error);
            setError(error);
            throw error;
        }
    }, []);

    // Get stream statistics
    const getStreamStats = useCallback(() => {
        if (!streamRef.current) return null;

        const audioTracks = streamRef.current.getAudioTracks();
        const videoTracks = streamRef.current.getVideoTracks();

        return {
            audio: {
                count: audioTracks.length,
                enabled: audioTracks.length > 0 ? audioTracks[0].enabled : false,
                settings: audioTracks.length > 0 ? audioTracks[0].getSettings() : null
            },
            video: {
                count: videoTracks.length,
                enabled: videoTracks.length > 0 ? videoTracks[0].enabled : false,
                settings: videoTracks.length > 0 ? videoTracks[0].getSettings() : null
            },
            isScreenSharing
        };
    }, [isScreenSharing]);

    // Cleanup stream
    const cleanup = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }

        setLocalStream(null);
        setIsAudioEnabled(true);
        setIsVideoEnabled(true);
        setIsScreenSharing(false);
        setIsInitialized(false);
        setError(null);
    }, []);

    // Initialize devices on mount
    useEffect(() => {
        getDevices();

        // Listen for device changes
        const handleDeviceChange = () => {
            getDevices();
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [getDevices]);

    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    return {
        // State
        localStream,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        devices,
        selectedDevices,
        error,
        isInitialized,

        // Actions
        initializeStream,
        toggleAudio,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
        changeAudioInput,
        changeVideoInput,
        changeAudioOutput,
        getDevices,
        getStreamStats,
        cleanup,

        // Utils
        defaultConstraints
    };
};