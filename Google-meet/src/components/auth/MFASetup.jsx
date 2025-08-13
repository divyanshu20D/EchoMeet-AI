import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Smartphone, Key, Copy, Download, AlertCircle, CheckCircle, Loader2, QrCode } from 'lucide-react';

const MFASetup = ({ onComplete, onCancel }) => {
    const { setupMFA, enableMFA, mfaStatus } = useAuth();
    const [step, setStep] = useState(1); // 1: Setup, 2: Verify, 3: Backup Codes
    const [setupData, setSetupData] = useState(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (step === 1) {
            initializeSetup();
        }
    }, [step]);

    const initializeSetup = async () => {
        setIsLoading(true);
        setError('');

        try {
            const result = await setupMFA();
            if (result.success) {
                setSetupData(result.data);
            } else {
                setError(result.error?.message || 'Failed to initialize MFA setup');
            }
        } catch (error) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerification = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await enableMFA(verificationCode, setupData.setupToken);
            if (result.success) {
                setBackupCodes(result.data.backupCodes);
                setStep(3);
            } else {
                setError(result.error?.message || 'Invalid verification code');
            }
        } catch (error) {
            setError('Verification failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    };

    const downloadBackupCodes = () => {
        const codesText = backupCodes.join('\n');
        const blob = new Blob([codesText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mfa-backup-codes.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleComplete = () => {
        if (onComplete) {
            onComplete();
        }
    };

    if (step === 1) {
        return (
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-6">
                    <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 mb-4">
                        <Shield className="h-6 w-6 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Set up Two-Factor Authentication</h2>
                    <p className="text-gray-600 mt-2">
                        Add an extra layer of security to your account
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex">
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            <div className="ml-3">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                        <p className="text-gray-600 mt-2">Setting up MFA...</p>
                    </div>
                ) : setupData ? (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                                <img
                                    src={setupData.qrCode}
                                    alt="QR Code for MFA setup"
                                    className="w-48 h-48"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0">
                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                        <span className="text-white text-sm font-medium">1</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        Install an authenticator app
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Download Google Authenticator, Authy, or another TOTP app
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0">
                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                        <span className="text-white text-sm font-medium">2</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        Scan the QR code
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Use your authenticator app to scan the QR code above
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0">
                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                        <span className="text-white text-sm font-medium">3</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        Enter the verification code
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Click continue and enter the 6-digit code from your app
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-md">
                            <p className="text-sm font-medium text-gray-900 mb-2">
                                Can't scan the QR code?
                            </p>
                            <p className="text-sm text-gray-600 mb-2">
                                Enter this code manually in your authenticator app:
                            </p>
                            <div className="flex items-center space-x-2">
                                <code className="bg-white px-2 py-1 rounded text-sm font-mono border">
                                    {setupData.secret}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(setupData.secret)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={onCancel}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    if (step === 2) {
        return (
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-6">
                    <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 mb-4">
                        <Smartphone className="h-6 w-6 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Verify Your Setup</h2>
                    <p className="text-gray-600 mt-2">
                        Enter the 6-digit code from your authenticator app
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex">
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            <div className="ml-3">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-2">
                            Verification Code
                        </label>
                        <input
                            id="verificationCode"
                            type="text"
                            value={verificationCode}
                            onChange={(e) => {
                                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                if (error) setError('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="000000"
                            maxLength={6}
                            autoComplete="one-time-code"
                        />
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={() => setStep(1)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleVerification}
                            disabled={isLoading || verificationCode.length !== 6}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Verifying...
                                </div>
                            ) : (
                                'Verify & Enable'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 3) {
        return (
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-6">
                    <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100 mb-4">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">MFA Enabled Successfully!</h2>
                    <p className="text-gray-600 mt-2">
                        Save these backup codes in a secure location
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                        <div className="flex">
                            <AlertCircle className="h-5 w-5 text-yellow-400" />
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">
                                    Important: Save Your Backup Codes
                                </h3>
                                <p className="text-sm text-yellow-700 mt-1">
                                    These codes can be used to access your account if you lose your authenticator device.
                                    Each code can only be used once.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-900">Backup Codes</h3>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => copyToClipboard(backupCodes.join('\n'))}
                                    className="text-sm text-blue-600 hover:text-blue-500 flex items-center"
                                >
                                    <Copy className="h-4 w-4 mr-1" />
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                                <button
                                    onClick={downloadBackupCodes}
                                    className="text-sm text-blue-600 hover:text-blue-500 flex items-center"
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {backupCodes.map((code, index) => (
                                <code key={index} className="bg-white px-2 py-1 rounded text-sm font-mono border text-center">
                                    {code}
                                </code>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleComplete}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                        Complete Setup
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default MFASetup;