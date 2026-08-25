import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import {
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
} from "react-icons/fi";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (message: string, type: NotificationType = "info") => {
      const id = Math.random().toString(36).substring(2, 9);
      setNotifications((prev) => [...prev, { id, type, message }]);
    },
    [],
  );

  const success = useCallback(
    (message: string) => showNotification(message, "success"),
    [showNotification],
  );
  const error = useCallback(
    (message: string) => showNotification(message, "error"),
    [showNotification],
  );
  const warning = useCallback(
    (message: string) => showNotification(message, "warning"),
    [showNotification],
  );
  const info = useCallback(
    (message: string) => showNotification(message, "info"),
    [showNotification],
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{ showNotification, success, error, warning, info }}
    >
      {children}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRemove={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

const NotificationItem: React.FC<{
  notification: Notification;
  onRemove: () => void;
}> = ({ notification, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const styles = {
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    error: "bg-rose-50 text-rose-800 border-rose-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };

  const icons = {
    success: <FiCheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <FiXCircle className="w-5 h-5 text-rose-500" />,
    warning: <FiAlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <FiInfo className="w-5 h-5 text-blue-500" />,
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 border rounded-xl shadow-lg max-w-sm w-full animate-fade-in transition-all ${styles[notification.type]}`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[notification.type]}</div>
      <div className="flex-1 text-sm font-medium">{notification.message}</div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 ml-4 opacity-50 hover:opacity-100 transition-opacity focus:outline-none"
        aria-label="Close notification"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
};
