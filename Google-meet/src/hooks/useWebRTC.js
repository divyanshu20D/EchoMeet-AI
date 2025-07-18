import { useEffect, useRef, useState } from 'react'
import { useSocket } from '../context/SocketContext'

const useWebRTC = (roomData, localStream) => {
    const { socket } = useSocket()
    const [remoteStreams, setRemoteStreams] = useState(new Map())
    const peersRef = useRef(new Map())
    const localStreamRef = useRef(localStream)

    // Update local stream ref when it changes
    useEffect(() => {
        localStreamRef.current = localStream
    }, [localStream])

    useEffect(() => {
        if (!socket || !roomData || !localStream) return

        // WebRTC Configuration
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }

        // Handle new user joining - create offer for new user
        const handleUserJoined = async (data) => {
            console.log('User joined, creating offer for:', data.userId)

            if (data.userId !== roomData.userId) {
                // Create peer connection and send offer to new user
                setTimeout(async () => {
                    try {
                        const peerConnection = createPeerConnection(data.userId, configuration)
                        peersRef.current.set(data.userId, peerConnection)

                        const offer = await peerConnection.createOffer()
                        await peerConnection.setLocalDescription(offer)

                        socket.emit('offer', {
                            target: data.userId,
                            offer: offer
                        })
                    } catch (error) {
                        console.error('Error creating offer for new user:', error)
                    }
                }, 1000) // Small delay to ensure the new user is ready
            }
        }

        // When we join a room, create offers for existing participants
        const handleJoinedRoom = async (data) => {
            console.log('Joined room, existing participants:', data.participants)

            // Create offers for all existing participants (except ourselves)
            const otherParticipants = data.participants.filter(p => p.userId !== roomData.userId)

            for (const participant of otherParticipants) {
                // We'll create peer connection when we get their socket info
                // For now, let's trigger the offer creation after a small delay
                setTimeout(async () => {
                    try {
                        const peerConnection = createPeerConnection(participant.userId, configuration)
                        peersRef.current.set(participant.userId, peerConnection)

                        const offer = await peerConnection.createOffer()
                        await peerConnection.setLocalDescription(offer)

                        // Send offer to the specific participant
                        // Note: We need to send to their socket ID, but we only have userId
                        // The server will need to handle this mapping
                        socket.emit('offer', {
                            target: participant.userId,
                            offer: offer
                        })
                    } catch (error) {
                        console.error('Error creating offer for existing participant:', error)
                    }
                }, 1000)
            }
        }

        // Handle receiving offer
        const handleOffer = async (data) => {
            console.log('Received offer from:', data.senderUserId)

            const peerConnection = createPeerConnection(data.senderUserId, configuration)
            peersRef.current.set(data.senderUserId, peerConnection)

            try {
                await peerConnection.setRemoteDescription(data.offer)
                const answer = await peerConnection.createAnswer()
                await peerConnection.setLocalDescription(answer)

                socket.emit('answer', {
                    target: data.senderUserId,
                    answer: answer
                })
            } catch (error) {
                console.error('Error handling offer:', error)
            }
        }

        // Handle receiving answer
        const handleAnswer = async (data) => {
            console.log('Received answer from:', data.senderUserId)

            const peerConnection = peersRef.current.get(data.senderUserId)
            if (peerConnection) {
                try {
                    await peerConnection.setRemoteDescription(data.answer)
                } catch (error) {
                    console.error('Error handling answer:', error)
                }
            }
        }

        // Handle ICE candidate
        const handleIceCandidate = async (data) => {
            const peerConnection = peersRef.current.get(data.senderUserId)
            if (peerConnection) {
                try {
                    await peerConnection.addIceCandidate(data.candidate)
                } catch (error) {
                    console.error('Error adding ICE candidate:', error)
                }
            }
        }

        // Handle user leaving
        const handleUserLeft = (data) => {
            console.log('User left:', data.userId)

            const peerConnection = peersRef.current.get(data.userId)
            if (peerConnection) {
                peerConnection.close()
                peersRef.current.delete(data.userId)
            }

            setRemoteStreams(prev => {
                const newStreams = new Map(prev)
                newStreams.delete(data.userId)
                return newStreams
            })
        }

        // Socket event listeners
        socket.on('joined-room', handleJoinedRoom)
        socket.on('user-joined', handleUserJoined)
        socket.on('offer', handleOffer)
        socket.on('answer', handleAnswer)
        socket.on('ice-candidate', handleIceCandidate)
        socket.on('user-left', handleUserLeft)

        return () => {
            socket.off('joined-room', handleJoinedRoom)
            socket.off('user-joined', handleUserJoined)
            socket.off('offer', handleOffer)
            socket.off('answer', handleAnswer)
            socket.off('ice-candidate', handleIceCandidate)
            socket.off('user-left', handleUserLeft)

            // Cleanup peer connections
            peersRef.current.forEach(pc => pc.close())
            peersRef.current.clear()
        }
    }, [socket, roomData, localStream])

    const createPeerConnection = (userId, configuration) => {
        const peerConnection = new RTCPeerConnection(configuration)

        // Add local stream tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStreamRef.current)
            })
        }

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote stream from:', userId)
            const [remoteStream] = event.streams

            setRemoteStreams(prev => {
                const newStreams = new Map(prev)
                newStreams.set(userId, remoteStream)
                return newStreams
            })
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    target: userId,
                    candidate: event.candidate
                })
            }
        }

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state with ${userId}:`, peerConnection.connectionState)
        }

        return peerConnection
    }

    const updateLocalStream = (newStream) => {
        localStreamRef.current = newStream

        // Update all peer connections with new stream
        peersRef.current.forEach((peerConnection, userId) => {
            // Remove old tracks
            peerConnection.getSenders().forEach(sender => {
                peerConnection.removeTrack(sender)
            })

            // Add new tracks
            if (newStream) {
                newStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, newStream)
                })
            }
        })
    }

    return {
        remoteStreams,
        updateLocalStream
    }
}

export default useWebRTC