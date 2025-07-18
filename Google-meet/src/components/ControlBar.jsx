const ControlBar = ({
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    isChatOpen,
    onToggleAudio,
    onToggleVideo,
    onToggleScreenShare,
    onToggleChat,
    onLeaveMeeting,
    onEndMeeting,
    isHost,
    unreadMessages
}) => {
    return (
        <div className="bg-gray-800 px-6 py-4">
            <div className="flex items-center justify-center space-x-4">
                {/* Audio Toggle */}
                <button
                    onClick={onToggleAudio}
                    className={`p-3 rounded-full transition-colors ${isAudioMuted
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                    title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                    {isAudioMuted ? (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </button>

                {/* Video Toggle */}
                <button
                    onClick={onToggleVideo}
                    className={`p-3 rounded-full transition-colors ${isVideoMuted
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                    title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
                >
                    {isVideoMuted ? (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                </button>

                {/* Screen Share Toggle */}
                <button
                    onClick={onToggleScreenShare}
                    className={`p-3 rounded-full transition-colors ${isScreenSharing
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                    title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </button>

                {/* Chat Toggle */}
                <button
                    onClick={onToggleChat}
                    className={`p-3 rounded-full transition-colors relative ${isChatOpen
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                    title="Toggle chat"
                >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>

                    {/* Unread messages indicator */}
                    {unreadMessages > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {unreadMessages > 9 ? '9+' : unreadMessages}
                        </div>
                    )}
                </button>

                {/* Divider */}
                <div className="w-px h-8 bg-gray-600"></div>

                {/* Host Controls */}
                {isHost && (
                    <button
                        onClick={onEndMeeting}
                        className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
                        title="End meeting for everyone"
                    >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                        </svg>
                    </button>
                )}

                {/* Leave Meeting */}
                <button
                    onClick={onLeaveMeeting}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors font-medium"
                    title="Leave meeting"
                >
                    Leave
                </button>
            </div>
        </div>
    )
}

export default ControlBar