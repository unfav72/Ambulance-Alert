import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
import { notificationService } from '../services/notificationService.js';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribeToCase: (caseId: string) => void;
  unsubscribeFromCase: (caseId: string) => void;
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    notificationService.getPermission()
  );

  const requestNotificationPermission = async () => {
    const perm = await notificationService.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      notificationService.notify({
        title: '🔔 Emergency Notifications Active',
        body: 'You will receive real-time audio and browser alerts for critical dispatches and bed coordinations.',
        playSound: true,
      });
    }
    return perm;
  };

  useEffect(() => {
    // Connect to backend Socket.IO endpoint
    const newSocket = io('/', {
      auth: { token },
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
    });

    // Browser Notification Triggers on Live Socket Events
    newSocket.on('emergency:new', (caseData: any) => {
      notificationService.notify({
        title: '🚨 New Emergency Call Logged',
        body: `${caseData.caseNumber || 'Incident'} (${caseData.triagePriority || 'P1'}) - ${caseData.pickupAddress || 'Dispatched'}`,
        tag: `new-case-${caseData.id}`,
        playSound: true,
      });
    });

    newSocket.on('emergency:assigned', (data: any) => {
      notificationService.notify({
        title: '🚑 Ambulance Dispatched',
        body: `Ambulance ${data.ambulance?.callSign || 'Unit'} en route (ETA ~${data.etaMinutes || '5'} mins)`,
        tag: `assign-${data.caseId}`,
        playSound: true,
      });
    });

    newSocket.on('emergency:inbound_notice', (data: any) => {
      notificationService.notify({
        title: '🏥 Inbound Trauma Patient Notice',
        body: `Case ${data.caseNumber || ''} (${data.triagePriority || ''}) - ETA ~${data.etaMinutes || '10'}m`,
        tag: `inbound-${data.caseId}`,
        playSound: true,
      });
    });

    newSocket.on('hospital:response', (data: any) => {
      notificationService.notify({
        title: data.status === 'ACCEPTED' ? '✅ Hospital Accepted Patient' : '⚠️ Hospital Declined Patient',
        body: `${data.hospitalName || 'Hospital'}: ${data.responseReason || data.status}`,
        tag: `hosp-resp-${data.caseId}`,
        playSound: true,
      });
    });

    newSocket.on('emergency:status_change', (data: any) => {
      notificationService.notify({
        title: '📋 Case Status Update',
        body: `Incident status updated: ${data.status}`,
        tag: `status-${data.caseId}`,
        playSound: false,
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const subscribeToCase = (caseId: string) => {
    if (socket && isConnected) {
      socket.emit('subscribe:case', caseId);
    }
  };

  const unsubscribeFromCase = (caseId: string) => {
    if (socket && isConnected) {
      socket.emit('unsubscribe:case', caseId);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        subscribeToCase,
        unsubscribeFromCase,
        notificationPermission,
        requestNotificationPermission,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
