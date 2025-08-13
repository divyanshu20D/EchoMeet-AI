import { useState } from 'react';
import {
    Mic, MicOff, Video, VideoOff, Phone, Monitor, MonitorOff,
    Settings, MoreVertical, Volume2, VolumeX
} from 'lucide-react';

const VideoControls = ({
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    onToggleAudio,
    onToggleVideo,
    onToggleScreenShare,
    onLeaveMeeting,
    className = ''
}) => {
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);

    const toggleSpeaker = () => {
        setIsSpeakerEnabled(!isSpeakerEnabled);
        // Implementation for speaker toggle would go here
    };

    const handleLeaveClick = () => {
        if (window.confirm('Are you sure you want to leave the meeting?')) {
            onLeaveMeeting();
        }
    };

    return (
        <div className={`flex items-center space-x-3 bg-gray-800 rounded-full px-6 py-3 shadow-lg ${className}`}>
            {/* Audio Control */}
            <button
                onClick={onToggleAudio}
                className={`p-3 rounded-full transition-colors ${isAudioEnabled
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            {/* Video Control */}
            <button
                onClick={onToggleVideo}
                className={`p-3 rounded-full transition-colors ${isVideoEnabled
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>

            {/* Screen Share Control */}
            <button
                onClick={onToggleScreenShare}
                className={`p-3 rounded-full transition-colors ${isScreenSharing
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
                {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </button>

            {/* Speaker Control */}
            <button
                onClick={toggleSpeaker}
                className={`p-3 rounded-full transition-colors ${isSpeakerEnabled
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                title={isSpeakerEnabled ? 'Mute speaker' : 'Unmute speaker'}
            >
                {isSpeakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>

            {/* More Options */}
            <div className="relative">
                <button
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className="p-3 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    title="More options"
                >
                    <MoreVertical className="h-5 w-5" />
                </button>

                {showMoreOptions && (
                    <div className="absolute bottom-full mb-2 right-0 bg-gray-800 rounded-lg shadow-lg py-2 min-w-48">
                        <button
                            onClick={() => {
                                // Open device settings
                                setShowMoreOptions(false);
                            }}
                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center"
                        >
                            <Settings className="h-4 w-4 mr-3" />
                            Audio/Video Settings
                        </button>

                        <div className="border-t border-gray-700 my-1"></div>

                        <button
                            onClick={() => {
                                // Copy meeting link
                                navigator.clipboard.writeText(window.location.href);
                                setShowMoreOptions(false);
                            }}
                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700"
                        >
                            Copy meeting link
                        </button>

                        <button
                            onClick={() => {
                                // Report issue
                                setShowMoreOptions(false);
                            }}
                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700"
                        >
                            Report an issue
                        </button>
                    </div>
                )}
            </div>

            {/* Leave Meeting */}
            <button
                onClick={handleLeaveClick}
                className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors ml-2"
                title="Leave meeting"
            >
                <Phone className="h-5 w-5 transform rotate-[135deg]" />
            </button>
        </div>
    );
};

export default VideoControls;