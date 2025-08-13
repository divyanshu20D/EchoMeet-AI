import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, requireMFA = false, adminOnly = false }) => {
    const { isAuthenticated, isLoading, user, mfaStatus } = useAuth();
    const location = useLocation();

    // Show loading spinner while checking authentication
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex items-center space-x-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="text-gray-600">Loading...</span>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check admin access if required
    if (adminOnly && user?.role !== 'admin') {
        return <Navigate to="/dashboard" replace />;
    }

    // Check MFA requirement
    if (requireMFA && !mfaStatus.isEnabled) {
        return <Navigate to="/setup-mfa" state={{ from: location }} replace />;
    }

    // Render protected content
    return children;
};

export default ProtectedRoute;