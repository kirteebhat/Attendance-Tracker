/**
 * Semantic versioning comparison utilities for application releases and OTA update checks.
 */

export function normalizeSemver(version: string): string {
  if (!version) return "0.0.0";
  let v = String(version).trim();
  if (v.startsWith("v") || v.startsWith("V")) {
    v = v.substring(1);
  }
  // Strip prerelease or build metadata tags
  const [core] = v.split(/[-+]/);
  return core || "0.0.0";
}

/**
 * Compare two semantic version strings (v1 and v2).
 * Returns:
 *  -1 if v1 < v2
 *   0 if v1 === v2
 *   1 if v1 > v2
 */
export function compareSemver(v1: string, v2: string): number {
  const norm1 = normalizeSemver(v1);
  const norm2 = normalizeSemver(v2);

  const parts1 = norm1.split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = norm2.split(".").map((n) => parseInt(n, 10) || 0);

  while (parts1.length < 3) parts1.push(0);
  while (parts2.length < 3) parts2.push(0);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] < parts2[i]) return -1;
    if (parts1[i] > parts2[i]) return 1;
  }

  return 0;
}

/**
 * Returns true if current is strictly older than target.
 */
export function isVersionOlder(current: string, target: string): boolean {
  return compareSemver(current, target) < 0;
}

/**
 * Returns true if current version is strictly below minimum required version.
 */
export function isBelowMinSupportedVersion(current: string, minSupported: string): boolean {
  return compareSemver(current, minSupported) < 0;
}
