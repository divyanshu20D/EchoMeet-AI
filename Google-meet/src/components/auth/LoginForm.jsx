import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Loader2, Mail, Lock, Shield } from 'lucide-react';

const LoginForm = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        mfaToken: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showMFA, setShowMFA] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/dashboard';

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        }

        if (showMFA && !formData.mfaToken) {
            newErrors.mfaToken = 'MFA token is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const result = await login(
                formData.email,
                formData.password,
                showMFA ? formData.mfaToken : null
            );

            if (result.success) {
                navigate(from, { replace: true });
            } else {
                // Check if MFA is required
                if (result.error?.includes('MFA') || result.error?.includes('2FA')) {
                    setShowMFA(true);
                    setErrors({ mfaToken: 'Please enter your MFA token' });
                } else {
                    setErrors({ general: result.error });
                }
            }
        } catch (error) {
            setErrors({ general: 'An unexpected error occurred' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-600">
                        <Shield className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
                        Sign in to VideoMeet
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-300">
                        Or{' '}
                        <Link
                            to="/register"
                            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            create a new account
                        </Link>
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm space-y-4">
                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="sr-only">
                                Email address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className={`appearance-none relative block w-full px-3 py-3 pl-10 border ${errors.email ? 'border-red-500' : 'border-gray-600'
                                        } placeholder-gray-400 text-white bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:z-10 sm:text-sm transition-colors`}
                                    placeholder="Email address"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    className={`appearance-none relative block w-full px-3 py-3 pl-10 pr-10 border ${errors.password ? 'border-red-500' : 'border-gray-600'
                                        } placeholder-gray-400 text-white bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:z-10 sm:text-sm transition-colors`}
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                                    ) : (
                                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-400">{errors.password}</p>
                            )}
                        </div>

                        {/* MFA Token Field */}
                        {showMFA && (
                            <div>
                                <label htmlFor="mfaToken" className="sr-only">
                                    MFA Token
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Shield className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="mfaToken"
                                        name="mfaToken"
                                        type="text"
                                        autoComplete="one-time-code"
                                        className={`appearance-none relative block w-full px-3 py-3 pl-10 border ${errors.mfaToken ? 'border-red-500' : 'border-gray-600'
                                            } placeholder-gray-400 text-white bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:z-10 sm:text-sm transition-colors`}
                                        placeholder="Enter 6-digit MFA code"
                                        value={formData.mfaToken}
                                        onChange={handleChange}
                                        maxLength="6"
                                    />
                                </div>
                                {errors.mfaToken && (
                                    <p className="mt-1 text-sm text-red-400">{errors.mfaToken}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-400">
                                    Enter the 6-digit code from your authenticator app
                                </p>
                            </div>
                        )}
                    </div>

                    {/* General Error */}
                    {errors.general && (
                        <div className="rounded-md bg-red-900 bg-opacity-50 p-4">
                            <p className="text-sm text-red-300">{errors.general}</p>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <Link
                                to="/forgot-password"
                                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Forgot your password?
                            </Link>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </div>

                    <div className="text-center">
                        <p className="text-sm text-gray-400">
                            Don't have an account?{' '}
                            <Link
                                to="/register"
                                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Sign up here
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;