import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    X, Calendar, Clock, Users, Shield, Video,
    Settings, Save, AlertCircle, CheckCircle,
    Eye, EyeOff, Copy, Plus, Trash2
} from 'lucide-react';

const CreateMeeting = ({ isModal = false, onClose }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        scheduledAt: '',
        duration: 60,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

        // Security settings
        isPasswordProtected: false,
        password: '',
        waitingRoomEnabled: false,
        allowAnonymous: true,

        // Participant settings
        maxParticipants: 100,
        muteOnJoin: false,
        videoOnJoin: true,
        allowScreenShare: true,
        allowChat: true,
        allowReactions: true,

        // Recording settings
        recordingEnabled: false,
        autoRecord: false,

        // Recurring settings
        isRecurring: false,
        recurrencePattern: 'weekly',
        recurrenceEnd: '',

        // Invitees
        invitees: []
    });

    const [showPassword, setShowPassword] = useState(false);
    const [newInvitee, setNewInvitee] = useState('');
    const [activeTab, setActiveTab] = useState('basic');

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear messages
        if (error) setError('');
        if (success) setSuccess('');
    };

    const addInvitee = () => {
        if (newInvitee.trim() && !formData.invitees.includes(newInvitee.trim())) {
            setFormData(prev => ({
                ...prev,
                invitees: [...prev.invitees, newInvitee.trim()]
            }));
            setNewInvitee('');
        }
    };

    const removeInvitee = (email) => {
        setFormData(prev => ({
            ...prev,
            invitees: prev.invitees.filter(inv => inv !== email)
        }));
    };

    const generateMeetingLink = () => {
        const meetingId = Math.random().toString(36).substring(2, 15);
        return `${window.location.origin}/meeting/${meetingId}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            setError('Meeting title is required');
            return;
        }

        if (!formData.scheduledAt) {
            setError('Meeting date and time is required');
            return;
        }

        if (formData.isPasswordProtected && !formData.password) {
            setError('Password is required when password protection is enabled');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Transform the data to match backend schema
            const meetingPayload = {
                title: formData.title,
                description: formData.description,
                scheduledAt: formData.scheduledAt,
                settings: {
                    isPublic: !formData.isPasswordProtected && formData.allowAnonymous,
                    requirePassword: formData.isPasswordProtected,
                    password: formData.isPasswordProtected ? formData.password : undefined,
                    waitingRoomEnabled: formData.waitingRoomEnabled,
                    recordingEnabled: formData.recordingEnabled,
                    maxParticipants: formData.maxParticipants,
                    allowScreenShare: formData.allowScreenShare,
                    allowChat: formData.allowChat,
                    muteParticipantsOnJoin: formData.muteOnJoin
                }
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(meetingPayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to create meeting');
            }

            const meeting = await response.json();
            setSuccess('Meeting created successfully!');

            setTimeout(() => {
                if (isModal && onClose) {
                    onClose();
                } else {
                    navigate('/dashboard');
                }
            }, 1500);

        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInstantMeeting = async () => {
        setIsLoading(true);

        try {
            // Transform the data for instant meeting
            const instantMeetingPayload = {
                title: formData.title || 'Instant Meeting',
                description: formData.description,
                scheduledAt: new Date().toISOString(),
                settings: {
                    isPublic: !formData.isPasswordProtected && formData.allowAnonymous,
                    requirePassword: formData.isPasswordProtected,
                    password: formData.isPasswordProtected ? formData.password : undefined,
                    waitingRoomEnabled: formData.waitingRoomEnabled,
                    recordingEnabled: formData.recordingEnabled,
                    maxParticipants: formData.maxParticipants,
                    allowScreenShare: formData.allowScreenShare,
                    allowChat: formData.allowChat,
                    muteParticipantsOnJoin: formData.muteOnJoin
                }
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(instantMeetingPayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to create meeting');
            }

            const meeting = await response.json();
            navigate(`/meeting/${meeting.meeting.id}`);

        } catch (error) {
            setError(error.message);
            setIsLoading(false);
        }
    };

    const tabs = [
        { id: 'basic', label: 'Basic Info', icon: Settings },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'participants', label: 'Participants', icon: Users },
        { id: 'advanced', label: 'Advanced', icon: Video }
    ];

    const renderBasicInfo = () => (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Meeting Title *
                </label>
                <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="Enter meeting title"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                </label>
                <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    rows="3"
                    placeholder="Enter meeting description"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Date & Time *
                    </label>
                    <input
                        type="datetime-local"
                        value={formData.scheduledAt}
                        onChange={(e) => handleInputChange('scheduledAt', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        min={new Date().toISOString().slice(0, 16)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Duration (minutes)
                    </label>
                    <select
                        value={formData.duration}
                        onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                        <option value={180}>3 hours</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Recurring Meeting</h4>
                    <p className="text-sm text-gray-400">Repeat this meeting on a schedule</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.isRecurring}
                        onChange={(e) => handleInputChange('isRecurring', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {formData.isRecurring && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Repeat Pattern
                        </label>
                        <select
                            value={formData.recurrencePattern}
                            onChange={(e) => handleInputChange('recurrencePattern', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={formData.recurrenceEnd}
                            onChange={(e) => handleInputChange('recurrenceEnd', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                </div>
            )}
        </div>
    );

    const renderSecurity = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Password Protection</h4>
                    <p className="text-sm text-gray-400">Require a password to join the meeting</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.isPasswordProtected}
                        onChange={(e) => handleInputChange('isPasswordProtected', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {formData.isPasswordProtected && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Meeting Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            className="w-full px-3 py-2 pr-10 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                            placeholder="Enter meeting password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Waiting Room</h4>
                    <p className="text-sm text-gray-400">Host must admit participants before they can join</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.waitingRoomEnabled}
                        onChange={(e) => handleInputChange('waitingRoomEnabled', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Allow Anonymous Users</h4>
                    <p className="text-sm text-gray-400">Allow users to join without signing in</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.allowAnonymous}
                        onChange={(e) => handleInputChange('allowAnonymous', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
        </div>
    );

    const renderParticipants = () => (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Participants
                </label>
                <select
                    value={formData.maxParticipants}
                    onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                    <option value={10}>10 participants</option>
                    <option value={25}>25 participants</option>
                    <option value={50}>50 participants</option>
                    <option value={100}>100 participants</option>
                    <option value={250}>250 participants</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Invite Participants
                </label>
                <div className="flex space-x-2 mb-3">
                    <input
                        type="email"
                        value={newInvitee}
                        onChange={(e) => setNewInvitee(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addInvitee()}
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="Enter email address"
                    />
                    <button
                        type="button"
                        onClick={addInvitee}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                {formData.invitees.length > 0 && (
                    <div className="space-y-2">
                        {formData.invitees.map((email, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded-lg">
                                <span className="text-white text-sm">{email}</span>
                                <button
                                    type="button"
                                    onClick={() => removeInvitee(email)}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-white font-medium">Mute on Join</h4>
                        <p className="text-sm text-gray-400">Mute participants when they join</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.muteOnJoin}
                            onChange={(e) => handleInputChange('muteOnJoin', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-white font-medium">Video on Join</h4>
                        <p className="text-sm text-gray-400">Enable video when participants join</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.videoOnJoin}
                            onChange={(e) => handleInputChange('videoOnJoin', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>
        </div>
    );

    const renderAdvanced = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-white font-medium">Allow Screen Share</h4>
                        <p className="text-sm text-gray-400">Participants can share their screen</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.allowScreenShare}
                            onChange={(e) => handleInputChange('allowScreenShare', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-white font-medium">Allow Chat</h4>
                        <p className="text-sm text-gray-400">Participants can send messages</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.allowChat}
                            onChange={(e) => handleInputChange('allowChat', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Enable Recording</h4>
                    <p className="text-sm text-gray-400">Allow meeting recording</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.recordingEnabled}
                        onChange={(e) => handleInputChange('recordingEnabled', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {formData.recordingEnabled && (
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-white font-medium">Auto-start Recording</h4>
                        <p className="text-sm text-gray-400">Start recording when meeting begins</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.autoRecord}
                            onChange={(e) => handleInputChange('autoRecord', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            )}
        </div>
    );

    const content = (
        <div className={`${isModal ? '' : 'min-h-screen'} bg-gray-900`}>
            <div className={`${isModal ? '' : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
                {!isModal && (
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Create Meeting</h1>
                        <p className="text-gray-400">Set up a new meeting with your team.</p>
                    </div>
                )}

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

                {success && (
                    <div className="mb-6 p-4 bg-green-900 border border-green-700 rounded-lg">
                        <div className="flex">
                            <CheckCircle className="h-5 w-5 text-green-400" />
                            <div className="ml-3">
                                <p className="text-sm text-green-300">{success}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-gray-800 rounded-lg overflow-hidden">
                    {/* Quick Actions */}
                    <div className="p-6 border-b border-gray-700">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                            <h2 className="text-xl font-semibold text-white">Meeting Details</h2>
                            <button
                                onClick={handleInstantMeeting}
                                disabled={isLoading}
                                className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                <Video className="h-4 w-4 mr-2" />
                                Start Instant Meeting
                            </button>
                        </div>
                    </div>

                    <div className="flex">
                        {/* Sidebar */}
                        <div className="w-64 bg-gray-900 p-4">
                            <nav className="space-y-2">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left ${activeTab === tab.id
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-gray-700'
                                                }`}
                                        >
                                            <Icon className="h-5 w-5" />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6">
                            <form onSubmit={handleSubmit}>
                                {activeTab === 'basic' && renderBasicInfo()}
                                {activeTab === 'security' && renderSecurity()}
                                {activeTab === 'participants' && renderParticipants()}
                                {activeTab === 'advanced' && renderAdvanced()}

                                {/* Actions */}
                                <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-700">
                                    <button
                                        type="button"
                                        onClick={isModal ? onClose : () => navigate('/dashboard')}
                                        className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Schedule Meeting
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b border-gray-700">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-white">Create Meeting</h2>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {content}
                    </div>
                </div>
            </div>
        );
    }

    return content;
};

export default CreateMeeting;