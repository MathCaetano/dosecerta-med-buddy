import { useEffect, useState } from "react";

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return "denied";
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (permission === "granted") {
      new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    }
  };

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported: "Notification" in window,
  };
};
