import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Home, Calendar, Users, Settings, LogOut, User,
    Shield, Bell, HelpCircle, Menu, X, Video, Plus
} from 'lucide-react';

const Navigation = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, mfaStatus } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const navigationItems = [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Meetings', href: '/meetings', icon: Calendar },
        { name: 'Contacts', href: '/contacts', icon: Users },
        { name: 'Settings', href: '/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const getInitials = (name) => {
        return name
            ?.split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U';
    };

    const isActive = (href) => {
        return location.pathname === href || location.pathname.startsWith(href + '/');
    };

    return (
        <>
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:bg-gray-800 lg:border-r lg:border-gray-700">
                <div className="flex items-center h-16 px-6 bg-gray-900">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Video className="h-5 w-5 text-white" />
                        </div>
                        <span className="ml-3 text-xl font-semibold text-white">VideoMeet</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-y-auto">
                    <div className="px-3 py-4">
                        {/* Quick Actions */}
                        <div className="mb-6">
                            <Link
                                to="/meeting/new"
                                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                New Meeting
                            </Link>
                        </div>

                        {/* Navigation Items */}
                        <nav className="space-y-1">
                            {navigationItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(item.href)
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                            }`}
                                    >
                                        <Icon className="h-5 w-5 mr-3" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* User Profile */}
                    <div className="p-3 border-t border-gray-700">
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
                            >
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-bold">
                                        {getInitials(user?.name)}
                                    </span>
                                </div>
                                <div className="ml-3 flex-1 text-left">
                                    <p className="font-medium truncate">{user?.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                                </div>
                            </button>

                            {showUserMenu && (
                                <div className="absolute bottom-full mb-2 left-0 right-0 bg-gray-700 rounded-lg shadow-lg py-2">
                                    <Link
                                        to="/profile"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-4 py-2 text-sm text-white hover:bg-gray-600"
                                    >
                                        <User className="h-4 w-4 mr-3" />
                                        Profile
                                    </Link>

                                    <Link
                                        to="/security"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-4 py-2 text-sm text-white hover:bg-gray-600"
                                    >
                                        <Shield className="h-4 w-4 mr-3" />
                                        Security
                                        {!mfaStatus.isEnabled && (
                                            <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></span>
                                        )}
                                    </Link>

                                    <Link
                                        to="/notifications"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-4 py-2 text-sm text-white hover:bg-gray-600"
                                    >
                                        <Bell className="h-4 w-4 mr-3" />
                                        Notifications
                                    </Link>

                                    <div className="border-t border-gray-600 my-1"></div>

                                    <Link
                                        to="/help"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-4 py-2 text-sm text-white hover:bg-gray-600"
                                    >
                                        <HelpCircle className="h-4 w-4 mr-3" />
                                        Help & Support
                                    </Link>

                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            handleLogout();
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-gray-600"
                                    >
                                        <LogOut className="h-4 w-4 mr-3" />
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Navigation */}
            <div className="lg:hidden">
                {/* Mobile Header */}
                <div className="flex items-center justify-between h-16 px-4 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Video className="h-5 w-5 text-white" />
                        </div>
                        <span className="ml-3 text-xl font-semibold text-white">VideoMeet</span>
                    </div>

                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                    >
                        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />

                        <div className="fixed top-0 right-0 w-64 h-full bg-gray-800 shadow-xl">
                            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
                                <span className="text-lg font-semibold text-white">Menu</span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-4">
                                {/* Quick Action */}
                                <Link
                                    to="/meeting/new"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mb-6"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Meeting
                                </Link>

                                {/* Navigation Items */}
                                <nav className="space-y-1 mb-6">
                                    {navigationItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <Link
                                                key={item.name}
                                                to={item.href}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(item.href)
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                                    }`}
                                            >
                                                <Icon className="h-5 w-5 mr-3" />
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                </nav>

                                {/* User Section */}
                                <div className="border-t border-gray-700 pt-4">
                                    <div className="flex items-center px-3 py-2 mb-4">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-white text-sm font-bold">
                                                {getInitials(user?.name)}
                                            </span>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-white font-medium">{user?.name}</p>
                                            <p className="text-xs text-gray-400">{user?.email}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Link
                                            to="/profile"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg"
                                        >
                                            <User className="h-4 w-4 mr-3" />
                                            Profile
                                        </Link>

                                        <Link
                                            to="/security"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg"
                                        >
                                            <Shield className="h-4 w-4 mr-3" />
                                            Security
                                            {!mfaStatus.isEnabled && (
                                                <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></span>
                                            )}
                                        </Link>

                                        <button
                                            onClick={() => {
                                                setIsMobileMenuOpen(false);
                                                handleLogout();
                                            }}
                                            className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-lg"
                                        >
                                            <LogOut className="h-4 w-4 mr-3" />
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Spacer for Desktop */}
            <div className="hidden lg:block lg:w-64 lg:flex-shrink-0" />
        </>
    );
};

export default Navigation;