/**
 * Browser Device Fingerprint & Platform Utility
 * Generates persistent client device fingerprints and readable device identifiers
 */

export function getDeviceFingerprint(): string {
  let fp = localStorage.getItem("vorldx_device_fp");
  if (!fp) {
    const randomHex = Math.random().toString(16).substring(2, 10);
    const timeHex = Date.now().toString(16).slice(-6);
    fp = `fp_${navigator.language.replace(/[^a-zA-Z]/g, "")}_${timeHex}${randomHex}`;
    localStorage.setItem("vorldx_device_fp", fp);
  }
  return fp;
}

export function getDevicePlatform(): "Web" | "Windows" | "macOS" | "iOS" | "Android" {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  return "Web";
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = "Web Browser";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";

  const platform = getDevicePlatform();
  return `${browser} on ${platform}`;
}
