import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Plus, Calendar, Clock, Users, Video, Settings,
    Search, Filter, MoreVertical, Play, Trash2,
    Copy, Share, Edit, Shield, Star
} from 'lucide-react';

const MeetingCard = ({ meeting, onJoin, onEdit, onDelete, onCopyLink }) => {
    const [showActions, setShowActions] = useState(false);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays > 0 && diffDays <= 7) {
            return date.toLocaleDateString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'upcoming': return 'text-blue-400 bg-blue-900';
            case 'live': return 'text-green-400 bg-green-900';
            case 'ended': return 'text-gray-400 bg-gray-700';
            default: return 'text-gray-400 bg-gray-700';
        }
    };

    const canJoin = meeting.status === 'upcoming' || meeting.status === 'live';

    return (
        <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">
                            {meeting.title}
                        </h3>
                        {meeting.isSecure && (
                            <Shield className="h-4 w-4 text-green-400" title="Secure meeting" />
                        )}
                        {meeting.isRecurring && (
                            <div className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                                Recurring
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                        <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(meeting.scheduledAt)}
                        </div>
                        <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {meeting.duration || '60'} min
                        </div>
                        <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {meeting.participantCount || 0} participants
                        </div>
                    </div>

                    <div className="text-xs text-gray-500 mb-3 font-mono">
                        ID: {meeting.id}
                    </div>

                    {meeting.description && (
                        <p className="text-gray-300 text-sm line-clamp-2 mb-3">
                            {meeting.description}
                        </p>
                    )}

                    <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>
                            {meeting.status === 'live' && <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>}
                            {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                        </span>

                        <div className="flex items-center space-x-2">
                            {canJoin && (
                                <button
                                    onClick={() => onJoin(meeting.id)}
                                    className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                                >
                                    <Play className="h-3 w-3 mr-1" />
                                    {meeting.status === 'live' ? 'Join' : 'Start'}
                                </button>
                            )}

                            <div className="relative">
                                <button
                                    onClick={() => setShowActions(!showActions)}
                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>

                                {showActions && (
                                    <div className="absolute right-0 top-full mt-1 bg-gray-700 rounded-lg shadow-lg py-2 min-w-48 z-10">
                                        <button
                                            onClick={() => {
                                                onCopyLink(meeting.id);
                                                setShowActions(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 flex items-center text-sm"
                                        >
                                            <Copy className="h-4 w-4 mr-3" />
                                            Copy meeting link
                                        </button>

                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(meeting.id);
                                                setShowActions(false);
                                                // You can add a toast notification here
                                            }}
                                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 flex items-center text-sm"
                                        >
                                            <Copy className="h-4 w-4 mr-3" />
                                            Copy meeting ID
                                        </button>

                                        <button
                                            onClick={() => {
                                                onEdit(meeting.id);
                                                setShowActions(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 flex items-center text-sm"
                                        >
                                            <Edit className="h-4 w-4 mr-3" />
                                            Edit meeting
                                        </button>

                                        <button
                                            onClick={() => {
                                                // Share meeting
                                                setShowActions(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 flex items-center text-sm"
                                        >
                                            <Share className="h-4 w-4 mr-3" />
                                            Share meeting
                                        </button>

                                        <div className="border-t border-gray-600 my-1"></div>

                                        <button
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to delete this meeting?')) {
                                                    onDelete(meeting.id);
                                                }
                                                setShowActions(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-600 flex items-center text-sm"
                                        >
                                            <Trash2 className="h-4 w-4 mr-3" />
                                            Delete meeting
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [meetings, setMeetings] = useState([]);
    const [filteredMeetings, setFilteredMeetings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Fetch meetings from API
    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const formattedMeetings = data.meetings.map(meeting => ({
                        id: meeting.id,
                        title: meeting.title,
                        description: meeting.description,
                        scheduledAt: meeting.scheduledAt,
                        duration: meeting.duration || 60,
                        status: meeting.status.toLowerCase(),
                        participantCount: meeting._count?.participants || 0,
                        isSecure: meeting.settings?.requirePassword || meeting.settings?.waitingRoomEnabled || false,
                        isRecurring: false, // Add recurring logic if needed
                        host: meeting.host
                    }));

                    setMeetings(formattedMeetings);
                    setFilteredMeetings(formattedMeetings);
                } else {
                    console.error('Failed to fetch meetings');
                    setMeetings([]);
                    setFilteredMeetings([]);
                }
            } catch (error) {
                console.error('Error fetching meetings:', error);
                setMeetings([]);
                setFilteredMeetings([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMeetings();
    }, []);

    // Filter meetings based on search and status
    useEffect(() => {
        let filtered = meetings;

        if (searchTerm) {
            filtered = filtered.filter(meeting =>
                meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                meeting.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterStatus !== 'all') {
            filtered = filtered.filter(meeting => meeting.status === filterStatus);
        }

        setFilteredMeetings(filtered);
    }, [meetings, searchTerm, filterStatus]);

    const handleJoinMeeting = (meetingId) => {
        navigate(`/meeting/${meetingId}`);
    };

    const handleEditMeeting = (meetingId) => {
        navigate(`/meeting/${meetingId}/edit`);
    };

    const handleDeleteMeeting = async (meetingId) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                setMeetings(prev => prev.filter(m => m.id !== meetingId));
                console.log('Meeting deleted successfully');
            } else {
                console.error('Failed to delete meeting');
            }
        } catch (error) {
            console.error('Failed to delete meeting:', error);
        }
    };

    const handleCopyLink = (meetingId) => {
        const link = `${window.location.origin}/join?id=${meetingId}`;
        navigator.clipboard.writeText(link);
        // Show toast notification
        console.log('Meeting link copied:', link);
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const upcomingMeetings = meetings.filter(m => m.status === 'upcoming').length;
    const liveMeetings = meetings.filter(m => m.status === 'live').length;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}!
                    </h1>
                    <p className="text-gray-400">
                        Manage your meetings and stay connected with your team.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-blue-600 rounded-lg">
                                <Calendar className="h-6 w-6 text-white" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Upcoming Meetings</p>
                                <p className="text-2xl font-bold text-white">{upcomingMeetings}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-green-600 rounded-lg">
                                <Video className="h-6 w-6 text-white" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Live Meetings</p>
                                <p className="text-2xl font-bold text-white">{liveMeetings}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-purple-600 rounded-lg">
                                <Users className="h-6 w-6 text-white" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Total Participants</p>
                                <p className="text-2xl font-bold text-white">
                                    {meetings.reduce((sum, m) => sum + (m.participantCount || 0), 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Meeting
                        </button>

                        <button
                            onClick={() => navigate('/join')}
                            className="inline-flex items-center px-4 py-2 border border-gray-600 text-gray-300 font-medium rounded-lg hover:bg-gray-800"
                        >
                            Join Meeting
                        </button>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search meetings..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none w-64"
                            />
                        </div>

                        {/* Filter */}
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="all">All Meetings</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="live">Live</option>
                            <option value="ended">Ended</option>
                        </select>
                    </div>
                </div>

                {/* Meetings Grid */}
                <div className="space-y-4">
                    {filteredMeetings.length === 0 ? (
                        <div className="text-center py-12">
                            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">
                                {searchTerm || filterStatus !== 'all' ? 'No meetings found' : 'No meetings scheduled'}
                            </h3>
                            <p className="text-gray-400 mb-6">
                                {searchTerm || filterStatus !== 'all'
                                    ? 'Try adjusting your search or filter criteria.'
                                    : 'Get started by creating your first meeting.'
                                }
                            </p>
                            {!searchTerm && filterStatus === 'all' && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Meeting
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredMeetings.map((meeting) => (
                                <MeetingCard
                                    key={meeting.id}
                                    meeting={meeting}
                                    onJoin={handleJoinMeeting}
                                    onEdit={handleEditMeeting}
                                    onDelete={handleDeleteMeeting}
                                    onCopyLink={handleCopyLink}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;