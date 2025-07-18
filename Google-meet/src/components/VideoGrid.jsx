import { useEffect, useRef } from 'react'

const VideoGrid = ({
    localVideoRef,
    localStream,
    remoteStreams,
    participants,
    currentUser,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing
}) => {
    const getGridClass = () => {
        const totalParticipants = participants.length

        if (totalParticipants <= 1) return 'grid-cols-1'
        if (totalParticipants <= 4) return 'grid-cols-2'
        if (totalParticipants <= 9) return 'grid-cols-3'
        return 'grid-cols-4'
    }

    return (
        <div className="h-full p-4">
            <div className={`grid ${getGridClass()} gap-4 h-full`}>
                {/* Local Video */}
                <div className="participant-video relative">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full video-element local-video"
                    />

                    {/* User Info Overlay */}
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
                        {currentUser?.userName} (You)
                    </div>

                    {/* Muted Indicators */}
                    <div className="absolute top-2 right-2 flex space-x-1">
                        {isAudioMuted && (
                            <div className="bg-red-600 p-1 rounded">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                </svg>
                            </div>
                        )}

                        {isVideoMuted && (
                            <div className="bg-red-600 p-1 rounded">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </div>
                        )}

                        {isScreenSharing && (
                            <div className="bg-green-600 p-1 rounded">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Video Off Placeholder */}
                    {isVideoMuted && (
                        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white text-xl font-semibold">
                                        {currentUser?.userName?.charAt(0)?.toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-white text-sm">{currentUser?.userName}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Remote Participants */}
                {participants
                    .filter(p => p.userId !== currentUser?.userId)
                    .map((participant) => (
                        <ParticipantVideo
                            key={participant.userId}
                            participant={participant}
                            remoteStream={remoteStreams?.get(participant.userId)}
                        />
                    ))}
            </div>

            {/* No other participants message */}
            {participants.length <= 1 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-gray-400">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <p className="text-lg">Waiting for others to join...</p>
                        <p className="text-sm mt-2">Share the room ID to invite participants</p>
                    </div>
                </div>
            )}
        </div>
    )
}

const ParticipantVideo = ({ participant, remoteStream }) => {
    const videoRef = useRef(null)

    useEffect(() => {
        if (videoRef.current && remoteStream) {
            videoRef.current.srcObject = remoteStream
        }
    }, [remoteStream])

    return (
        <div className="participant-video relative">
            {remoteStream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full video-element"
                />
            ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-white text-xl font-semibold">
                                {participant.name?.charAt(0)?.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-white text-sm">{participant.name}</p>
                        <p className="text-gray-400 text-xs">Connecting...</p>
                    </div>
                </div>
            )}

            {/* Video Off Placeholder */}
            {participant.isVideoMuted && remoteStream && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-white text-xl font-semibold">
                                {participant.name?.charAt(0)?.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-white text-sm">{participant.name}</p>
                    </div>
                </div>
            )}

            {/* User Info Overlay */}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm flex items-center space-x-1">
                <span>{participant.name}</span>
                {participant.isHost && (
                    <span className="bg-blue-600 px-1 rounded text-xs">Host</span>
                )}
            </div>

            {/* Muted Indicators */}
            <div className="absolute top-2 right-2 flex space-x-1">
                {participant.isAudioMuted && (
                    <div className="bg-red-600 p-1 rounded">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                    </div>
                )}

                {participant.isVideoMuted && (
                    <div className="bg-red-600 p-1 rounded">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </div>
                )}

                {participant.isScreenSharing && (
                    <div className="bg-green-600 p-1 rounded">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    )
}

export default VideoGrid