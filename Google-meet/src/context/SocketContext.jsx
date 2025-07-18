import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const SocketContext = createContext()

export const useSocket = () => {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider')
    }
    return context
}

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null)
    const [isConnected, setIsConnected] = useState(false)

    useEffect(() => {
        const newSocket = io('http://localhost:4000', {
            transports: ['websocket']
        })

        newSocket.on('connect', () => {
            console.log('Connected to server')
            setIsConnected(true)
        })

        newSocket.on('disconnect', () => {
            console.log('Disconnected from server')
            setIsConnected(false)
        })

        setSocket(newSocket)

        return () => {
            newSocket.close()
        }
    }, [])

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    )
}