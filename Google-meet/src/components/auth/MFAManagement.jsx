import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import MFASetup from './MFASetup';
import { Shield, Key, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

const MFAManagement = () => {
    const { mfaStatus, disableMFA, generateNewBackupCodes, fetchMFAStatus } = useAuth();
    const [showSetup, setShowSetup] = useState(false);
    const [showDisableConfirm, setShowDisableConfirm] = useState(false);
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [disableCode, setDisableCode] = useState('');
    const [isBackupCode, setIsBackupCode] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [newBackupCodes, setNewBackupCodes] = useState([]);

    const handleSetupComplete = async () => {
        setShowSetup(false);
        await fetchMFAStatus();
        setSuccess('MFA has been successfully enabled for your account!');
    };

    const handleDisableMFA = async () => {
        if (!disableCode.trim()) {
            setError('Please enter your authentication code');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await disableMFA(disableCode, isBackupCode);
            if (result.success) {
                setSuccess('MFA has been disabled for your account');
                setShowDisableConfirm(false);
                setDisableCode('');
                setIsBackupCode(false);
            } else {
                setError(result.error?.message || 'Failed to disable MFA');
            }
        } catch (error) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateBackupCodes = async () => {
        setIsLoading(true);
        setError('');

        try {
            const result = await generateNewBackupCodes();
            if (result.success) {
                setNewBackupCodes(result.data.backupCodes);
                setShowBackupCodes(true);
                setSuccess('New backup codes generated successfully');
            } else {
                setError(result.error?.message || 'Failed to generate backup codes');
            }
        } catch (error) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const copyBackupCodes = async () => {
        try {
            await navigator.clipboard.writeText(newBackupCodes.join('\n'));
            setSuccess('Backup codes copied to clipboard');
        } catch (error) {
            setError('Failed to copy backup codes');
        }
    };

    const downloadBackupCodes = () => {
        const codesText = newBackupCodes.join('\n');
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

    if (showSetup) {
        return (
            <MFASetup
                onComplete={handleSetupComplete}
                onCancel={() => setShowSetup(false)}
            />
        );
    }

    if (showBackupCodes) {
        return (
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-6">
                    <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100 mb-4">
                        <Key className="h-6 w-6 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">New Backup Codes</h2>
                    <p className="text-gray-600 mt-2">
                        Save these codes in a secure location
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                        <div className="flex">
                            <AlertTriangle className="h-5 w-5 text-yellow-400" />
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">
                                    Important: Save Your New Backup Codes
                                </h3>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Your old backup codes are no longer valid. Each new code can only be used once.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-900">Backup Codes</h3>
                            <div className="flex space-x-2">
                                <button
                                    onClick={copyBackupCodes}
                                    className="text-sm text-blue-600 hover:text-blue-500"
                                >
                                    Copy
                                </button>
                                <button
                                    onClick={downloadBackupCodes}
                                    className="text-sm text-blue-600 hover:text-blue-500"
                                >
                                    Download
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {newBackupCodes.map((code, index) => (
                                <code key={index} className="bg-white px-2 py-1 rounded text-sm font-mono border text-center">
                                    {code}
                                </code>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => setShowBackupCodes(false)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h2>
                <p className="text-gray-600">
                    Manage your account's two-factor authentication settings
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex">
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                        <div className="ml-3">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <div className="ml-3">
                            <p className="text-sm text-green-800">{success}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* MFA Status */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${mfaStatus.isEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Shield className={`h-5 w-5 ${mfaStatus.isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-gray-900">
                                Two-Factor Authentication
                            </h3>
                            <p className="text-sm text-gray-600">
                                {mfaStatus.isEnabled ? 'Enabled' : 'Disabled'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {mfaStatus.isEnabled ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {!mfaStatus.isEnabled ? (
                    <div className="text-center">
                        <button
                            onClick={() => setShowSetup(true)}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                        >
                            <Shield className="h-4 w-4 mr-2" />
                            Enable Two-Factor Authentication
                        </button>
                        <p className="text-sm text-gray-600 mt-2">
                            Secure your account with an additional layer of protection
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Backup Codes Status */}
                        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <Key className="h-5 w-5 text-gray-400" />
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900">Backup Codes</h3>
                                    <p className="text-sm text-gray-600">
                                        {mfaStatus.remainingBackupCodes} codes remaining
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleGenerateBackupCodes}
                                disabled={isLoading}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                )}
                                Generate New
                            </button>
                        </div>

                        {/* Disable MFA */}
                        {!showDisableConfirm ? (
                            <div className="text-center">
                                <button
                                    onClick={() => setShowDisableConfirm(true)}
                                    className="text-sm text-red-600 hover:text-red-500"
                                >
                                    Disable Two-Factor Authentication
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <h3 className="text-sm font-medium text-red-800 mb-3">
                                    Disable Two-Factor Authentication
                                </h3>
                                <p className="text-sm text-red-700 mb-4">
                                    This will make your account less secure. Enter your authentication code to confirm.
                                </p>

                                <div className="space-y-3">
                                    <div>
                                        <input
                                            type="text"
                                            value={disableCode}
                                            onChange={(e) => {
                                                setDisableCode(e.target.value.replace(/\D/g, '').slice(0, isBackupCode ? 8 : 6));
                                                if (error) setError('');
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center font-mono"
                                            placeholder={isBackupCode ? 'Enter backup code' : 'Enter 6-digit code'}
                                            maxLength={isBackupCode ? 8 : 6}
                                        />
                                    </div>

                                    <div className="flex items-center">
                                        <input
                                            id="useBackupCode"
                                            type="checkbox"
                                            checked={isBackupCode}
                                            onChange={(e) => {
                                                setIsBackupCode(e.target.checked);
                                                setDisableCode('');
                                            }}
                                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="useBackupCode" className="ml-2 text-sm text-gray-700">
                                            Use backup code instead
                                        </label>
                                    </div>

                                    <div className="flex space-x-3">
                                        <button
                                            onClick={() => {
                                                setShowDisableConfirm(false);
                                                setDisableCode('');
                                                setIsBackupCode(false);
                                                setError('');
                                            }}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDisableMFA}
                                            disabled={isLoading || !disableCode}
                                            className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                        >
                                            {isLoading ? (
                                                <div className="flex items-center justify-center">
                                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                    Disabling...
                                                </div>
                                            ) : (
                                                'Disable MFA'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MFAManagement;