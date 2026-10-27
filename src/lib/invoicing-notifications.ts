export function browserNotificationsSupported() {
  return typeof window !== "undefined" && window.isSecureContext && "Notification" in window;
}

export async function requestBrowserNotifications() {
  if (!browserNotificationsSupported()) {
    throw new Error("This browser does not support system notifications.");
  }
  return window.Notification.requestPermission();
}

export function showBrowserNotification(title: string, body: string) {
  if (!body.trim() || !browserNotificationsSupported()) return;
  if (window.Notification.permission !== "granted") return;
  new window.Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: `codemath-${Date.now()}`,
  });
}
