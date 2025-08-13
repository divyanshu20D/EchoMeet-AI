import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useChat } from '../../hooks/useChat';
import { useConnectionQuality } from '../../hooks/useConnectionQuality';
import VideoControls from './VideoControls';
import ParticipantGrid from './ParticipantGrid';
import ParticipantList from './ParticipantList';
import ChatPanel from './ChatPanel';
import MeetingSettings from './MeetingSettings';
import {
    Mic, MicOff, Video, VideoOff, Phone, Settings,
    Users, MessageSquare, Monitor, MoreVertical,
    Shield, Clock, AlertCircle, Loader2
} from 'lucide-react';

const MeetingRoom = () => {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Simplified state for testing - replace WebRTC hooks temporarily
    const [localStream, setLocalStream] = useState(null);
    const [isConnected, setIsConnected] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [participants, setParticipants] = useState([]);
    const [participantCount, setParticipantCount] = useState(0);

    // Simplified initialize function
    const initialize = async () => {
        try {
            console.log('Initializing media...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setLocalStream(stream);
            setIsInitialized(true);
            console.log('Media initialized successfully');
        } catch (error) {
            console.error('Failed to initialize media:', error);
            setIsInitialized(true); // Allow joining even without media
        }
    };

    // Simplified toggle functions
    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    const startScreenShare = async () => {
        try {
            // Request screen sharing permission
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: true
            });

            // Replace current video track with screen share
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.stop();
                    localStream.removeTrack(videoTrack);
                }

                const screenTrack = screenStream.getVideoTracks()[0];
                localStream.addTrack(screenTrack);

                // Handle screen share end
                screenTrack.onended = () => {
                    stopScreenShare();
                };
            }

            setIsScreenSharing(true);
        } catch (error) {
            console.error('Error starting screen share:', error);
            if (error.name === 'NotAllowedError') {
                alert('Screen sharing permission was denied. Please allow screen sharing and try again.');
            } else if (error.name === 'NotSupportedError') {
                alert('Screen sharing is not supported in this browser.');
            } else {
                alert('Failed to start screen sharing. Please try again.');
            }
        }
    };

    const stopScreenShare = async () => {
        try {
            if (localStream) {
                // Stop screen sharing track
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.stop();
                    localStream.removeTrack(videoTrack);
                }

                // Get camera stream back
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });

                const cameraTrack = cameraStream.getVideoTracks()[0];
                localStream.addTrack(cameraTrack);
            }

            setIsScreenSharing(false);
        } catch (error) {
            console.error('Error stopping screen share:', error);
            alert('Failed to stop screen sharing. Please try again.');
        }
    };

    const leaveWebRTC = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped ${track.kind} track`);
            });
            setLocalStream(null);
        }
    };

    // Meeting state
    const [meeting, setMeeting] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isJoined, setIsJoined] = useState(false);

    // UI state
    const [showParticipants, setShowParticipants] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Meeting duration
    const [duration, setDuration] = useState(0);
    const [startTime, setStartTime] = useState(null);

    useEffect(() => {
        initializeMeeting();

        // Cleanup function to stop media tracks when component unmounts
        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => {
                    track.stop();
                    console.log(`Cleanup: Stopped ${track.kind} track`);
                });
            }
        };
    }, [meetingId]);

    useEffect(() => {
        // Update duration every second
        let interval;
        if (isJoined && startTime) {
            interval = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isJoined, startTime]);

    useEffect(() => {
        // Refresh participants every 5 seconds when joined
        let interval;
        if (isJoined) {
            interval = setInterval(fetchParticipants, 5000);
        }
        return () => clearInterval(interval);
    }, [isJoined, meetingId]);

    const initializeMeeting = async () => {
        try {
            setIsLoading(true);

            // Fetch meeting details
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load meeting');
            }

            const meetingData = await response.json();
            setMeeting(meetingData.meeting);

            // Initialize WebRTC
            if (user?.id) {
                await initialize();
            }

        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };



    const joinMeeting = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}/join`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to join meeting');
            }

            setIsJoined(true);
            setStartTime(Date.now());

            // Fetch participants after joining
            await fetchParticipants();
        } catch (error) {
            setError(error.message);
        }
    };

    const fetchParticipants = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}/participants`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setParticipants(data.participants);
                setParticipantCount(data.participants.length);
            }
        } catch (error) {
            console.error('Failed to fetch participants:', error);
        }
    };

    const leaveMeeting = async () => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}/leave`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                }
            });

            leaveWebRTC();
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to leave meeting:', error);
            // Still navigate away even if API call fails
            leaveWebRTC();
            navigate('/dashboard');
        }
    };

    const handleToggleScreenShare = async () => {
        try {
            if (!isScreenSharing) {
                await startScreenShare();
            } else {
                await stopScreenShare();
            }
        } catch (error) {
            console.error('Screen share error:', error);
            setError('Failed to toggle screen sharing');
        }
    };

    const formatDuration = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-white">Loading meeting...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Unable to join meeting</h2>
                    <p className="text-gray-300 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!isJoined) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {meeting?.title || 'Meeting Room'}
                        </h2>
                        <p className="text-gray-300">
                            Ready to join the meeting?
                        </p>
                        {!isInitialized && (
                            <p className="text-yellow-400 text-sm mt-2">
                                Initializing media devices...
                            </p>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="relative mb-6 bg-gray-700 rounded-lg overflow-hidden aspect-video">
                        {localStream ? (
                            <video
                                ref={(video) => {
                                    if (video && localStream) {
                                        video.srcObject = localStream;
                                    }
                                }}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center">
                                    <Video className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                    <p className="text-gray-400">Camera not available</p>
                                </div>
                            </div>
                        )}
                        <div className="absolute bottom-4 left-4 flex space-x-2">
                            <button
                                onClick={toggleAudio}
                                className={`p-2 rounded-full ${isAudioEnabled ? 'bg-gray-600 text-white' : 'bg-red-600 text-white'
                                    }`}
                            >
                                {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                            </button>
                            <button
                                onClick={toggleVideo}
                                className={`p-2 rounded-full ${isVideoEnabled ? 'bg-gray-600 text-white' : 'bg-red-600 text-white'
                                    }`}
                            >
                                {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                            </button>
                        </div>

                        {/* Connection status */}
                        <div className="absolute top-4 right-4">
                            <div className={`px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                }`}>
                                {isConnected ? 'Connected' : 'Connecting...'}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={joinMeeting}
                        disabled={!isInitialized}
                        className="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isInitialized ? 'Join Meeting' : 'Initializing...'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-900 flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <h1 className="text-white font-medium truncate">
                        {meeting?.title || 'Meeting Room'}
                    </h1>
                    {meeting?.isSecure && (
                        <Shield className="h-4 w-4 text-green-500" title="Secure meeting" />
                    )}
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center text-gray-300 text-sm">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDuration(duration)}
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setShowParticipants(!showParticipants)}
                            className={`p-2 rounded-md relative ${showParticipants ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                                }`}
                            title="Participants"
                        >
                            <Users className="h-4 w-4" />
                            {participantCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                    {participantCount}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setShowChat(!showChat)}
                            className={`p-2 rounded-md ${showChat ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                                }`}
                            title="Chat"
                        >
                            <MessageSquare className="h-4 w-4" />
                        </button>

                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-md ${showSettings ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                                }`}
                            title="Settings"
                        >
                            <Settings className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Video Area */}
                <div className="flex-1 relative overflow-hidden">
                    {/* Simplified video display */}
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        {localStream ? (
                            <div className="relative w-full h-full max-w-4xl max-h-full">
                                <video
                                    ref={(video) => {
                                        if (video && localStream) {
                                            video.srcObject = localStream;
                                        }
                                    }}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                {/* User name overlay */}
                                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm">
                                    {user?.name} (You)
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Video className="h-16 w-16 text-gray-400" />
                                </div>
                                <p className="text-gray-400 text-lg">Camera not available</p>
                                <p className="text-gray-500 text-sm mt-2">Check your camera permissions</p>
                            </div>
                        )}
                    </div>

                    {/* Simplified Video Controls */}
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                        <div className="flex items-center space-x-4 bg-gray-800 rounded-full px-6 py-3">
                            <button
                                onClick={toggleAudio}
                                className={`p-3 rounded-full ${isAudioEnabled ? 'bg-gray-600 text-white' : 'bg-red-600 text-white'}`}
                            >
                                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                            </button>
                            <button
                                onClick={toggleVideo}
                                className={`p-3 rounded-full ${isVideoEnabled ? 'bg-gray-600 text-white' : 'bg-red-600 text-white'}`}
                            >
                                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                            </button>
                            <button
                                onClick={handleToggleScreenShare}
                                className={`p-3 rounded-full ${isScreenSharing ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'}`}
                                title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                            >
                                <Monitor className="h-5 w-5" />
                            </button>
                            <button
                                onClick={leaveMeeting}
                                className="p-3 rounded-full bg-red-600 text-white"
                            >
                                <Phone className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Side Panels */}
                {showParticipants && (
                    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
                        {/* Header - Fixed */}
                        <div className="p-4 border-b border-gray-700 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white font-medium">Participants ({participantCount})</h3>
                                <button
                                    onClick={() => setShowParticipants(false)}
                                    className="text-gray-400 hover:text-white text-xl leading-none"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {participants.map((participant) => (
                                    <div key={participant.id} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-white text-sm font-medium">
                                                {participant.name?.[0]?.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-medium truncate">
                                                {participant.name}
                                                {participant.userId === user?.id && ' (You)'}
                                            </div>
                                            <div className="text-xs text-gray-400 capitalize">
                                                {participant.role.toLowerCase()}
                                            </div>
                                        </div>
                                        <div className="flex space-x-1 flex-shrink-0">
                                            {participant.isAudioMuted ? (
                                                <MicOff className="h-4 w-4 text-red-400" title="Muted" />
                                            ) : (
                                                <Mic className="h-4 w-4 text-green-400" title="Unmuted" />
                                            )}
                                            {participant.isVideoMuted ? (
                                                <VideoOff className="h-4 w-4 text-red-400" title="Video off" />
                                            ) : (
                                                <Video className="h-4 w-4 text-green-400" title="Video on" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {participants.length === 0 && (
                                    <div className="text-gray-400 text-center py-8">
                                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p>No participants yet</p>
                                        <p className="text-sm mt-1">Invite others to join the meeting</p>

                                        {/* Add test participants button for demo */}
                                        <button
                                            onClick={() => {
                                                // Add some test participants for demo
                                                const testParticipants = [
                                                    { id: 'test1', userId: 'test1', name: 'Alice Johnson', role: 'PARTICIPANT', isAudioMuted: false, isVideoMuted: false },
                                                    { id: 'test2', userId: 'test2', name: 'Bob Smith', role: 'MODERATOR', isAudioMuted: true, isVideoMuted: false },
                                                    { id: 'test3', userId: 'test3', name: 'Carol Davis', role: 'PARTICIPANT', isAudioMuted: false, isVideoMuted: true },
                                                    { id: 'test4', userId: 'test4', name: 'David Wilson', role: 'PARTICIPANT', isAudioMuted: true, isVideoMuted: true },
                                                    { id: 'test5', userId: 'test5', name: 'Emma Brown', role: 'PARTICIPANT', isAudioMuted: false, isVideoMuted: false },
                                                    { id: 'test6', userId: 'test6', name: 'Frank Miller', role: 'PARTICIPANT', isAudioMuted: true, isVideoMuted: false },
                                                    { id: 'test7', userId: 'test7', name: 'Grace Lee', role: 'PARTICIPANT', isAudioMuted: false, isVideoMuted: true },
                                                    { id: 'test8', userId: 'test8', name: 'Henry Taylor', role: 'PARTICIPANT', isAudioMuted: false, isVideoMuted: false },
                                                ];
                                                setParticipants([...participants, ...testParticipants]);
                                                setParticipantCount(participants.length + testParticipants.length);
                                            }}
                                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                        >
                                            Add Test Participants (Demo)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showChat && (
                    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
                        {/* Header - Fixed */}
                        <div className="p-4 border-b border-gray-700 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white font-medium">Chat</h3>
                                <button
                                    onClick={() => setShowChat(false)}
                                    className="text-gray-400 hover:text-white text-xl leading-none"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Messages - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="text-gray-400 text-center py-8">
                                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Chat functionality coming soon...</p>
                                <p className="text-sm mt-1">Send messages to other participants</p>
                            </div>
                        </div>

                        {/* Input - Fixed */}
                        <div className="p-4 border-t border-gray-700 flex-shrink-0">
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                                    disabled
                                />
                                <button
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 w-96">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-medium">Settings</h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                ×
                            </button>
                        </div>
                        <div className="text-gray-400 text-center">
                            Settings panel coming soon...
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeetingRoom;