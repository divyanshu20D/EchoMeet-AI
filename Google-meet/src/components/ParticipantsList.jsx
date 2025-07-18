const ParticipantsList = ({ participants, currentUser, onRemoveParticipant, onClose }) => {
    return (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                    Participants ({participants.length})
                </h3>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 p-1 rounded"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Participants List */}
            <div className="flex-1 overflow-y-auto">
                {participants.map((participant) => (
                    <div
                        key={participant.userId}
                        className="p-4 border-b border-gray-100 hover:bg-gray-50"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                {/* Avatar */}
                                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                                    <span className="text-white font-semibold">
                                        {participant.name?.charAt(0)?.toUpperCase()}
                                    </span>
                                </div>

                                {/* User Info */}
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="font-medium text-gray-800">
                                            {participant.name}
                                        </span>
                                        {participant.userId === currentUser?.userId && (
                                            <span className="text-sm text-gray-500">(You)</span>
                                        )}
                                        {participant.isHost && (
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                                Host
                                            </span>
                                        )}
                                    </div>

                                    {/* Status Indicators */}
                                    <div className="flex items-center space-x-2 mt-1">
                                        {participant.isAudioMuted ? (
                                            <div className="flex items-center space-x-1 text-red-600">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                                </svg>
                                                <span className="text-xs">Muted</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-1 text-green-600">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                                <span className="text-xs">Audio on</span>
                                            </div>
                                        )}

                                        {participant.isVideoMuted ? (
                                            <div className="flex items-center space-x-1 text-red-600">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6L6 18M6 6l12 12" />
                                                </svg>
                                                <span className="text-xs">Video off</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-1 text-green-600">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                <span className="text-xs">Video on</span>
                                            </div>
                                        )}

                                        {participant.isScreenSharing && (
                                            <div className="flex items-center space-x-1 text-blue-600">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                <span className="text-xs">Sharing</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Host Actions */}
                            {currentUser?.isHost &&
                                participant.userId !== currentUser.userId &&
                                !participant.isHost && (
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={() => onRemoveParticipant(participant.userId)}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                            title="Remove participant"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                        </div>
                    </div>
                ))}

                {participants.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <p>No participants yet</p>
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                    <p className="font-medium mb-1">Meeting Info</p>
                    <p>Room ID: {currentUser?.roomId?.slice(0, 8)}...</p>
                    {currentUser?.isHost && (
                        <p className="text-blue-600 mt-2 text-xs">
                            💡 As host, you can remove participants and end the meeting
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ParticipantsList