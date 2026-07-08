export const API_PATH_PREFIX = "/api/";
export const API_NETWORK_ONLY_CACHE_NAME = "spindle-api-network-only";

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith(API_PATH_PREFIX);
}

export function canRecommendWhileOffline(isOnline: boolean): boolean {
  return isOnline;
}
