import { createContext, useContext, useState, useCallback } from 'react';
import LoadingSpinner from '../components/common/LoadingSpinner';

const LoadingContext = createContext();

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};

export const LoadingProvider = ({ children }) => {
    const [loadingStates, setLoadingStates] = useState(new Map());
    const [globalLoading, setGlobalLoading] = useState(false);

    // Set loading state for a specific key
    const setLoading = useCallback((key, isLoading, message = 'Loading...') => {
        setLoadingStates(prev => {
            const newStates = new Map(prev);
            if (isLoading) {
                newStates.set(key, { isLoading: true, message });
            } else {
                newStates.delete(key);
            }
            return newStates;
        });
    }, []);

    // Get loading state for a specific key
    const isLoading = useCallback((key) => {
        return loadingStates.has(key);
    }, [loadingStates]);

    // Get loading message for a specific key
    const getLoadingMessage = useCallback((key) => {
        const state = loadingStates.get(key);
        return state ? state.message : '';
    }, [loadingStates]);

    // Set global loading state
    const setGlobalLoadingState = useCallback((isLoading, message = 'Loading...') => {
        setGlobalLoading(isLoading);
        if (isLoading) {
            setLoading('global', true, message);
        } else {
            setLoading('global', false);
        }
    }, [setLoading]);

    // Check if any loading state is active
    const hasAnyLoading = loadingStates.size > 0;

    // Get all active loading states
    const getActiveLoadingStates = useCallback(() => {
        return Array.from(loadingStates.entries()).map(([key, state]) => ({
            key,
            ...state
        }));
    }, [loadingStates]);

    // Clear all loading states
    const clearAllLoading = useCallback(() => {
        setLoadingStates(new Map());
        setGlobalLoading(false);
    }, []);

    const value = {
        // State
        hasAnyLoading,
        globalLoading,
        loadingStates: Array.from(loadingStates.keys()),

        // Actions
        setLoading,
        isLoading,
        getLoadingMessage,
        setGlobalLoadingState,
        getActiveLoadingStates,
        clearAllLoading
    };

    return (
        <LoadingContext.Provider value={value}>
            {children}
            {/* Global Loading Overlay */}
            {globalLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <LoadingSpinner
                        message={getLoadingMessage('global')}
                        size="large"
                    />
                </div>
            )}
        </LoadingContext.Provider>
    );
};