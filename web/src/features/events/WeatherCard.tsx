import type { Weather } from '../../api/types';

interface WeatherCardProps {
  weather: Weather;
}

export function WeatherCard({ weather }: WeatherCardProps) {
  if (!weather.available || weather.temperatureC === null) {
    return (
      <section className="weather-card weather-unavailable" aria-labelledby="weather-title">
        <h2 id="weather-title">Weather</h2>
        <p>Weather is temporarily unavailable.</p>
      </section>
    );
  }

  return (
    <section className="weather-card" aria-labelledby="weather-title">
      <h2 id="weather-title">Weather</h2>
      <p className="weather-temperature">{weather.temperatureC}°C</p>
      <p>Open-Meteo observation for this event location.</p>
    </section>
  );
}
