import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/socketService';

export const useChat = (meetingId, userId, userName) => {
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);

    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    // Initialize chat
    useEffect(() => {
        if (!meetingId || !userId) return;

        // Socket event listeners
        const handleSocketConnected = () => {
            setIsConnected(true);
        };

        const handleSocketDisconnected = () => {
            setIsConnected(false);
        };

        const handleChatMessage = (data) => {
            const { message, userId: senderId, userName: senderName, timestamp, messageId } = data;

            const newMessage = {
                id: messageId || Date.now().toString(),
                content: message,
                senderId,
                senderName: senderName || 'Unknown User',
                timestamp: timestamp || Date.now(),
                type: 'text'
            };

            setMessages(prev => [...prev, newMessage]);
        };

        const handleChatTyping = (data) => {
            const { userId: typingUserId, userName: typingUserName } = data;

            if (typingUserId !== userId) {
                setTypingUsers(prev => new Set(prev.add(typingUserName || 'Someone')));

                // Clear typing indicator after 3 seconds
                setTimeout(() => {
                    setTypingUsers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(typingUserName || 'Someone');
                        return newSet;
                    });
                }, 3000);
            }
        };

        const handleChatStopTyping = (data) => {
            const { userName: typingUserName } = data;

            setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(typingUserName || 'Someone');
                return newSet;
            });
        };

        const handleSocketError = (error) => {
            setError(error);
        };

        // Register event listeners
        socketService.on('connected', handleSocketConnected);
        socketService.on('disconnected', handleSocketDisconnected);
        socketService.on('chatMessage', handleChatMessage);
        socketService.on('chatTyping', handleChatTyping);
        socketService.on('chatStopTyping', handleChatStopTyping);
        socketService.on('error', handleSocketError);

        // Check if already connected
        if (socketService.isSocketConnected()) {
            setIsConnected(true);
        }

        // Cleanup
        return () => {
            socketService.off('connected', handleSocketConnected);
            socketService.off('disconnected', handleSocketDisconnected);
            socketService.off('chatMessage', handleChatMessage);
            socketService.off('chatTyping', handleChatTyping);
            socketService.off('chatStopTyping', handleChatStopTyping);
            socketService.off('error', handleSocketError);

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [meetingId, userId]);

    // Send message
    const sendMessage = useCallback((content, type = 'text', replyTo = null) => {
        if (!content.trim() || !isConnected) {
            return false;
        }

        const messageData = {
            content: content.trim(),
            type,
            replyTo,
            timestamp: Date.now()
        };

        socketService.sendChatMessage(messageData);

        // Stop typing indicator
        if (isTypingRef.current) {
            socketService.stopTyping();
            isTypingRef.current = false;
        }

        return true;
    }, [isConnected]);

    // Handle typing
    const handleTyping = useCallback(() => {
        if (!isConnected) return;

        // Send typing indicator if not already typing
        if (!isTypingRef.current) {
            socketService.sendTyping();
            isTypingRef.current = true;
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
            if (isTypingRef.current) {
                socketService.stopTyping();
                isTypingRef.current = false;
            }
        }, 3000);
    }, [isConnected]);

    // Stop typing
    const stopTyping = useCallback(() => {
        if (isTypingRef.current) {
            socketService.stopTyping();
            isTypingRef.current = false;
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    }, []);

    // Send reaction
    const sendReaction = useCallback((messageId, emoji) => {
        if (!isConnected) return false;

        // For now, we'll add this as a special message type
        // In a full implementation, this would be handled differently
        const reactionData = {
            content: emoji,
            type: 'reaction',
            targetMessageId: messageId,
            timestamp: Date.now()
        };

        socketService.sendChatMessage(reactionData);
        return true;
    }, [isConnected]);

    // Send file (placeholder for future implementation)
    const sendFile = useCallback((file) => {
        if (!isConnected) return false;

        // This would involve uploading the file first, then sending a message with the file URL
        console.log('File sending not implemented yet:', file);
        return false;
    }, [isConnected]);

    // Clear messages
    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    // Get message by ID
    const getMessageById = useCallback((messageId) => {
        return messages.find(msg => msg.id === messageId);
    }, [messages]);

    // Get messages by type
    const getMessagesByType = useCallback((type) => {
        return messages.filter(msg => msg.type === type);
    }, [messages]);

    // Get messages from user
    const getMessagesFromUser = useCallback((userId) => {
        return messages.filter(msg => msg.senderId === userId);
    }, [messages]);

    // Search messages
    const searchMessages = useCallback((query) => {
        if (!query.trim()) return [];

        const lowercaseQuery = query.toLowerCase();
        return messages.filter(msg =>
            msg.content.toLowerCase().includes(lowercaseQuery) ||
            msg.senderName.toLowerCase().includes(lowercaseQuery)
        );
    }, [messages]);

    // Get typing users as array
    const getTypingUsers = useCallback(() => {
        return Array.from(typingUsers);
    }, [typingUsers]);

    // Format typing text
    const getTypingText = useCallback(() => {
        const users = Array.from(typingUsers);

        if (users.length === 0) {
            return '';
        } else if (users.length === 1) {
            return `${users[0]} is typing...`;
        } else if (users.length === 2) {
            return `${users[0]} and ${users[1]} are typing...`;
        } else {
            return `${users.length} people are typing...`;
        }
    }, [typingUsers]);

    // Get message statistics
    const getMessageStats = useCallback(() => {
        const stats = {
            total: messages.length,
            byType: {},
            byUser: {},
            recent: messages.filter(msg => Date.now() - msg.timestamp < 5 * 60 * 1000).length // Last 5 minutes
        };

        messages.forEach(msg => {
            // Count by type
            stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;

            // Count by user
            stats.byUser[msg.senderId] = (stats.byUser[msg.senderId] || 0) + 1;
        });

        return stats;
    }, [messages]);

    return {
        // State
        messages,
        typingUsers: getTypingUsers(),
        isConnected,
        error,

        // Actions
        sendMessage,
        sendReaction,
        sendFile,
        handleTyping,
        stopTyping,
        clearMessages,

        // Getters
        getMessageById,
        getMessagesByType,
        getMessagesFromUser,
        searchMessages,
        getTypingText,
        getMessageStats,

        // Utils
        isTyping: isTypingRef.current
    };
};