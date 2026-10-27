import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { requestBrowserNotifications } from "@/lib/invoicing-notifications";

type Props = {
  className?: string;
  iconOnly?: boolean;
};

export function NotificationPermissionButton({ className = "", iconOnly = false }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "insecure">(
    "unsupported",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(window.isSecureContext ? window.Notification.permission : "insecure");
  }, []);

  async function enableNotifications() {
    setError("");
    try {
      setPermission(await requestBrowserNotifications());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to enable notifications.");
    }
  }

  const Icon =
    permission === "granted"
      ? Check
      : permission === "denied" || permission === "insecure"
        ? BellOff
        : Bell;
  const label =
    permission === "granted"
      ? "Notifications enabled"
      : permission === "denied"
        ? "Notifications blocked"
        : permission === "unsupported"
          ? "Notifications unavailable"
          : permission === "insecure"
            ? "Notifications require HTTPS"
            : "Enable notifications";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void enableNotifications()}
        disabled={
          permission === "granted" || permission === "unsupported" || permission === "insecure"
        }
        aria-label={label}
        title={
          permission === "denied"
            ? "Allow notifications in this site's browser settings"
            : permission === "insecure"
              ? "Use HTTPS or localhost to enable system notifications"
              : label
        }
        className={
          className ||
          "inline-flex h-10 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium text-secondary hover:bg-muted disabled:cursor-default disabled:opacity-70"
        }
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md bg-destructive px-3 py-2 text-xs text-destructive-foreground shadow-lg"
        >
          {error}
        </span>
      )}
    </div>
  );
}
