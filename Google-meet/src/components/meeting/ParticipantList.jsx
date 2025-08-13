import { useState } from 'react';
import {
    X, Search, MoreVertical, Mic, MicOff, Video, VideoOff,
    Crown, Shield, User, UserX, Volume2, VolumeX, Phone
} from 'lucide-react';

const ParticipantItem = ({ participant, currentUser, onAction, isHost = false }) => {
    const [showActions, setShowActions] = useState(false);

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
                return <Crown className="h-4 w-4 text-yellow-400" />;
            case 'moderator':
                return <Shield className="h-4 w-4 text-blue-400" />;
            default:
                return null;
        }
    };

    const canManageParticipant = () => {
        if (participant.id === currentUser?.id) return false;
        return currentUser?.role === 'host' || currentUser?.role === 'moderator';
    };

    return (
        <div className="flex items-center justify-between p-3 hover:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                        {getInitials(participant.name)}
                    </span>
                </div>

                {/* Name and status */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-sm font-medium truncate">
                            {participant.name}
                            {participant.id === currentUser?.id && ' (You)'}
                        </span>
                        {getRoleIcon(participant.role)}
                    </div>

                    {/* Connection status */}
                    <div className="flex items-center space-x-1 mt-1">
                        <div className={`w-2 h-2 rounded-full ${participant.connectionStatus === 'connected' ? 'bg-green-500' :
                                participant.connectionStatus === 'connecting' ? 'bg-yellow-500' :
                                    'bg-red-500'
                            }`}></div>
                        <span className="text-xs text-gray-400 capitalize">
                            {participant.connectionStatus || 'connected'}
                        </span>
                    </div>
                </div>

                {/* Media status */}
                <div className="flex items-center space-x-1">
                    <div className={`p-1 rounded ${participant.isAudioEnabled ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {participant.isAudioEnabled ? (
                            <Mic className="h-3 w-3" />
                        ) : (
                            <MicOff className="h-3 w-3" />
                        )}
                    </div>

                    <div className={`p-1 rounded ${participant.isVideoEnabled ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {participant.isVideoEnabled ? (
                            <Video className="h-3 w-3" />
                        ) : (
                            <VideoOff className="h-3 w-3" />
                        )}
                    </div>
                </div>
            </div>

            {/* Actions menu */}
            {canManageParticipant() && (
                <div className="relative">
                    <button
                        onClick={() => setShowActions(!showActions)}
                        className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </button>

                    {showActions && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg shadow-lg py-2 min-w-48 z-10">
                            {/* Mute/Unmute */}
                            <button
                                onClick={() => {
                                    onAction('toggleAudio', participant.id);
                                    setShowActions(false);
                                }}
                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center"
                            >
                                {participant.isAudioEnabled ? (
                                    <>
                                        <MicOff className="h-4 w-4 mr-3" />
                                        Mute participant
                                    </>
                                ) : (
                                    <>
                                        <Mic className="h-4 w-4 mr-3" />
                                        Ask to unmute
                                    </>
                                )}
                            </button>

                            {/* Disable/Enable video */}
                            <button
                                onClick={() => {
                                    onAction('toggleVideo', participant.id);
                                    setShowActions(false);
                                }}
                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center"
                            >
                                {participant.isVideoEnabled ? (
                                    <>
                                        <VideoOff className="h-4 w-4 mr-3" />
                                        Turn off video
                                    </>
                                ) : (
                                    <>
                                        <Video className="h-4 w-4 mr-3" />
                                        Ask to turn on video
                                    </>
                                )}
                            </button>

                            <div className="border-t border-gray-700 my-1"></div>

                            {/* Make moderator */}
                            {participant.role === 'participant' && currentUser?.role === 'host' && (
                                <button
                                    onClick={() => {
                                        onAction('makeModerator', participant.id);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center"
                                >
                                    <Shield className="h-4 w-4 mr-3" />
                                    Make moderator
                                </button>
                            )}

                            {/* Remove moderator */}
                            {participant.role === 'moderator' && currentUser?.role === 'host' && (
                                <button
                                    onClick={() => {
                                        onAction('removeModerator', participant.id);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center"
                                >
                                    <User className="h-4 w-4 mr-3" />
                                    Remove moderator
                                </button>
                            )}

                            <div className="border-t border-gray-700 my-1"></div>

                            {/* Remove from meeting */}
                            <button
                                onClick={() => {
                                    if (window.confirm(`Remove ${participant.name} from the meeting?`)) {
                                        onAction('removeParticipant', participant.id);
                                    }
                                    setShowActions(false);
                                }}
                                className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center"
                            >
                                <UserX className="h-4 w-4 mr-3" />
                                Remove from meeting
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ParticipantList = ({ participants = [], currentUser, meetingId, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showInvite, setShowInvite] = useState(false);

    // Filter participants based on search
    const filteredParticipants = participants.filter(participant =>
        participant.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleParticipantAction = async (action, participantId) => {
        try {
            const response = await fetch(`/api/meetings/${meetingId}/participants/${participantId}/${action}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Action failed');
            }

            // The action result will be handled by WebSocket updates
        } catch (error) {
            console.error('Participant action failed:', error);
        }
    };

    const muteAll = async () => {
        if (window.confirm('Mute all participants?')) {
            try {
                await fetch(`/api/meetings/${meetingId}/participants/mute-all`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                    }
                });
            } catch (error) {
                console.error('Failed to mute all:', error);
            }
        }
    };

    const isHost = currentUser?.role === 'host';
    const isModerator = currentUser?.role === 'moderator' || isHost;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-medium">
                        Participants ({participants.length})
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search participants..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Host controls */}
            {isModerator && (
                <div className="p-4 border-b border-gray-700">
                    <div className="flex space-x-2">
                        <button
                            onClick={muteAll}
                            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                        >
                            <MicOff className="h-4 w-4 inline mr-2" />
                            Mute All
                        </button>

                        <button
                            onClick={() => setShowInvite(true)}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                            Invite
                        </button>
                    </div>
                </div>
            )}

            {/* Participants list */}
            <div className="flex-1 overflow-y-auto">
                {filteredParticipants.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">
                        {searchTerm ? 'No participants found' : 'No participants yet'}
                    </div>
                ) : (
                    <div className="p-2">
                        {filteredParticipants.map((participant) => (
                            <ParticipantItem
                                key={participant.id}
                                participant={participant}
                                currentUser={currentUser}
                                onAction={handleParticipantAction}
                                isHost={isHost}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Invite modal */}
            {showInvite && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-white font-medium">Invite Participants</h4>
                            <button
                                onClick={() => setShowInvite(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-300 mb-2">
                                    Meeting Link
                                </label>
                                <div className="flex">
                                    <input
                                        type="text"
                                        value={window.location.href}
                                        readOnly
                                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-l-lg border border-gray-600"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(window.location.href);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-300 mb-2">
                                    Invite by Email
                                </label>
                                <input
                                    type="email"
                                    placeholder="Enter email address"
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                />
                                <button className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    Send Invitation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParticipantList;