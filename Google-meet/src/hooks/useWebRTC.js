import { useState, useEffect, useCallback, useRef } from 'react';
import webrtcService from '../services/webrtcService';
import socketService from '../services/socketService';

export const useWebRTC = (meetingId, userId) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [participants, setParticipants] = useState(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [connectionStates, setConnectionStates] = useState(new Map());
    const [error, setError] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const initializationRef = useRef(false);
    const cleanupRef = useRef(false);

    // Initialize WebRTC and Socket connection
    const initialize = useCallback(async () => {
        if (initializationRef.current || !meetingId || !userId) {
            return;
        }

        initializationRef.current = true;
        cleanupRef.current = false;

        try {
            // Initialize media
            const stream = await webrtcService.initializeMedia();
            if (!cleanupRef.current) {
                setLocalStream(stream);
            }

            // Connect to socket
            socketService.connect(meetingId, userId);

            setIsInitialized(true);
        } catch (error) {
            console.error('Failed to initialize WebRTC:', error);
            setError(error);
            initializationRef.current = false;
        }
    }, [meetingId, userId]);

    // Setup event listeners
    useEffect(() => {
        if (!isInitialized) return;

        // WebRTC event listeners
        const handleLocalStreamReady = (stream) => {
            setLocalStream(stream);
        };

        const handleRemoteStream = ({ participantId, stream }) => {
            setRemoteStreams(prev => new Map(prev.set(participantId, stream)));
        };

        const handleConnectionStateChange = ({ participantId, state }) => {
            setConnectionStates(prev => new Map(prev.set(participantId, state)));
        };

        const handleAudioToggled = (enabled) => {
            setIsAudioEnabled(enabled);
        };

        const handleVideoToggled = (enabled) => {
            setIsVideoEnabled(enabled);
        };

        const handleMediaError = (error) => {
            setError(error);
        };

        // Socket event listeners
        const handleSocketConnected = () => {
            setIsConnected(true);
            // Join the meeting
            socketService.joinMeeting({
                meetingId,
                userId,
                userInfo: {
                    name: 'User Name', // This should come from auth context
                    isAudioEnabled,
                    isVideoEnabled
                }
            });
        };

        const handleSocketDisconnected = () => {
            setIsConnected(false);
        };

        const handleParticipantJoined = async (data) => {
            const { participantId, userInfo } = data;

            // Create peer connection for new participant
            const peerConnection = webrtcService.createPeerConnection(participantId);

            // Create and send offer
            try {
                const offer = await webrtcService.createOffer(participantId);
                socketService.sendOffer(participantId, offer);
            } catch (error) {
                console.error('Failed to create offer:', error);
            }

            // Update participants list
            setParticipants(prev => new Map(prev.set(participantId, {
                id: participantId,
                ...userInfo,
                connectionState: 'connecting'
            })));
        };

        const handleParticipantLeft = (data) => {
            const { participantId } = data;

            // Remove peer connection
            webrtcService.removePeerConnection(participantId);

            // Remove from state
            setParticipants(prev => {
                const newMap = new Map(prev);
                newMap.delete(participantId);
                return newMap;
            });

            setRemoteStreams(prev => {
                const newMap = new Map(prev);
                newMap.delete(participantId);
                return newMap;
            });

            setConnectionStates(prev => {
                const newMap = new Map(prev);
                newMap.delete(participantId);
                return newMap;
            });
        };

        const handleWebRTCOffer = async (data) => {
            const { fromUserId, offer } = data;

            try {
                // Create peer connection if it doesn't exist
                if (!webrtcService.getPeerConnection(fromUserId)) {
                    webrtcService.createPeerConnection(fromUserId);
                }

                // Create and send answer
                const answer = await webrtcService.createAnswer(fromUserId, offer);
                socketService.sendAnswer(fromUserId, answer);
            } catch (error) {
                console.error('Failed to handle offer:', error);
            }
        };

        const handleWebRTCAnswer = async (data) => {
            const { fromUserId, answer } = data;

            try {
                await webrtcService.handleAnswer(fromUserId, answer);
            } catch (error) {
                console.error('Failed to handle answer:', error);
            }
        };

        const handleWebRTCIceCandidate = async (data) => {
            const { fromUserId, candidate } = data;

            try {
                await webrtcService.addIceCandidate(fromUserId, candidate);
            } catch (error) {
                console.error('Failed to add ICE candidate:', error);
            }
        };

        const handleParticipantUpdated = (data) => {
            const { participantId, status } = data;

            setParticipants(prev => {
                const participant = prev.get(participantId);
                if (participant) {
                    return new Map(prev.set(participantId, { ...participant, ...status }));
                }
                return prev;
            });
        };

        const handleScreenShareStarted = (data) => {
            const { participantId } = data;
            if (participantId === userId) {
                setIsScreenSharing(true);
            }
        };

        const handleScreenShareStopped = (data) => {
            const { participantId } = data;
            if (participantId === userId) {
                setIsScreenSharing(false);
            }
        };

        const handleIceCandidate = (data) => {
            const { participantId, candidate } = data;
            socketService.sendIceCandidate(participantId, candidate);
        };

        // Register WebRTC event listeners
        webrtcService.on('localStreamReady', handleLocalStreamReady);
        webrtcService.on('remoteStream', handleRemoteStream);
        webrtcService.on('connectionStateChange', handleConnectionStateChange);
        webrtcService.on('audioToggled', handleAudioToggled);
        webrtcService.on('videoToggled', handleVideoToggled);
        webrtcService.on('mediaError', handleMediaError);
        webrtcService.on('iceCandidate', handleIceCandidate);

        // Register Socket event listeners
        socketService.on('connected', handleSocketConnected);
        socketService.on('disconnected', handleSocketDisconnected);
        socketService.on('participantJoined', handleParticipantJoined);
        socketService.on('participantLeft', handleParticipantLeft);
        socketService.on('participantUpdated', handleParticipantUpdated);
        socketService.on('webrtcOffer', handleWebRTCOffer);
        socketService.on('webrtcAnswer', handleWebRTCAnswer);
        socketService.on('webrtcIceCandidate', handleWebRTCIceCandidate);
        socketService.on('screenShareStarted', handleScreenShareStarted);
        socketService.on('screenShareStopped', handleScreenShareStopped);

        // Cleanup function
        return () => {
            // Remove WebRTC event listeners
            webrtcService.off('localStreamReady', handleLocalStreamReady);
            webrtcService.off('remoteStream', handleRemoteStream);
            webrtcService.off('connectionStateChange', handleConnectionStateChange);
            webrtcService.off('audioToggled', handleAudioToggled);
            webrtcService.off('videoToggled', handleVideoToggled);
            webrtcService.off('mediaError', handleMediaError);
            webrtcService.off('iceCandidate', handleIceCandidate);

            // Remove Socket event listeners
            socketService.off('connected', handleSocketConnected);
            socketService.off('disconnected', handleSocketDisconnected);
            socketService.off('participantJoined', handleParticipantJoined);
            socketService.off('participantLeft', handleParticipantLeft);
            socketService.off('participantUpdated', handleParticipantUpdated);
            socketService.off('webrtcOffer', handleWebRTCOffer);
            socketService.off('webrtcAnswer', handleWebRTCAnswer);
            socketService.off('webrtcIceCandidate', handleWebRTCIceCandidate);
            socketService.off('screenShareStarted', handleScreenShareStarted);
            socketService.off('screenShareStopped', handleScreenShareStopped);
        };
    }, [isInitialized, meetingId, userId, isAudioEnabled, isVideoEnabled]);

    // Toggle audio
    const toggleAudio = useCallback(() => {
        const enabled = webrtcService.toggleAudio();
        socketService.updateParticipantStatus({ isAudioEnabled: enabled });
        return enabled;
    }, []);

    // Toggle video
    const toggleVideo = useCallback(() => {
        const enabled = webrtcService.toggleVideo();
        socketService.updateParticipantStatus({ isVideoEnabled: enabled });
        return enabled;
    }, []);

    // Start screen sharing
    const startScreenShare = useCallback(async () => {
        try {
            const screenStream = await webrtcService.getScreenShare();
            const videoTrack = screenStream.getVideoTracks()[0];

            await webrtcService.replaceVideoTrack(videoTrack);
            socketService.startScreenShare();

            // Handle screen share end
            videoTrack.addEventListener('ended', () => {
                stopScreenShare();
            });

            return true;
        } catch (error) {
            console.error('Failed to start screen share:', error);
            setError(error);
            return false;
        }
    }, []);

    // Stop screen sharing
    const stopScreenShare = useCallback(async () => {
        try {
            // Get camera stream
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

            const videoTrack = cameraStream.getVideoTracks()[0];
            await webrtcService.replaceVideoTrack(videoTrack);
            socketService.stopScreenShare();

            return true;
        } catch (error) {
            console.error('Failed to stop screen share:', error);
            setError(error);
            return false;
        }
    }, []);

    // Get connection stats
    const getConnectionStats = useCallback(async (participantId) => {
        return await webrtcService.getConnectionStats(participantId);
    }, []);

    // Leave meeting
    const leaveMeeting = useCallback(() => {
        cleanupRef.current = true;
        socketService.leaveMeeting();
        socketService.disconnect();
        webrtcService.cleanup();

        // Reset state
        setLocalStream(null);
        setRemoteStreams(new Map());
        setParticipants(new Map());
        setConnectionStates(new Map());
        setIsConnected(false);
        setIsAudioEnabled(true);
        setIsVideoEnabled(true);
        setIsScreenSharing(false);
        setError(null);
        setIsInitialized(false);
        initializationRef.current = false;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isInitialized) {
                leaveMeeting();
            }
        };
    }, [isInitialized, leaveMeeting]);

    return {
        // State
        localStream,
        remoteStreams,
        participants: Array.from(participants.values()),
        isConnected,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        connectionStates,
        error,
        isInitialized,

        // Actions
        initialize,
        toggleAudio,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
        getConnectionStats,
        leaveMeeting,

        // Services (for advanced usage)
        webrtcService,
        socketService
    };
};