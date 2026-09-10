const KEY = "localbeats:geo";

export const geoEnabled = () =>
  typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";

export const setGeoEnabled = (on: boolean) =>
  localStorage.setItem(KEY, on ? "1" : "0");

/**
 * Resolves to undefined rather than prompting. Location is opt-in via the
 * toggle: a permission prompt fired on someone's first play gets denied, and a
 * denial is sticky enough to kill the feature before it exists.
 */
export function coarsePosition(): Promise<
  { lat: number; lng: number } | undefined
> {
  if (!geoEnabled() || !navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 },
    );
  });
}
