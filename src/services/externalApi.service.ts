import { VenueCoordinates, VenueWeather } from '../types/peer.types';

/** Current venue weather. Room names must be mapped to real coordinates by the caller. */
export async function fetchExternalPublicData(coordinates: VenueCoordinates): Promise<VenueWeather> {
  const fallback = (reason: VenueWeather['reason']): VenueWeather => ({
    source: 'open-meteo', available: false, temperatureC: null,
    weatherCode: null, observedAt: null, reason,
  });
  if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)
      || Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180) {
    return fallback('INVALID_COORDINATES');
  }

  const controller = new AbortController();
  // Covers both response headers and body consumption.
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(coordinates.latitude), longitude: String(coordinates.longitude),
      current: 'temperature_2m,weather_code', temperature_unit: 'celsius', timezone: 'GMT',
    }).toString();
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return fallback('UNAVAILABLE');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('current' in body)) return fallback('UNAVAILABLE');
    const current = body.current;
    if (!current || typeof current !== 'object'
        || !('temperature_2m' in current) || typeof current.temperature_2m !== 'number'
        || !Number.isFinite(current.temperature_2m)
        || !('weather_code' in current) || typeof current.weather_code !== 'number'
        || !Number.isInteger(current.weather_code)
        || !('time' in current) || typeof current.time !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(current.time)
        || !Number.isFinite(Date.parse(`${current.time}Z`))) {
      return fallback('UNAVAILABLE');
    }
    return {
      source: 'open-meteo', available: true, temperatureC: current.temperature_2m,
      weatherCode: current.weather_code, observedAt: `${current.time}Z`,
    };
  } catch {
    return fallback('UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}
