import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, User, Crown, Shield } from 'lucide-react';

const ParticipantTile = ({ participant, isLocal = false, stream = null, className = '' }) => {
    const videoRef = useRef(null);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            setIsVideoLoaded(true);
        }
    }, [stream]);

    const getInitials = (name) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case 'host':
                return <Crown className="h-3 w-3 text-yellow-400" />;
            case 'moderator':
                return <Shield className="h-3 w-3 text-blue-400" />;
            default:
                return null;
        }
    };

    return (
        <div className={`relative bg-gray-800 rounded-lg overflow-hidden ${className}`}>
            {/* Video/Avatar */}
            <div className="w-full h-full relative">
                {participant?.isVideoEnabled && stream ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        muted={isLocal}
                        playsInline
                        className={`w-full h-full object-cover ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                        <div className="text-white text-2xl font-bold">
                            {participant?.name ? getInitials(participant.name) : <User className="h-8 w-8" />}
                        </div>
                    </div>
                )}

                {/* Loading overlay */}
                {participant?.isVideoEnabled && stream && !isVideoLoaded && (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                )}
            </div>

            {/* Participant Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-sm font-medium truncate">
                            {participant?.name || 'Unknown'}
                            {isLocal && ' (You)'}
                        </span>
                        {getRoleIcon(participant?.role)}
                    </div>

                    <div className="flex items-center space-x-1">
                        {/* Audio indicator */}
                        <div className={`p-1 rounded ${participant?.isAudioEnabled
                                ? 'bg-green-600'
                                : 'bg-red-600'
                            }`}>
                            {participant?.isAudioEnabled ? (
                                <Mic className="h-3 w-3 text-white" />
                            ) : (
                                <MicOff className="h-3 w-3 text-white" />
                            )}
                        </div>

                        {/* Video indicator */}
                        {!participant?.isVideoEnabled && (
                            <div className="p-1 rounded bg-red-600">
                                <VideoOff className="h-3 w-3 text-white" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Connection status */}
            {participant?.connectionStatus === 'connecting' && (
                <div className="absolute top-2 right-2">
                    <div className="animate-pulse bg-yellow-500 rounded-full h-2 w-2"></div>
                </div>
            )}

            {participant?.connectionStatus === 'poor' && (
                <div className="absolute top-2 right-2">
                    <div className="bg-red-500 rounded-full h-2 w-2"></div>
                </div>
            )}
        </div>
    );
};

const ParticipantGrid = ({ participants = [], localStream = null, isScreenSharing = false }) => {
    const [layout, setLayout] = useState('grid');
    const totalParticipants = participants.length + (localStream ? 1 : 0);

    // Calculate grid layout
    const getGridLayout = (count) => {
        if (count <= 1) return 'grid-cols-1 grid-rows-1';
        if (count <= 2) return 'grid-cols-2 grid-rows-1';
        if (count <= 4) return 'grid-cols-2 grid-rows-2';
        if (count <= 6) return 'grid-cols-3 grid-rows-2';
        if (count <= 9) return 'grid-cols-3 grid-rows-3';
        return 'grid-cols-4 grid-rows-3';
    };

    // Screen sharing layout
    if (isScreenSharing) {
        return (
            <div className="h-full flex">
                {/* Main screen share area */}
                <div className="flex-1 bg-black flex items-center justify-center">
                    <div className="text-white text-center">
                        <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">Screen sharing active</p>
                        <p className="text-sm text-gray-400">Screen content will appear here</p>
                    </div>
                </div>

                {/* Participant thumbnails */}
                <div className="w-64 bg-gray-900 p-4 space-y-3 overflow-y-auto">
                    {/* Local participant */}
                    {localStream && (
                        <ParticipantTile
                            participant={{
                                name: 'You',
                                isVideoEnabled: true,
                                isAudioEnabled: true,
                                role: 'host'
                            }}
                            isLocal={true}
                            stream={localStream}
                            className="aspect-video"
                        />
                    )}

                    {/* Remote participants */}
                    {participants.map((participant) => (
                        <ParticipantTile
                            key={participant.id}
                            participant={participant}
                            stream={participant.stream}
                            className="aspect-video"
                        />
                    ))}
                </div>
            </div>
        );
    }

    // Regular grid layout
    return (
        <div className="h-full p-4">
            <div className={`grid ${getGridLayout(totalParticipants)} gap-4 h-full`}>
                {/* Local participant */}
                {localStream && (
                    <ParticipantTile
                        participant={{
                            name: 'You',
                            isVideoEnabled: true,
                            isAudioEnabled: true,
                            role: 'host'
                        }}
                        isLocal={true}
                        stream={localStream}
                        className="min-h-0"
                    />
                )}

                {/* Remote participants */}
                {participants.map((participant) => (
                    <ParticipantTile
                        key={participant.id}
                        participant={participant}
                        stream={participant.stream}
                        className="min-h-0"
                    />
                ))}

                {/* Empty slots for better visual balance */}
                {totalParticipants < 4 && Array.from({ length: 4 - totalParticipants }).map((_, index) => (
                    <div key={`empty-${index}`} className="bg-gray-800 rounded-lg opacity-30 min-h-0"></div>
                ))}
            </div>

            {/* Layout controls */}
            <div className="absolute top-4 right-4">
                <div className="bg-gray-800 rounded-lg p-2 flex space-x-2">
                    <button
                        onClick={() => setLayout('grid')}
                        className={`p-2 rounded ${layout === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                            }`}
                        title="Grid view"
                    >
                        <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                            <div className="bg-current rounded-sm"></div>
                            <div className="bg-current rounded-sm"></div>
                            <div className="bg-current rounded-sm"></div>
                            <div className="bg-current rounded-sm"></div>
                        </div>
                    </button>

                    <button
                        onClick={() => setLayout('speaker')}
                        className={`p-2 rounded ${layout === 'speaker' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                            }`}
                        title="Speaker view"
                    >
                        <div className="w-4 h-4 bg-current rounded-sm"></div>
                    </button>
                </div>
            </div>

            {/* Participant count */}
            {totalParticipants > 1 && (
                <div className="absolute top-4 left-4">
                    <div className="bg-gray-800 rounded-lg px-3 py-2 text-white text-sm">
                        {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParticipantGrid;