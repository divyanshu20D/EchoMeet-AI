import { useState, useEffect, useRef } from 'react';
import { X, Send, Smile, Paperclip, MoreVertical } from 'lucide-react';

const ChatMessage = ({ message, currentUser, onReply, onReact }) => {
    const [showActions, setShowActions] = useState(false);
    const isOwnMessage = message.senderId === currentUser?.id;

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getInitials = (name) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4 group`}>
            <div className={`flex max-w-xs lg:max-w-md ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                {!isOwnMessage && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mr-3">
                        <span className="text-white text-xs font-bold">
                            {getInitials(message.senderName)}
                        </span>
                    </div>
                )}

                {/* Message content */}
                <div className={`relative ${isOwnMessage ? 'mr-3' : ''}`}>
                    {/* Sender name and time */}
                    {!isOwnMessage && (
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-medium text-gray-300">
                                {message.senderName}
                            </span>
                            <span className="text-xs text-gray-500">
                                {formatTime(message.timestamp)}
                            </span>
                        </div>
                    )}

                    {/* Message bubble */}
                    <div className={`rounded-lg px-4 py-2 ${isOwnMessage
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-white'
                        }`}>
                        {/* Reply indicator */}
                        {message.replyTo && (
                            <div className="border-l-2 border-gray-400 pl-2 mb-2 text-sm opacity-75">
                                <div className="font-medium">{message.replyTo.senderName}</div>
                                <div className="truncate">{message.replyTo.content}</div>
                            </div>
                        )}

                        {/* Message content */}
                        <div className="text-sm">
                            {message.content}
                        </div>

                        {/* Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {message.reactions.map((reaction, index) => (
                                    <button
                                        key={index}
                                        onClick={() => onReact(message.id, reaction.emoji)}
                                        className="bg-gray-600 rounded-full px-2 py-1 text-xs flex items-center space-x-1 hover:bg-gray-500"
                                    >
                                        <span>{reaction.emoji}</span>
                                        <span>{reaction.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Own message time */}
                    {isOwnMessage && (
                        <div className="text-xs text-gray-500 mt-1 text-right">
                            {formatTime(message.timestamp)}
                        </div>
                    )}

                    {/* Message actions */}
                    <div className={`absolute top-0 ${isOwnMessage ? 'left-0' : 'right-0'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="p-1 bg-gray-600 rounded-full text-white hover:bg-gray-500"
                        >
                            <MoreVertical className="h-3 w-3" />
                        </button>

                        {showActions && (
                            <div className={`absolute top-full mt-1 ${isOwnMessage ? 'left-0' : 'right-0'} bg-gray-800 rounded-lg shadow-lg py-2 min-w-32 z-10`}>
                                <button
                                    onClick={() => {
                                        onReply(message);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-1 text-left text-white hover:bg-gray-700 text-sm"
                                >
                                    Reply
                                </button>
                                <button
                                    onClick={() => {
                                        onReact(message.id, '👍');
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-1 text-left text-white hover:bg-gray-700 text-sm"
                                >
                                    React
                                </button>
                                {isOwnMessage && (
                                    <button
                                        onClick={() => {
                                            // Delete message
                                            setShowActions(false);
                                        }}
                                        className="w-full px-3 py-1 text-left text-red-400 hover:bg-gray-700 text-sm"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChatPanel = ({ meetingId, currentUser, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Sample messages for demo
    useEffect(() => {
        setMessages([
            {
                id: '1',
                senderId: 'user1',
                senderName: 'John Doe',
                content: 'Hello everyone! Thanks for joining the meeting.',
                timestamp: Date.now() - 300000,
                reactions: [{ emoji: '👍', count: 2 }]
            },
            {
                id: '2',
                senderId: currentUser?.id,
                senderName: currentUser?.name || 'You',
                content: 'Hi John! Happy to be here.',
                timestamp: Date.now() - 240000
            },
            {
                id: '3',
                senderId: 'user2',
                senderName: 'Jane Smith',
                content: 'Can everyone see my screen?',
                timestamp: Date.now() - 180000
            }
        ]);
    }, [currentUser]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim()) return;

        const message = {
            id: Date.now().toString(),
            senderId: currentUser?.id,
            senderName: currentUser?.name || 'You',
            content: newMessage.trim(),
            timestamp: Date.now(),
            replyTo: replyTo
        };

        // Add message locally (in real app, this would be handled by WebSocket)
        setMessages(prev => [...prev, message]);
        setNewMessage('');
        setReplyTo(null);

        // In real implementation, send via WebSocket
        try {
            // await sendChatMessage(meetingId, message);
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    const handleReply = (message) => {
        setReplyTo({
            id: message.id,
            senderName: message.senderName,
            content: message.content
        });
        inputRef.current?.focus();
    };

    const handleReact = async (messageId, emoji) => {
        // In real implementation, this would update via WebSocket
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId) {
                const reactions = msg.reactions || [];
                const existingReaction = reactions.find(r => r.emoji === emoji);

                if (existingReaction) {
                    existingReaction.count += 1;
                } else {
                    reactions.push({ emoji, count: 1 });
                }

                return { ...msg, reactions };
            }
            return msg;
        }));
    };

    const handleTyping = () => {
        if (!isTyping) {
            setIsTyping(true);
            // In real implementation, emit typing event via WebSocket

            setTimeout(() => {
                setIsTyping(false);
            }, 3000);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Chat</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-8">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No messages yet</p>
                        <p className="text-sm">Start the conversation!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <ChatMessage
                                key={message.id}
                                message={message}
                                currentUser={currentUser}
                                onReply={handleReply}
                                onReact={handleReact}
                            />
                        ))}

                        {/* Typing indicator */}
                        {typingUsers.length > 0 && (
                            <div className="flex items-center space-x-2 text-gray-400 text-sm">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                                <span>
                                    {typingUsers.length === 1
                                        ? `${typingUsers[0]} is typing...`
                                        : `${typingUsers.length} people are typing...`
                                    }
                                </span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Reply indicator */}
            {replyTo && (
                <div className="px-4 py-2 bg-gray-700 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <div className="text-gray-300">Replying to {replyTo.senderName}</div>
                            <div className="text-gray-400 truncate">{replyTo.content}</div>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="text-gray-400 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Message input */}
            <div className="p-4 border-t border-gray-700">
                <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                    <div className="flex-1">
                        <textarea
                            ref={inputRef}
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                handleTyping();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder="Type a message..."
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                            rows="1"
                            style={{ minHeight: '40px', maxHeight: '120px' }}
                        />
                    </div>

                    {/* Message actions */}
                    <div className="flex items-center space-x-1">
                        <button
                            type="button"
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                            title="Add emoji"
                        >
                            <Smile className="h-5 w-5" />
                        </button>

                        <button
                            type="button"
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                            title="Attach file"
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>

                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Send message"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChatPanel;