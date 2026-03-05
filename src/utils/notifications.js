/**
 * Browser notification utilities for GrooveSheet.
 * Uses the native Notification API to alert users when they've left the tab.
 */

/**
 * Request permission for browser notifications.
 * @returns {Promise<boolean>} Whether permission was granted.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Send a browser notification (only if the tab is hidden).
 * @param {string} title - Notification title.
 * @param {object} [options] - Notification options (body, icon, etc.).
 * @returns {Notification|null} The notification instance, or null if not sent.
 */
export function sendNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }
  if (!document.hidden) {
    return null;
  }
  const notification = new Notification(title, {
    icon: '/favicon.ico',
    ...options,
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
  return notification;
}
