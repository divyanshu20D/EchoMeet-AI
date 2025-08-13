import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log error details
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        // Report error to monitoring service
        this.reportError(error, errorInfo);
    }

    reportError = (error, errorInfo) => {
        // In production, send error to monitoring service
        if (process.env.NODE_ENV === 'production') {
            // Example: Send to error reporting service
            // errorReportingService.captureException(error, {
            //   extra: errorInfo,
            //   tags: {
            //     component: 'ErrorBoundary'
            //   }
            // });
        }
    };

    handleRetry = () => {
        this.setState(prevState => ({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: prevState.retryCount + 1
        }));
    };

    handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            const isDevelopment = process.env.NODE_ENV === 'development';

            return (
                <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
                    <div className="max-w-lg w-full text-center">
                        <div className="mb-8">
                            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Oops! Something went wrong
                            </h1>
                            <p className="text-gray-400 mb-6">
                                We're sorry, but something unexpected happened. Our team has been notified.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                            <button
                                onClick={this.handleRetry}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Try Again
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="inline-flex items-center px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                <Home className="h-4 w-4 mr-2" />
                                Go to Dashboard
                            </button>
                        </div>

                        {/* Error Details (Development Only) */}
                        {isDevelopment && this.state.error && (
                            <div className="bg-gray-800 rounded-lg p-4 text-left">
                                <h3 className="text-lg font-semibold text-red-400 mb-2">
                                    Error Details (Development Mode)
                                </h3>
                                <div className="bg-gray-900 rounded p-3 mb-4">
                                    <p className="text-red-300 text-sm font-mono">
                                        {this.state.error.toString()}
                                    </p>
                                </div>

                                {this.state.errorInfo && (
                                    <div className="bg-gray-900 rounded p-3">
                                        <h4 className="text-sm font-semibold text-gray-300 mb-2">
                                            Component Stack:
                                        </h4>
                                        <pre className="text-xs text-gray-400 overflow-auto max-h-40">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Retry Count */}
                        {this.state.retryCount > 0 && (
                            <p className="text-sm text-gray-500 mt-4">
                                Retry attempts: {this.state.retryCount}
                            </p>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Functional component wrapper for hooks
export const ErrorBoundaryWrapper = ({ children, fallback }) => {
    return (
        <ErrorBoundary fallback={fallback}>
            {children}
        </ErrorBoundary>
    );
};

export { ErrorBoundary };