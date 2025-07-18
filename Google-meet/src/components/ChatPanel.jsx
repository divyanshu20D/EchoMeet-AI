import { useState, useRef, useEffect } from 'react'

const ChatPanel = ({ messages, onSendMessage, onClose, currentUser }) => {
    const [newMessage, setNewMessage] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        // Focus input when chat opens
        if (inputRef.current) {
            inputRef.current.focus()
        }
    }, [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleSendMessage = (e) => {
        e.preventDefault()
        if (newMessage.trim()) {
            onSendMessage(newMessage)
            setNewMessage('')
        }
    }

    const handleInputChange = (e) => {
        setNewMessage(e.target.value)

        // Handle typing indicator (simplified)
        if (!isTyping && e.target.value.trim()) {
            setIsTyping(true)
            // In a real implementation, you'd emit typing events to other users
        } else if (isTyping && !e.target.value.trim()) {
            setIsTyping(false)
        }
    }

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Chat</h3>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 p-1 rounded"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p>No messages yet</p>
                        <p className="text-sm mt-1">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div key={message.id} className="space-y-1">
                            <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm text-gray-800">
                                    {message.userName}
                                </span>
                                {message.isHost && (
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                        Host
                                    </span>
                                )}
                                <span className="text-xs text-gray-500">
                                    {formatTime(message.timestamp)}
                                </span>
                            </div>
                            <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-800">
                                {message.message}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        maxLength={500}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>

                {/* Character count */}
                <div className="text-xs text-gray-500 mt-1 text-right">
                    {newMessage.length}/500
                </div>
            </div>
        </div>
    )
}

export default ChatPanel