import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { apiCall } from "../utils/api";

const HomePage = ({ onJoinMeeting }) => {
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const createRoom = async () => {
    if (!userName.trim()) {
      alert("Please enter your name");
      return;
    }

    setIsCreating(true);
    try {
      const response = await apiCall("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          hostName: userName,
          hostId: uuidv4(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onJoinMeeting({
          roomId: data.roomId,
          userId: data.hostId,
          userName: userName,
          isHost: true,
        });
      } else {
        alert("Failed to create room: " + data.error);
      }
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!userName.trim()) {
      alert("Please enter your name");
      return;
    }
    if (!roomId.trim()) {
      alert("Please enter room ID");
      return;
    }

    setIsJoining(true);
    try {
      console.log("Checking room:", roomId);
      // Check if room exists
      const response = await apiCall(`/api/rooms/${roomId}/participants`);
      console.log("Room check response:", response.status);

      if (response.ok) {
        console.log("Room exists, joining...");
        onJoinMeeting({
          roomId: roomId,
          userId: uuidv4(),
          userName: userName,
          isHost: false,
        });
      } else {
        const errorData = await response.json();
        console.log("Room not found:", errorData);
        alert("Room not found. Please check the room ID.");
      }
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Failed to join room. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Google Meet Clone
          </h1>
          <p className="text-gray-600">Connect with your team instantly</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="space-y-4">
            <button
              onClick={createRoom}
              disabled={isCreating || !userName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>Create New Meeting</span>
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID to join"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <button
              onClick={joinRoom}
              disabled={isJoining || !userName.trim() || !roomId.trim()}
              className="w-full cursor-pointer bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {isJoining ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Join Meeting</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Secure, reliable, and easy to use video conferencing
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
