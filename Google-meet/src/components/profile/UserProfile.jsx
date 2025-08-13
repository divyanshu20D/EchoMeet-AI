import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    User, Mail, Building, Calendar, Shield, Camera,
    Save, AlertCircle, CheckCircle, Eye, EyeOff,
    Loader2, Edit, X
} from 'lucide-react';

const UserProfile = () => {
    const { user, mfaStatus, fetchMFAStatus } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [profileData, setProfileData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        organizationName: user?.organizationName || '',
        title: user?.title || '',
        department: user?.department || '',
        phone: user?.phone || '',
        timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: user?.language || 'en',
        avatar: user?.avatar || null
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    const [preferences, setPreferences] = useState({
        emailNotifications: true,
        meetingReminders: true,
        soundNotifications: true,
        autoJoinAudio: true,
        autoJoinVideo: false,
        defaultMeetingDuration: 60,
        theme: 'dark'
    });

    useEffect(() => {
        // Load user preferences
        loadUserPreferences();
    }, []);

    const loadUserPreferences = async () => {
        try {
            const response = await fetch('/api/users/preferences', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPreferences(prev => ({ ...prev, ...data.data }));
            }
        } catch (error) {
            console.error('Failed to load preferences:', error);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/users/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            setSuccess('Profile updated successfully');
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 8) {
            setError('New password must be at least 8 characters long');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Failed to change password');
            }

            setSuccess('Password changed successfully');
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePreferencesUpdate = async () => {
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/users/preferences', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(preferences)
            });

            if (!response.ok) {
                throw new Error('Failed to update preferences');
            }

            setSuccess('Preferences updated successfully');
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setError('Avatar file size must be less than 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/users/avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to upload avatar');
            }

            const data = await response.json();
            setProfileData(prev => ({ ...prev, avatar: data.data.avatarUrl }));
            setSuccess('Avatar updated successfully');
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getInitials = (name) => {
        return name
            ?.split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U';
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'preferences', label: 'Preferences', icon: Calendar }
    ];

    const renderProfile = () => (
        <form onSubmit={handleProfileUpdate} className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center space-x-6">
                <div className="relative">
                    {profileData.avatar ? (
                        <img
                            src={profileData.avatar}
                            alt="Profile"
                            className="w-20 h-20 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-2xl font-bold">
                                {getInitials(profileData.name)}
                            </span>
                        </div>
                    )}
                    <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer hover:bg-blue-700">
                        <Camera className="h-4 w-4 text-white" />
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                        />
                    </label>
                </div>
                <div>
                    <h3 className="text-lg font-medium text-white">Profile Picture</h3>
                    <p className="text-sm text-gray-400">Upload a new avatar for your profile</p>
                </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name
                    </label>
                    <input
                        type="text"
                        value={profileData.name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email Address
                    </label>
                    <input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Job Title
                    </label>
                    <input
                        type="text"
                        value={profileData.title}
                        onChange={(e) => setProfileData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="e.g. Software Engineer"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Department
                    </label>
                    <input
                        type="text"
                        value={profileData.department}
                        onChange={(e) => setProfileData(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="e.g. Engineering"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Organization
                    </label>
                    <input
                        type="text"
                        value={profileData.organizationName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, organizationName: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Phone Number
                    </label>
                    <input
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timezone
                    </label>
                    <select
                        value={profileData.timezone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, timezone: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="Europe/London">London</option>
                        <option value="Europe/Paris">Paris</option>
                        <option value="Asia/Tokyo">Tokyo</option>
                        <option value="Asia/Shanghai">Shanghai</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Language
                    </label>
                    <select
                        value={profileData.language}
                        onChange={(e) => setProfileData(prev => ({ ...prev, language: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ja">Japanese</option>
                        <option value="zh">Chinese</option>
                    </select>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                        </>
                    )}
                </button>
            </div>
        </form>
    );

    const renderSecurity = () => (
        <div className="space-y-8">
            {/* MFA Status */}
            <div className="bg-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-medium text-white">Two-Factor Authentication</h3>
                        <p className="text-sm text-gray-400">
                            Add an extra layer of security to your account
                        </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${mfaStatus.isEnabled
                            ? 'bg-green-900 text-green-300'
                            : 'bg-yellow-900 text-yellow-300'
                        }`}>
                        {mfaStatus.isEnabled ? 'Enabled' : 'Disabled'}
                    </div>
                </div>

                {mfaStatus.isEnabled ? (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-300">
                            Two-factor authentication is active on your account.
                        </p>
                        <p className="text-sm text-gray-400">
                            Backup codes remaining: {mfaStatus.remainingBackupCodes}
                        </p>
                        <button
                            onClick={() => window.location.href = '/security/mfa'}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                            Manage MFA Settings →
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-300">
                            Secure your account with two-factor authentication.
                        </p>
                        <button
                            onClick={() => window.location.href = '/security/mfa'}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                            Enable MFA
                        </button>
                    </div>
                )}
            </div>

            {/* Change Password */}
            <form onSubmit={handlePasswordChange} className="space-y-6">
                <h3 className="text-lg font-medium text-white">Change Password</h3>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Current Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPasswords.current ? 'text' : 'password'}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                            className="w-full px-3 py-2 pr-10 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                            {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        New Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPasswords.new ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                            className="w-full px-3 py-2 pr-10 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Confirm New Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="w-full px-3 py-2 pr-10 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                            {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Changing...
                            </>
                        ) : (
                            'Change Password'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderPreferences = () => (
        <div className="space-y-8">
            {/* Notifications */}
            <div>
                <h3 className="text-lg font-medium text-white mb-4">Notifications</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium">Email Notifications</h4>
                            <p className="text-sm text-gray-400">Receive meeting invites and updates via email</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences.emailNotifications}
                                onChange={(e) => setPreferences(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium">Meeting Reminders</h4>
                            <p className="text-sm text-gray-400">Get reminded before meetings start</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences.meetingReminders}
                                onChange={(e) => setPreferences(prev => ({ ...prev, meetingReminders: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium">Sound Notifications</h4>
                            <p className="text-sm text-gray-400">Play sounds for notifications and alerts</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences.soundNotifications}
                                onChange={(e) => setPreferences(prev => ({ ...prev, soundNotifications: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Meeting Defaults */}
            <div>
                <h3 className="text-lg font-medium text-white mb-4">Meeting Defaults</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium">Auto-join Audio</h4>
                            <p className="text-sm text-gray-400">Automatically connect audio when joining meetings</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences.autoJoinAudio}
                                onChange={(e) => setPreferences(prev => ({ ...prev, autoJoinAudio: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium">Auto-join Video</h4>
                            <p className="text-sm text-gray-400">Automatically turn on camera when joining meetings</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences.autoJoinVideo}
                                onChange={(e) => setPreferences(prev => ({ ...prev, autoJoinVideo: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Default Meeting Duration
                        </label>
                        <select
                            value={preferences.defaultMeetingDuration}
                            onChange={(e) => setPreferences(prev => ({ ...prev, defaultMeetingDuration: parseInt(e.target.value) }))}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        >
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handlePreferencesUpdate}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Preferences
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
                    <p className="text-gray-400">Manage your account settings and preferences.</p>
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
                            {activeTab === 'profile' && renderProfile()}
                            {activeTab === 'security' && renderSecurity()}
                            {activeTab === 'preferences' && renderPreferences()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;