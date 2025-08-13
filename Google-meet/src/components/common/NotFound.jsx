import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="max-w-lg w-full text-center">
                <div className="mb-8">
                    {/* 404 Illustration */}
                    <div className="relative mb-8">
                        <div className="text-9xl font-bold text-gray-800 select-none">
                            404
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Search className="h-16 w-16 text-gray-600" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-4">
                        Page Not Found
                    </h1>
                    <p className="text-gray-400 text-lg mb-8">
                        Sorry, we couldn't find the page you're looking for.
                        It might have been moved, deleted, or you entered the wrong URL.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 mr-2" />
                        Go Back
                    </button>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Home className="h-5 w-5 mr-2" />
                        Go to Dashboard
                    </button>
                </div>

                {/* Helpful Links */}
                <div className="border-t border-gray-700 pt-8">
                    <p className="text-gray-500 text-sm mb-4">
                        Here are some helpful links instead:
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 text-sm">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => navigate('/meetings')}
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            My Meetings
                        </button>
                        <button
                            onClick={() => navigate('/meeting/new')}
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Create Meeting
                        </button>
                        <button
                            onClick={() => navigate('/profile')}
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Profile Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotFound;