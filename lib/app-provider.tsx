import React, { useEffect } from 'react';
import { initializeDatabase } from './database';
import { initializeNotifications } from './notifications';
import { useAppStore } from './store';

export function AppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database
      await initializeDatabase();

      // Initialize notifications
      await initializeNotifications();

      // Load app settings
      const { loadSettings } = useAppStore.getState();
      await loadSettings();

      console.log('Grocery Manager Pro initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  };

  return <>{children}</>;
}
