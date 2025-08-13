import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({
    size = 'medium',
    message = 'Loading...',
    className = '',
    showMessage = true
}) => {
    const getSizeClasses = () => {
        switch (size) {
            case 'small':
                return 'h-4 w-4';
            case 'large':
                return 'h-12 w-12';
            case 'xlarge':
                return 'h-16 w-16';
            case 'medium':
            default:
                return 'h-8 w-8';
        }
    };

    const getTextSize = () => {
        switch (size) {
            case 'small':
                return 'text-sm';
            case 'large':
                return 'text-lg';
            case 'xlarge':
                return 'text-xl';
            case 'medium':
            default:
                return 'text-base';
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <Loader2 className={`animate-spin text-blue-500 ${getSizeClasses()}`} />
            {showMessage && message && (
                <p className={`text-gray-300 mt-2 ${getTextSize()}`}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default LoadingSpinner;