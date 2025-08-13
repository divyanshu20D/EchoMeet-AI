import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../context/SocketContext'
import useWebRTC from '../hooks/useWebRTC'
import VideoGrid from './VideoGrid'
import ChatPanel from './ChatPanel'
import ControlBar from './ControlBar'
import ParticipantsList from './ParticipantsList'

const MeetingRoom = ({ roomData, onLeaveMeeting }) => {
    const { socket } = useSocket()
    const [participants, setParticipants] = useState([])
    const [localStream, setLocalStream] = useState(null)
    const [isAudioMuted, setIsAudioMuted] = useState(false)
    const [isVideoMuted, setIsVideoMuted] = useState(false)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
    const [messages, setMessages] = useState([])
    const [connectionStatus, setConnectionStatus] = useState('connecting')

    const localVideoRef = useRef(null)

    // Initialize WebRTC
    const { remoteStreams, updateLocalStream } = useWebRTC(roomData, localStream)

    useEffect(() => {
        if (!socket || !roomData) return

        // Initialize media and join room
        initializeMedia()
        joinRoom()

        // Socket event listeners
        socket.on('joined-room', handleJoinedRoom)
        socket.on('user-joined', handleUserJoined)
        socket.on('user-left', handleUserLeft)
        socket.on('user-audio-toggled', handleUserAudioToggled)
        socket.on('user-video-toggled', handleUserVideoToggled)
        socket.on('user-started-screen-share', handleUserStartedScreenShare)
        socket.on('user-stopped-screen-share', handleUserStoppedScreenShare)
        socket.on('new-message', handleNewMessage)
        socket.on('meeting-ended', handleMeetingEnded)
        socket.on('removed-from-meeting', handleRemovedFromMeeting)
        socket.on('participant-removed', handleParticipantRemoved)

        return () => {
            // Cleanup socket listeners
            socket.off('joined-room')
            socket.off('user-joined')
            socket.off('user-left')
            socket.off('user-audio-toggled')
            socket.off('user-video-toggled')
            socket.off('user-started-screen-share')
            socket.off('user-stopped-screen-share')
            socket.off('new-message')
            socket.off('meeting-ended')
            socket.off('removed-from-meeting')
            socket.off('participant-removed')

            // Stop all local stream tracks
            if (localStream) {
                localStream.getTracks().forEach(track => {
                    track.stop()
                    console.log(`Cleanup: Stopped ${track.kind} track`)
                })
            }
        }
    }, [socket, roomData])

    const initializeMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            })
            setLocalStream(stream)
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
            }
            setConnectionStatus('connected')
        } catch (error) {
            console.error('Error accessing media devices:', error)
            setConnectionStatus('error')
            alert('Could not access camera/microphone. Please check permissions.')
        }
    }

    const joinRoom = () => {
        if (socket && roomData) {
            socket.emit('join-room', {
                roomId: roomData.roomId,
                userId: roomData.userId,
                userName: roomData.userName
            })
        }
    }

    const handleJoinedRoom = (data) => {
        console.log('Joined room successfully:', data)
        setParticipants(data.participants || [])
        setConnectionStatus('joined')
    }

    const handleUserJoined = (data) => {
        console.log('User joined:', data)
        setParticipants(data.participants || [])
    }

    const handleUserLeft = (data) => {
        console.log('User left:', data)
        setParticipants(data.participants || [])
        if (data.newHost) {
            // Update host status if needed
            console.log('New host:', data.newHost)
        }
    }

    const handleUserAudioToggled = (data) => {
        setParticipants(prev =>
            prev.map(p =>
                p.userId === data.userId
                    ? { ...p, isAudioMuted: data.isAudioMuted }
                    : p
            )
        )
    }

    const handleUserVideoToggled = (data) => {
        setParticipants(prev =>
            prev.map(p =>
                p.userId === data.userId
                    ? { ...p, isVideoMuted: data.isVideoMuted }
                    : p
            )
        )
    }

    const handleUserStartedScreenShare = (data) => {
        console.log('User started screen sharing:', data)
    }

    const handleUserStoppedScreenShare = (data) => {
        console.log('User stopped screen sharing:', data)
    }

    const handleNewMessage = (message) => {
        setMessages(prev => [...prev, message])
    }

    const handleMeetingEnded = (data) => {
        // Stop all media tracks when meeting ends
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop()
                console.log(`Stopped ${track.kind} track on meeting end`)
            })
        }

        // Clear local stream reference
        setLocalStream(null)

        alert(data.message)
        onLeaveMeeting()
    }

    const handleRemovedFromMeeting = (data) => {
        // Stop all media tracks when removed from meeting
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop()
                console.log(`Stopped ${track.kind} track on removal`)
            })
        }

        // Clear local stream reference
        setLocalStream(null)

        alert(data.message)
        onLeaveMeeting()
    }

    const handleParticipantRemoved = (data) => {
        setParticipants(data.participants || [])
    }

    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0]
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled
                setIsAudioMuted(!audioTrack.enabled)

                socket.emit('toggle-audio', {
                    isAudioMuted: !audioTrack.enabled
                })
            }
        }
    }

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0]
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled
                setIsVideoMuted(!videoTrack.enabled)

                socket.emit('toggle-video', {
                    isVideoMuted: !videoTrack.enabled
                })
            }
        }
    }

    const toggleScreenShare = async () => {
        try {
            if (!isScreenSharing) {
                // Request screen sharing permission
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always',
                        displaySurface: 'monitor'
                    },
                    audio: true
                })

                // Create new stream with screen video and original audio
                const newStream = new MediaStream()

                // Add screen video track
                const screenTrack = screenStream.getVideoTracks()[0]
                newStream.addTrack(screenTrack)

                // Keep original audio track
                if (localStream) {
                    const audioTrack = localStream.getAudioTracks()[0]
                    if (audioTrack) {
                        newStream.addTrack(audioTrack)
                    }
                }

                // Update local stream
                setLocalStream(newStream)
                updateLocalStream(newStream)

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = newStream
                }

                setIsScreenSharing(true)
                socket.emit('start-screen-share')

                // Handle screen share end when user stops sharing
                screenTrack.onended = () => {
                    stopScreenShare()
                }
            } else {
                stopScreenShare()
            }
        } catch (error) {
            console.error('Error toggling screen share:', error)
            if (error.name === 'NotAllowedError') {
                alert('Screen sharing permission was denied. Please allow screen sharing and try again.')
            } else if (error.name === 'NotSupportedError') {
                alert('Screen sharing is not supported in this browser.')
            } else {
                alert('Failed to start screen sharing. Please try again.')
            }
        }
    }

    const stopScreenShare = async () => {
        try {
            // Stop current screen sharing tracks
            if (localStream) {
                localStream.getTracks().forEach(track => {
                    if (track.kind === 'video') {
                        track.stop()
                    }
                })
            }

            // Get camera stream back
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            })

            setLocalStream(cameraStream)
            updateLocalStream(cameraStream)

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = cameraStream
            }

            setIsScreenSharing(false)
            socket.emit('stop-screen-share')
        } catch (error) {
            console.error('Error stopping screen share:', error)
            alert('Failed to stop screen sharing. Please try again.')
        }
    }

    const sendMessage = (message) => {
        if (socket && message.trim()) {
            socket.emit('send-message', { message: message.trim() })
        }
    }

    const leaveMeeting = () => {
        // Stop all media tracks before leaving
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop()
                console.log(`Stopped ${track.kind} track`)
            })
        }

        // Emit leave room event
        if (socket) {
            socket.emit('leave-room')
        }

        // Clear local stream reference
        setLocalStream(null)

        // Call parent callback
        onLeaveMeeting()
    }

    const endMeeting = () => {
        if (socket && roomData.isHost) {
            if (confirm('Are you sure you want to end the meeting for everyone?')) {
                // Stop all media tracks before ending meeting
                if (localStream) {
                    localStream.getTracks().forEach(track => {
                        track.stop()
                        console.log(`Stopped ${track.kind} track`)
                    })
                }

                socket.emit('end-meeting')

                // Clear local stream reference
                setLocalStream(null)
            }
        }
    }

    const removeParticipant = (userId) => {
        if (socket && roomData.isHost) {
            if (confirm('Are you sure you want to remove this participant?')) {
                socket.emit('remove-participant', { userId })
            }
        }
    }

    if (connectionStatus === 'connecting') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white text-lg">Connecting to meeting...</p>
                </div>
            </div>
        )
    }

    if (connectionStatus === 'error') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <p className="text-white text-lg mb-4">Failed to access camera/microphone</p>
                    <button
                        onClick={onLeaveMeeting}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen bg-gray-900 flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <h1 className="text-white text-xl font-semibold">Meeting Room</h1>
                    <span className="text-gray-400 text-sm">
                        Room ID: {roomData?.roomId?.slice(0, 8)}...
                    </span>
                    {roomData?.isHost && (
                        <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                            Host
                        </span>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
                        className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                    </button>

                    <span className="text-gray-400 text-sm">
                        {participants.length} participant{participants.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex">
                {/* Video Area */}
                <div className="flex-1 relative">
                    <VideoGrid
                        localVideoRef={localVideoRef}
                        localStream={localStream}
                        remoteStreams={remoteStreams}
                        participants={participants}
                        currentUser={roomData}
                        isAudioMuted={isAudioMuted}
                        isVideoMuted={isVideoMuted}
                        isScreenSharing={isScreenSharing}
                    />
                </div>

                {/* Chat Panel */}
                {isChatOpen && (
                    <ChatPanel
                        messages={messages}
                        onSendMessage={sendMessage}
                        onClose={() => setIsChatOpen(false)}
                        currentUser={roomData}
                    />
                )}

                {/* Participants Panel */}
                {isParticipantsOpen && (
                    <ParticipantsList
                        participants={participants}
                        currentUser={roomData}
                        onRemoveParticipant={removeParticipant}
                        onClose={() => setIsParticipantsOpen(false)}
                    />
                )}
            </div>

            {/* Control Bar */}
            <ControlBar
                isAudioMuted={isAudioMuted}
                isVideoMuted={isVideoMuted}
                isScreenSharing={isScreenSharing}
                isChatOpen={isChatOpen}
                onToggleAudio={toggleAudio}
                onToggleVideo={toggleVideo}
                onToggleScreenShare={toggleScreenShare}
                onToggleChat={() => setIsChatOpen(!isChatOpen)}
                onLeaveMeeting={leaveMeeting}
                onEndMeeting={endMeeting}
                isHost={roomData?.isHost}
                unreadMessages={0} // TODO: implement unread count
            />
        </div>
    )
}

export default MeetingRoom