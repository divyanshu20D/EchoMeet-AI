import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

const NotificationItem = ({ notification, onClose }) => {
    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-400" />;
            case 'error':
                return <AlertCircle className="h-5 w-5 text-red-400" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
            case 'info':
            default:
                return <Info className="h-5 w-5 text-blue-400" />;
        }
    };

    const getBackgroundColor = (type) => {
        switch (type) {
            case 'success':
                return 'bg-green-900 border-green-700';
            case 'error':
                return 'bg-red-900 border-red-700';
            case 'warning':
                return 'bg-yellow-900 border-yellow-700';
            case 'info':
            default:
                return 'bg-blue-900 border-blue-700';
        }
    };

    return (
        <div className={`max-w-sm w-full rounded-lg border p-4 shadow-lg ${getBackgroundColor(notification.type)} transform transition-all duration-300 ease-in-out`}>
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    {getIcon(notification.type)}
                </div>
                <div className="ml-3 w-0 flex-1">
                    {notification.title && (
                        <p className="text-sm font-medium text-white">
                            {notification.title}
                        </p>
                    )}
                    <p className={`text-sm text-gray-300 ${notification.title ? 'mt-1' : ''}`}>
                        {notification.message}
                    </p>
                    {notification.action && (
                        <div className="mt-3">
                            <button
                                onClick={notification.action.onClick}
                                className="text-sm font-medium text-blue-400 hover:text-blue-300"
                            >
                                {notification.action.label}
                            </button>
                        </div>
                    )}
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                    <button
                        onClick={() => onClose(notification.id)}
                        className="rounded-md inline-flex text-gray-400 hover:text-white focus:outline-none"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    // Add notification
    const addNotification = useCallback((notification) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const newNotification = {
            id,
            type: 'info',
            duration: 5000,
            ...notification
        };

        setNotifications(prev => [...prev, newNotification]);

        // Auto remove after duration
        if (newNotification.duration > 0) {
            setTimeout(() => {
                removeNotification(id);
            }, newNotification.duration);
        }

        return id;
    }, []);

    // Remove notification
    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, []);

    // Clear all notifications
    const clearAllNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    // Convenience methods
    const showSuccess = useCallback((message, options = {}) => {
        return addNotification({
            type: 'success',
            message,
            ...options
        });
    }, [addNotification]);

    const showError = useCallback((message, options = {}) => {
        return addNotification({
            type: 'error',
            message,
            duration: 7000, // Longer duration for errors
            ...options
        });
    }, [addNotification]);

    const showWarning = useCallback((message, options = {}) => {
        return addNotification({
            type: 'warning',
            message,
            ...options
        });
    }, [addNotification]);

    const showInfo = useCallback((message, options = {}) => {
        return addNotification({
            type: 'info',
            message,
            ...options
        });
    }, [addNotification]);

    const value = {
        notifications,
        addNotification,
        removeNotification,
        clearAllNotifications,
        showSuccess,
        showError,
        showWarning,
        showInfo
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}

            {/* Notification Container */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {notifications.map((notification) => (
                    <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClose={removeNotification}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
};