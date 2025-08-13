import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { API_CONFIG } from "../utils/api";

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketUrl = API_CONFIG.websocketURL;
    console.log("Connecting to WebSocket server at:", socketUrl);

    const newSocket = io(socketUrl, {
      transports: ["websocket", "polling"], // Add polling as fallback
      reconnection: true, // Enable reconnection
      reconnectionAttempts: 5, // Number of reconnection attempts
      reconnectionDelay: 1000, // Time between reconnection attempts (ms)
      timeout: 10000, // Increase connection timeout
      withCredentials: true, // Enable if you're using credentials
    });

    newSocket.on("connect", () => {
      console.log("Connected to server with ID:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected from server. Reason:", reason);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.off("connect");
        newSocket.off("disconnect");
        newSocket.off("connect_error");
        newSocket.close();
      }
    };
  }, []);

  if (!socket) {
    return <div>Connecting to server...</div>;
  }

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
