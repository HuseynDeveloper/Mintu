/**
 * Optional Live Weather Service (Open-Meteo, zero API key required)
 * Fails silently offline; only makes network requests when explicitly enabled.
 */

export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow" | "storm" | "fog";

export interface WeatherSettings {
  enabled: boolean;
  city: string;
  lat: number;
  lon: number;
}

export interface WeatherSnapshot {
  city: string;
  tempC: number;
  condition: WeatherCondition;
  isDay: boolean;
  fetchedAt: number;
}

const WEATHER_SETTINGS_KEY = "mintu_weather_settings_v1";
const CACHE_TTL_MS = 20 * 60 * 1000;

export function mapWmoCode(code: number): WeatherCondition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

export class WeatherService {
  private settings: WeatherSettings;
  private cached: WeatherSnapshot | null = null;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): WeatherSettings {
    const fallback: WeatherSettings = {
      enabled: false,
      city: "Baku",
      lat: 40.4093,
      lon: 49.8671,
    };
    if (typeof localStorage === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(WEATHER_SETTINGS_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        city: String(parsed.city || "Baku"),
        lat: Number(parsed.lat ?? 40.4093),
        lon: Number(parsed.lon ?? 49.8671),
      };
    } catch {
      return fallback;
    }
  }

  private saveSettings(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(WEATHER_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {}
  }

  public getSettings(): WeatherSettings {
    return { ...this.settings };
  }

  public setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.saveSettings();
  }

  public async setCity(cityName: string): Promise<WeatherSnapshot | null> {
    const trimmed = cityName.trim();
    if (!trimmed) return null;
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const first = data?.results?.[0];
      if (!first) return null;
      this.settings.city = String(first.name || trimmed);
      this.settings.lat = Number(first.latitude);
      this.settings.lon = Number(first.longitude);
      this.saveSettings();
      this.cached = null;
      return this.fetchWeather(true);
    } catch {
      return null;
    }
  }

  public getCached(): WeatherSnapshot | null {
    return this.cached;
  }

  public async fetchWeather(force: boolean = false): Promise<WeatherSnapshot | null> {
    if (!this.settings.enabled) return null;
    if (!force && this.cached && Date.now() - this.cached.fetchedAt < CACHE_TTL_MS) {
      return this.cached;
    }
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.settings.lat}&longitude=${this.settings.lon}&current=temperature_2m,weather_code,is_day`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const cur = data?.current;
      if (!cur) return null;
      this.cached = {
        city: this.settings.city,
        tempC: Math.round(Number(cur.temperature_2m ?? 0)),
        condition: mapWmoCode(Number(cur.weather_code ?? 0)),
        isDay: Number(cur.is_day ?? 1) === 1,
        fetchedAt: Date.now(),
      };
      return this.cached;
    } catch {
      return null;
    }
  }
}

export const weatherService = new WeatherService();
