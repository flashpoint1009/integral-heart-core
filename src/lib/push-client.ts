import { getVapidPublicKey, savePushSubscription } from "@/lib/api/notifications.functions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

let registering = false;

export async function ensurePushSubscription(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (registering) return Notification.permission as any;
  registering = true;
  try {
    const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return perm;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await getVapidPublicKey();
      if (!publicKey) return "denied";
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const json = sub.toJSON();
    await savePushSubscription({
      data: {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        user_agent: navigator.userAgent,
      },
    });
    return "granted";
  } catch (e) {
    console.error("push subscribe failed", e);
    return "denied";
  } finally {
    registering = false;
  }
}