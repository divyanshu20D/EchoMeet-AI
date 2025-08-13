import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingProvider } from './context/LoadingContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navigation from './components/navigation/Navigation';

// Auth Components
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';
import ResetPasswordForm from './components/auth/ResetPasswordForm';
import MFASetup from './components/auth/MFASetup';
import MFAManagement from './components/auth/MFAManagement';

// Dashboard Components
import Dashboard from './components/dashboard/Dashboard';
import CreateMeeting from './components/dashboard/CreateMeeting';

// Meeting Components
import MeetingRoom from './components/meeting/MeetingRoom';

// Profile Components
import UserProfile from './components/profile/UserProfile';

// Common Components
import NotFound from './components/common/NotFound';
import LoadingSpinner from './components/common/LoadingSpinner';
import JoinMeeting from './components/meeting/JoinMeeting';

import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LoadingProvider>
          <NotificationProvider>
            <Router>
              <div className="App">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<LoginForm />} />
                  <Route path="/register" element={<RegisterForm />} />
                  <Route path="/forgot-password" element={<ForgotPasswordForm />} />
                  <Route path="/reset-password" element={<ResetPasswordForm />} />
                  <Route path="/join" element={<JoinMeeting />} />

                  {/* Protected Routes with Navigation */}
                  <Route path="/*" element={
                    <ProtectedRoute>
                      <div className="flex h-screen bg-gray-900">
                        <Navigation />
                        <main className="flex-1 overflow-auto">
                          <Routes>
                            {/* Dashboard Routes */}
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/meetings" element={<Dashboard />} />
                            <Route path="/meeting/new" element={<CreateMeeting />} />

                            {/* Meeting Routes */}
                            <Route path="/meeting/:meetingId" element={<MeetingRoom />} />
                            <Route path="/meeting/:meetingId/edit" element={<CreateMeeting />} />

                            {/* Profile Routes */}
                            <Route path="/profile" element={<UserProfile />} />
                            <Route path="/settings" element={<UserProfile />} />

                            {/* Security Routes */}
                            <Route path="/security" element={<UserProfile />} />
                            <Route path="/security/mfa" element={<MFAManagement />} />
                            <Route path="/setup-mfa" element={<MFASetup />} />

                            {/* Redirects */}
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/home" element={<Navigate to="/dashboard" replace />} />

                            {/* 404 */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </div>
                    </ProtectedRoute>
                  } />
                </Routes>
              </div>
            </Router>
          </NotificationProvider>
        </LoadingProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;