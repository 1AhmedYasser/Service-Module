import { useEffect } from 'react';

import { CHAT_SESSIONS } from '../constants/consts';
import notificationApiDev from '../services/notificationApi';
import { generateUEID } from '../utils/generateUEID';

declare global {
  interface Window {
    __chatSessionInitialized__?: boolean;
  }
}

const useTabCloseEffect = () => {
  const isLocal = import.meta.env.REACT_APP_LOCAL?.toLowerCase() === 'true';
  const baseUrl: string = import.meta.env.REACT_APP_NOTIFICATION_NODE_URL ?? '';

  const isLastSession = (): boolean => {
    const currentState = JSON.parse(localStorage.getItem(CHAT_SESSIONS.SESSION_STATE_KEY) as string) || {
      ids: [],
      count: 0,
    };
    return currentState.count <= 1;
  };

  const getCurrentSessionState = () => {
    return JSON.parse(localStorage.getItem(CHAT_SESSIONS.SESSION_STATE_KEY) as string) || { ids: [], count: 0 };
  };

  const makeCall = (baseUrl: string, decision: 'add' | 'cancel') => {
    const logoutPath = '/add-to-logout-queue';
    const cancelLogoutPath = '/remove-from-logout-queue';

    try {
      const supportsBeacon = !!navigator.sendBeacon;
      const path = decision === 'add' ? logoutPath : cancelLogoutPath;

      if (supportsBeacon) {
        const blob = new Blob([], { type: 'application/x-www-form-urlencoded' });
        navigator.sendBeacon(baseUrl + path, blob);
      } else {
        return notificationApiDev.post(path);
      }
    } catch (err) {
      console.warn('Beacon failed, falling back to logout mutation', err);
      return notificationApiDev.post(decision === 'add' ? logoutPath : cancelLogoutPath);
    }
  };

  useEffect(() => {
    if (isLocal) return;

    void makeCall(baseUrl, 'cancel');

    const timeout = setTimeout(() => {
      return makeCall(baseUrl, 'cancel');
    }, 2500);

    return () => clearTimeout(timeout);
  }, [isLocal, baseUrl]);

  useEffect(() => {
    if (isLocal) return;
    if (window.__chatSessionInitialized__) return;

    window.__chatSessionInitialized__ = true;

    const tabId = sessionStorage.getItem(CHAT_SESSIONS.SESSION_ID_KEY) || generateUEID();
    sessionStorage.setItem(CHAT_SESSIONS.SESSION_ID_KEY, tabId);

    const currentState = getCurrentSessionState();
    if (!currentState.ids.includes(tabId)) {
      currentState.ids.push(tabId);
      currentState.count = currentState.ids.length;
      localStorage.setItem(CHAT_SESSIONS.SESSION_STATE_KEY, JSON.stringify(currentState));
    }

    const handleTabClose = () => {
      const currentAppState = JSON.parse(
        localStorage.getItem(CHAT_SESSIONS.SESSION_STATE_KEY) || '{"ids":[],"count":0}',
      );

      const updatedIds = currentAppState.ids.filter((id: string) => id !== tabId);
      localStorage.setItem(
        CHAT_SESSIONS.SESSION_STATE_KEY,
        JSON.stringify({ ids: updatedIds, count: updatedIds.length }),
      );

      const lastInitial = currentAppState.count <= 1;

      if (lastInitial && isLastSession()) {
        return makeCall(baseUrl, 'add');
      }
    };

    window.addEventListener('beforeunload', handleTabClose);

    return () => window.removeEventListener('beforeunload', handleTabClose);
  }, [isLocal, baseUrl]);
};

export default useTabCloseEffect;
