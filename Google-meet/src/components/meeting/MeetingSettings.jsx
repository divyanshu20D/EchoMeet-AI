import { useState, useEffect } from 'react';
import {
    X, Settings, Shield, Users, Mic, Video, Monitor,
    Lock, Eye, EyeOff, Save, AlertCircle, CheckCircle
} from 'lucide-react';

const MeetingSettings = ({ meeting, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('general');
    const [settings, setSettings] = useState({
        // General settings
        title: meeting?.title || '',
        description: meeting?.description || '',

        // Security settings
        isPasswordProtected: meeting?.isPasswordProtected || false,
        password: '',
        waitingRoomEnabled: meeting?.waitingRoomEnabled || false,
        allowAnonymous: meeting?.allowAnonymous || true,

        // Participant settings
        muteOnJoin: meeting?.muteOnJoin || false,
        videoOnJoin: meeting?.videoOnJoin || true,
        allowScreenShare: meeting?.allowScreenShare || true,
        allowChat: meeting?.allowChat || true,
        allowReactions: meeting?.allowReactions || true,

        // Recording settings
        recordingEnabled: meeting?.recordingEnabled || false,
        autoRecord: meeting?.autoRecord || false,
        recordingConsent: meeting?.recordingConsent || true,

        // Advanced settings
        maxParticipants: meeting?.maxParticipants || 100,
        sessionTimeout: meeting?.sessionTimeout || 60,
        enableBreakoutRooms: meeting?.enableBreakoutRooms || false
    });

    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));

        // Clear messages
        if (error) setError('');
        if (success) setSuccess('');
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');

        try {
            const response = await fetch(`/api/meetings/${meeting.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (!response.ok) {
                throw new Error('Failed to update meeting settings');
            }

            const updatedMeeting = await response.json();
            onUpdate(updatedMeeting.data);
            setSuccess('Settings saved successfully');

            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (error) {
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'participants', label: 'Participants', icon: Users },
        { id: 'recording', label: 'Recording', icon: Monitor }
    ];

    const renderGeneralSettings = () => (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Meeting Title
                </label>
                <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => handleSettingChange('title', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="Enter meeting title"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                </label>
                <textarea
                    value={settings.description}
                    onChange={(e) => handleSettingChange('description', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    rows="3"
                    placeholder="Enter meeting description"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Participants
                </label>
                <select
                    value={settings.maxParticipants}
                    onChange={(e) => handleSettingChange('maxParticipants', parseInt(e.target.value))}
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
                    Session Timeout (minutes)
                </label>
                <input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    min="15"
                    max="480"
                />
                <p className="text-xs text-gray-400 mt-1">
                    Meeting will automatically end after this duration of inactivity
                </p>
            </div>
        </div>
    );

    const renderSecuritySettings = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Password Protection</h4>
                    <p className="text-sm text-gray-400">Require a password to join the meeting</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.isPasswordProtected}
                        onChange={(e) => handleSettingChange('isPasswordProtected', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {settings.isPasswordProtected && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Meeting Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={settings.password}
                            onChange={(e) => handleSettingChange('password', e.target.value)}
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
                        checked={settings.waitingRoomEnabled}
                        onChange={(e) => handleSettingChange('waitingRoomEnabled', e.target.checked)}
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
                        checked={settings.allowAnonymous}
                        onChange={(e) => handleSettingChange('allowAnonymous', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
        </div>
    );

    const renderParticipantSettings = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Mute on Join</h4>
                    <p className="text-sm text-gray-400">Automatically mute participants when they join</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.muteOnJoin}
                        onChange={(e) => handleSettingChange('muteOnJoin', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Video on Join</h4>
                    <p className="text-sm text-gray-400">Automatically enable video when participants join</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.videoOnJoin}
                        onChange={(e) => handleSettingChange('videoOnJoin', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Allow Screen Sharing</h4>
                    <p className="text-sm text-gray-400">Participants can share their screen</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.allowScreenShare}
                        onChange={(e) => handleSettingChange('allowScreenShare', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Allow Chat</h4>
                    <p className="text-sm text-gray-400">Participants can send chat messages</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.allowChat}
                        onChange={(e) => handleSettingChange('allowChat', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Allow Reactions</h4>
                    <p className="text-sm text-gray-400">Participants can send emoji reactions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.allowReactions}
                        onChange={(e) => handleSettingChange('allowReactions', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Enable Breakout Rooms</h4>
                    <p className="text-sm text-gray-400">Allow creating smaller discussion groups</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.enableBreakoutRooms}
                        onChange={(e) => handleSettingChange('enableBreakoutRooms', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
        </div>
    );

    const renderRecordingSettings = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Enable Recording</h4>
                    <p className="text-sm text-gray-400">Allow meeting recording</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.recordingEnabled}
                        onChange={(e) => handleSettingChange('recordingEnabled', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {settings.recordingEnabled && (
                <>
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium">Auto-start Recording</h4>
                            <p className="text-sm text-gray-400">Automatically start recording when meeting begins</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.autoRecord}
                                onChange={(e) => handleSettingChange('autoRecord', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium">Recording Consent</h4>
                            <p className="text-sm text-gray-400">Require participant consent before recording</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.recordingConsent}
                                onChange={(e) => handleSettingChange('recordingConsent', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-white">Meeting Settings</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0">
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
                    <div className="flex-1 p-6 overflow-y-auto">
                        {error && (
                            <div className="mb-4 p-4 bg-red-900 border border-red-700 rounded-lg">
                                <div className="flex">
                                    <AlertCircle className="h-5 w-5 text-red-400" />
                                    <div className="ml-3">
                                        <p className="text-sm text-red-300">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 p-4 bg-green-900 border border-green-700 rounded-lg">
                                <div className="flex">
                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                    <div className="ml-3">
                                        <p className="text-sm text-green-300">{success}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'general' && renderGeneralSettings()}
                        {activeTab === 'security' && renderSecuritySettings()}
                        {activeTab === 'participants' && renderParticipantSettings()}
                        {activeTab === 'recording' && renderRecordingSettings()}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-700">
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                        >
                            {isSaving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                </div>
            </div>
        </div>
    );
};

export default MeetingSettings;