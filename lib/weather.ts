const PIRASSUNUNGA_WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-21.9944&longitude=-47.4262&current=temperature_2m,weather_code&timezone=America/Sao_Paulo";

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
};

export type CurrentWeather = {
  temperatureCelsius: number;
  description: string;
};

export function describeWmoWeatherCode(code: number): string {
  if (code === 0) return "Céu limpo";
  if (code === 1) return "Predominantemente limpo";
  if (code === 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Nevoeiro";
  if ([51, 53, 55].includes(code)) return "Garoa";
  if (code === 56 || code === 57) return "Garoa congelante";
  if ([61, 63, 65].includes(code)) return "Chuva";
  if (code === 66 || code === 67) return "Chuva congelante";
  if ([71, 73, 75, 77].includes(code)) return "Neve";
  if ([80, 81, 82].includes(code)) return "Pancadas de chuva";
  if (code === 85 || code === 86) return "Pancadas de neve";
  if (code === 95) return "Trovoadas";
  if (code === 96 || code === 99) return "Trovoadas com granizo";
  return "Condição desconhecida";
}

export async function getPirassunungaWeather(): Promise<CurrentWeather> {
  const response = await fetch(PIRASSUNUNGA_WEATHER_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo respondeu com status ${response.status}`);
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  const temperature = payload.current?.temperature_2m;
  const weatherCode = payload.current?.weather_code;

  if (typeof temperature !== "number" || typeof weatherCode !== "number") {
    throw new Error("Resposta inválida da Open-Meteo");
  }

  return {
    temperatureCelsius: temperature,
    description: describeWmoWeatherCode(weatherCode),
  };
}
