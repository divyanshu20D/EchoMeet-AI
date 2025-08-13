import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import config from './config/environment';
import './index.css';

// Performance monitoring (if enabled)
if (config.features.performanceMonitoring && config.isProduction) {
    // Initialize performance monitoring service
    // Example: import and initialize performance monitoring
}

// Error reporting (if enabled)
if (config.features.errorReporting && config.isProduction) {
    // Initialize error reporting service
    // Example: import and initialize error reporting
}

// Analytics (if enabled)
if (config.features.analytics && config.isProduction) {
    // Initialize analytics service
    // Example: import and initialize analytics
}

// Development tools
if (config.isDevelopment) {
    // Enable React DevTools
    if (typeof window !== 'undefined') {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
    }
}

// Service Worker registration (for PWA features)
const registerServiceWorker = () => {
    if ('serviceWorker' in navigator && config.isProduction) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('SW registered: ', registration);
                })
                .catch((registrationError) => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }
};

// Initialize the application
const initializeApp = () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));

    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    // Register service worker
    registerServiceWorker();

    // Log application start
    if (config.debug.enabled) {
        console.log(`🚀 VideoMeet v${config.version} started in ${config.environment} mode`);
        console.log('Configuration:', config);
    }
};

// Handle uncaught errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);

    if (config.features.errorReporting && config.isProduction) {
        // Report error to monitoring service
        // errorReportingService.captureException(event.error);
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    if (config.features.errorReporting && config.isProduction) {
        // Report error to monitoring service
        // errorReportingService.captureException(event.reason);
    }
});

// Initialize the application
initializeApp();