import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Video, Users, Shield, AlertCircle, Loader2 } from 'lucide-react';

const JoinMeeting = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, isAuthenticated } = useAuth();

    const [meetingId, setMeetingId] = useState(searchParams.get('id') || '');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(user?.name || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [meetingInfo, setMeetingInfo] = useState(null);

    // Check meeting info when meeting ID changes
    const checkMeetingInfo = async (id) => {
        if (!id.trim()) {
            setMeetingInfo(null);
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/${id}/info`);
            if (response.ok) {
                const data = await response.json();
                setMeetingInfo(data.data);
                setError('');
            } else {
                setMeetingInfo(null);
                setError('Meeting not found or invalid meeting ID');
            }
        } catch (error) {
            setMeetingInfo(null);
            setError('Failed to check meeting information');
        }
    };

    const handleMeetingIdChange = (e) => {
        const id = e.target.value;
        setMeetingId(id);

        // Debounce the API call
        clearTimeout(window.meetingCheckTimeout);
        window.meetingCheckTimeout = setTimeout(() => {
            checkMeetingInfo(id);
        }, 500);
    };

    const handleJoinMeeting = async (e) => {
        e.preventDefault();

        if (!meetingId.trim()) {
            setError('Please enter a meeting ID');
            return;
        }

        if (!isAuthenticated && !name.trim()) {
            setError('Please enter your name');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Validate meeting access
            const joinData = {
                meetingId: meetingId.trim(),
                password: password || undefined,
                guestName: !isAuthenticated ? name.trim() : undefined
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/validate-access`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(isAuthenticated && {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                    })
                },
                body: JSON.stringify(joinData)
            });

            const data = await response.json();

            if (response.ok) {
                // Redirect to meeting room
                navigate(`/meeting/${meetingId}`, {
                    state: {
                        guestName: !isAuthenticated ? name.trim() : undefined
                    }
                });
            } else {
                setError(data.error?.message || 'Failed to join meeting');
            }
        } catch (error) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="bg-gray-800 rounded-lg p-8">
                    <div className="text-center mb-8">
                        <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 mb-4">
                            <Video className="h-6 w-6 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Join Meeting
                        </h2>
                        <p className="text-gray-400">
                            Enter the meeting ID to join the video conference
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg">
                            <div className="flex">
                                <AlertCircle className="h-5 w-5 text-red-400" />
                                <div className="ml-3">
                                    <p className="text-sm text-red-300">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleJoinMeeting} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Meeting ID
                            </label>
                            <input
                                type="text"
                                value={meetingId}
                                onChange={handleMeetingIdChange}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                placeholder="Enter meeting ID"
                                required
                            />
                        </div>

                        {/* Meeting Info */}
                        {meetingInfo && (
                            <div className="bg-gray-700 rounded-lg p-4">
                                <div className="flex items-center mb-2">
                                    <Users className="h-4 w-4 text-blue-400 mr-2" />
                                    <span className="text-white font-medium">{meetingInfo.title}</span>
                                    {meetingInfo.isSecure && (
                                        <Shield className="h-4 w-4 text-green-400 ml-2" />
                                    )}
                                </div>
                                {meetingInfo.description && (
                                    <p className="text-gray-300 text-sm">{meetingInfo.description}</p>
                                )}
                                <div className="flex items-center mt-2 text-sm text-gray-400">
                                    <span>Host: {meetingInfo.hostName}</span>
                                    {meetingInfo.participantCount > 0 && (
                                        <span className="ml-4">
                                            {meetingInfo.participantCount} participant{meetingInfo.participantCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Password field (if meeting requires password) */}
                        {meetingInfo?.isPasswordProtected && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Meeting Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                    placeholder="Enter meeting password"
                                    required
                                />
                            </div>
                        )}

                        {/* Name field (for guests) */}
                        {!isAuthenticated && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Your Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                    placeholder="Enter your name"
                                    required
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !meetingId.trim()}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Joining...
                                </div>
                            ) : (
                                'Join Meeting'
                            )}
                        </button>
                    </form>

                    {/* Sign in prompt for guests */}
                    {!isAuthenticated && (
                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-400">
                                Have an account?{' '}
                                <button
                                    onClick={() => navigate('/login', {
                                        state: {
                                            from: { pathname: '/join', search: `?id=${meetingId}` }
                                        }
                                    })}
                                    className="text-blue-400 hover:text-blue-300"
                                >
                                    Sign in
                                </button>
                            </p>
                        </div>
                    )}

                    {/* Back to dashboard for authenticated users */}
                    {isAuthenticated && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="text-sm text-gray-400 hover:text-gray-300"
                            >
                                ← Back to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JoinMeeting;