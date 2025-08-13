// WebRTC Service for handling peer connections and media streams
class WebRTCService {
    constructor() {
        this.localStream = null;
        this.peerConnections = new Map();
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                // Add TURN servers for production
                // {
                //   urls: 'turn:your-turn-server.com:3478',
                //   username: 'username',
                //   credential: 'password'
                // }
            ],
            iceCandidatePoolSize: 10
        };
        this.mediaConstraints = {
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
        this.eventHandlers = new Map();
    }

    // Event handling
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    // Initialize local media stream
    async initializeMedia(constraints = this.mediaConstraints) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.emit('localStreamReady', this.localStream);
            return this.localStream;
        } catch (error) {
            console.error('Failed to get user media:', error);
            this.emit('mediaError', error);
            throw error;
        }
    }

    // Get screen sharing stream
    async getScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor',
                    width: { min: 640, ideal: 1280, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 },
                    frameRate: { min: 15, ideal: 30, max: 60 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Handle screen share end
            const videoTrack = screenStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.addEventListener('ended', () => {
                    console.log('Screen sharing ended by user');
                    this.emit('screenShareEnded');
                });
            }

            return screenStream;
        } catch (error) {
            console.error('Failed to get screen share:', error);

            // Provide more specific error messages
            if (error.name === 'NotAllowedError') {
                error.message = 'Screen sharing permission was denied';
            } else if (error.name === 'NotSupportedError') {
                error.message = 'Screen sharing is not supported in this browser';
            } else if (error.name === 'NotFoundError') {
                error.message = 'No screen sharing source available';
            }

            this.emit('screenShareError', error);
            throw error;
        }
    }

    // Create peer connection
    createPeerConnection(participantId) {
        const peerConnection = new RTCPeerConnection(this.configuration);

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            this.emit('remoteStream', { participantId, stream: remoteStream });
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.emit('iceCandidate', { participantId, candidate: event.candidate });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            this.emit('connectionStateChange', { participantId, state });

            if (state === 'failed' || state === 'disconnected') {
                this.handleConnectionFailure(participantId);
            }
        };

        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            this.emit('iceConnectionStateChange', { participantId, state });
        };

        // Handle data channel (for future use)
        peerConnection.ondatachannel = (event) => {
            const channel = event.channel;
            this.setupDataChannel(channel, participantId);
        };

        this.peerConnections.set(participantId, peerConnection);
        return peerConnection;
    }

    // Create offer
    async createOffer(participantId) {
        const peerConnection = this.peerConnections.get(participantId);
        if (!peerConnection) {
            throw new Error('Peer connection not found');
        }

        try {
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await peerConnection.setLocalDescription(offer);
            return offer;
        } catch (error) {
            console.error('Failed to create offer:', error);
            throw error;
        }
    }

    // Create answer
    async createAnswer(participantId, offer) {
        const peerConnection = this.peerConnections.get(participantId);
        if (!peerConnection) {
            throw new Error('Peer connection not found');
        }

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            return answer;
        } catch (error) {
            console.error('Failed to create answer:', error);
            throw error;
        }
    }

    // Handle answer
    async handleAnswer(participantId, answer) {
        const peerConnection = this.peerConnections.get(participantId);
        if (!peerConnection) {
            throw new Error('Peer connection not found');
        }

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Failed to handle answer:', error);
            throw error;
        }
    }

    // Add ICE candidate
    async addIceCandidate(participantId, candidate) {
        const peerConnection = this.peerConnections.get(participantId);
        if (!peerConnection) {
            console.warn('Peer connection not found for ICE candidate');
            return;
        }

        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }

    // Toggle audio
    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.emit('audioToggled', audioTrack.enabled);
                return audioTrack.enabled;
            }
        }
        return false;
    }

    // Toggle video
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.emit('videoToggled', videoTrack.enabled);
                return videoTrack.enabled;
            }
        }
        return false;
    }

    // Replace video track (for screen sharing)
    async replaceVideoTrack(newTrack) {
        const promises = [];

        this.peerConnections.forEach((peerConnection) => {
            const sender = peerConnection.getSenders().find(s =>
                s.track && s.track.kind === 'video'
            );

            if (sender) {
                promises.push(sender.replaceTrack(newTrack));
            }
        });

        try {
            await Promise.all(promises);

            // Update local stream
            if (this.localStream) {
                const oldVideoTrack = this.localStream.getVideoTracks()[0];
                if (oldVideoTrack) {
                    this.localStream.removeTrack(oldVideoTrack);
                    oldVideoTrack.stop();
                }
                if (newTrack) {
                    this.localStream.addTrack(newTrack);
                }
            }
        } catch (error) {
            console.error('Failed to replace video track:', error);
            throw error;
        }
    }

    // Handle connection failure
    async handleConnectionFailure(participantId) {
        console.log(`Connection failed for participant: ${participantId}`);

        // Attempt to restart ICE
        const peerConnection = this.peerConnections.get(participantId);
        if (peerConnection && peerConnection.connectionState !== 'closed') {
            try {
                await peerConnection.restartIce();
                this.emit('connectionRestart', participantId);
            } catch (error) {
                console.error('Failed to restart ICE:', error);
                this.removePeerConnection(participantId);
            }
        }
    }

    // Setup data channel
    setupDataChannel(channel, participantId) {
        channel.onopen = () => {
            console.log(`Data channel opened with ${participantId}`);
            this.emit('dataChannelOpen', { participantId, channel });
        };

        channel.onmessage = (event) => {
            this.emit('dataChannelMessage', { participantId, data: event.data });
        };

        channel.onclose = () => {
            console.log(`Data channel closed with ${participantId}`);
            this.emit('dataChannelClose', participantId);
        };

        channel.onerror = (error) => {
            console.error(`Data channel error with ${participantId}:`, error);
            this.emit('dataChannelError', { participantId, error });
        };
    }

    // Get connection stats
    async getConnectionStats(participantId) {
        const peerConnection = this.peerConnections.get(participantId);
        if (!peerConnection) {
            return null;
        }

        try {
            const stats = await peerConnection.getStats();
            const result = {
                audio: { inbound: null, outbound: null },
                video: { inbound: null, outbound: null },
                connection: null
            };

            stats.forEach(report => {
                if (report.type === 'inbound-rtp') {
                    if (report.kind === 'audio') {
                        result.audio.inbound = {
                            packetsReceived: report.packetsReceived,
                            packetsLost: report.packetsLost,
                            jitter: report.jitter
                        };
                    } else if (report.kind === 'video') {
                        result.video.inbound = {
                            packetsReceived: report.packetsReceived,
                            packetsLost: report.packetsLost,
                            framesReceived: report.framesReceived,
                            framesDropped: report.framesDropped
                        };
                    }
                } else if (report.type === 'outbound-rtp') {
                    if (report.kind === 'audio') {
                        result.audio.outbound = {
                            packetsSent: report.packetsSent,
                            bytesSent: report.bytesSent
                        };
                    } else if (report.kind === 'video') {
                        result.video.outbound = {
                            packetsSent: report.packetsSent,
                            bytesSent: report.bytesSent,
                            framesSent: report.framesSent
                        };
                    }
                } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    result.connection = {
                        currentRoundTripTime: report.currentRoundTripTime,
                        availableOutgoingBitrate: report.availableOutgoingBitrate,
                        availableIncomingBitrate: report.availableIncomingBitrate
                    };
                }
            });

            return result;
        } catch (error) {
            console.error('Failed to get connection stats:', error);
            return null;
        }
    }

    // Remove peer connection
    removePeerConnection(participantId) {
        const peerConnection = this.peerConnections.get(participantId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(participantId);
            this.emit('peerConnectionRemoved', participantId);
        }
    }

    // Get local stream
    getLocalStream() {
        return this.localStream;
    }

    // Get peer connection
    getPeerConnection(participantId) {
        return this.peerConnections.get(participantId);
    }

    // Get all peer connections
    getAllPeerConnections() {
        return Array.from(this.peerConnections.entries());
    }

    // Cleanup
    cleanup() {
        // Stop local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`WebRTC Service: Stopped ${track.kind} track`);
            });
            this.localStream = null;
        }

        // Close all peer connections
        this.peerConnections.forEach((peerConnection, participantId) => {
            // Stop all tracks in the peer connection
            peerConnection.getSenders().forEach(sender => {
                if (sender.track) {
                    sender.track.stop();
                }
            });

            peerConnection.close();
            console.log(`WebRTC Service: Closed peer connection for ${participantId}`);
        });
        this.peerConnections.clear();

        // Clear event handlers
        this.eventHandlers.clear();

        this.emit('cleanup');
    }
}

// Create singleton instance
const webrtcService = new WebRTCService();
export default webrtcService;