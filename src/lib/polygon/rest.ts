import type { Candle, Timeframe } from "../binance/types";

// Polygon API Key provided by the user
const POLYGON_API_KEY = "wczKHszyqVcek7cuiEY5RqBsRfxks2xL";

export function mapTimeframeToPolygon(timeframe: Timeframe): { multiplier: number; timespan: string } {
  switch (timeframe) {
    case "1m": return { multiplier: 1, timespan: "minute" };
    case "2m": return { multiplier: 2, timespan: "minute" };
    case "5m": return { multiplier: 5, timespan: "minute" };
    case "10m": return { multiplier: 10, timespan: "minute" };
    case "15m": return { multiplier: 15, timespan: "minute" };
    case "1h": return { multiplier: 1, timespan: "hour" };
    case "4h": return { multiplier: 4, timespan: "hour" };
    case "1d": return { multiplier: 1, timespan: "day" };
    case "1w": return { multiplier: 1, timespan: "week" };
    default: return { multiplier: 1, timespan: "day" };
  }
}

export async function fetchPolygonKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000
): Promise<Candle[]> {
  const { multiplier, timespan } = mapTimeframeToPolygon(interval);
  
  // Calculate from and to dates
  const to = Date.now();
  
  // Estimate time range based on limit and timespan to fetch enough data
  const msPerMinute = 60000;
  let msMultiplier = msPerMinute;
  if (timespan === "hour") msMultiplier = msPerMinute * 60;
  if (timespan === "day") msMultiplier = msPerMinute * 60 * 24;
  if (timespan === "week") msMultiplier = msPerMinute * 60 * 24 * 7;
  
  // Fetch a bit more to ensure we get `limit` candles (accounting for weekends)
  const from = to - (limit * multiplier * msMultiplier * 2);

  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${POLYGON_API_KEY}`;
  
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error("Polygon error:", await res.text());
    throw new Error(`Polygon klines ${res.status}`);
  }
  
  const data = await res.json();
  if (!data.results) return [];
  
  return data.results.map((k: any) => ({
    time: Math.floor(k.t / 1000), // convert ms to seconds for lightweight-charts
    open: k.o,
    high: k.h,
    low: k.l,
    close: k.c,
    volume: k.v,
    isFinal: true,
  }));
}
