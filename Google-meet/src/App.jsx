import { useState, useEffect } from 'react'
import './App.css'
import HomePage from './components/HomePage'
import MeetingRoom from './components/MeetingRoom'
import { SocketProvider } from './context/SocketContext'

function App() {
  const [currentView, setCurrentView] = useState('home') // 'home' or 'meeting'
  const [roomData, setRoomData] = useState(null)

  const handleJoinMeeting = (data) => {
    setRoomData(data)
    setCurrentView('meeting')
  }

  const handleLeaveMeeting = () => {
    setRoomData(null)
    setCurrentView('home')
  }

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-900">
        {currentView === 'home' ? (
          <HomePage onJoinMeeting={handleJoinMeeting} />
        ) : (
          <MeetingRoom
            roomData={roomData}
            onLeaveMeeting={handleLeaveMeeting}
          />
        )}
      </div>
    </SocketProvider>
  )
}

export default App
