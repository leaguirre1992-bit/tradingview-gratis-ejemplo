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

// Simple in-memory cache to avoid rate limit (5 calls/min on free tier)
const cache = new Map<string, Candle[]>();

export async function fetchPolygonKlines(
  symbol: string,
  interval: Timeframe,
  limit = 50000
): Promise<Candle[]> {
  const cacheKey = `${symbol}_${interval}`;
  const { multiplier, timespan } = mapTimeframeToPolygon(interval);
  
  // Calculate from and to dates
  const to = Date.now();
  // We'll ask for up to 1 year for intraday, 5 years for daily/weekly
  const msPerYear = 365 * 24 * 60 * 60 * 1000;
  const from = timespan === "day" || timespan === "week" 
    ? to - (msPerYear * 5) 
    : to - msPerYear;

  // Use sort=desc to get the MOST RECENT candles up to the limit
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=desc&limit=${limit}&apiKey=${POLYGON_API_KEY}`;
  
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("Polygon error:", await res.text());
      if (res.status === 429) {
        console.warn("Polygon API rate limit exceeded. Using cached data if available.");
        return cache.get(cacheKey) || [];
      }
      throw new Error(`Polygon klines ${res.status}`);
    }
    
    const data = await res.json();
    if (!data.results) {
      return cache.get(cacheKey) || [];
    }
  
  // The results come sorted desc (newest first). We need to reverse them back for the chart.
  const reversed = [...data.results].reverse();
  
  // Formatter for New York timezone
  const nyFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parsed = reversed.map((k: any) => ({
    time: Math.floor(k.t / 1000), // convert ms to seconds for lightweight-charts
    open: k.o,
    high: k.h,
    low: k.l,
    close: k.c,
    volume: k.v,
    isFinal: true,
    _rawMs: k.t,
  }));

  if (timespan === "day" || timespan === "week") {
    cache.set(cacheKey, parsed);
    return parsed;
  }

    // Filter intraday candles to keep only Regular Trading Hours (RTH: 09:30 - 15:59 NY time)
    const finalData = parsed.filter((candle) => {
      const parts = nyFormatter.formatToParts(new Date(candle._rawMs));
      const hourStr = parts.find((p) => p.type === "hour")?.value;
      const minStr = parts.find((p) => p.type === "minute")?.value;
      if (!hourStr || !minStr) return true;
      
      const hour = parseInt(hourStr, 10);
      const min = parseInt(minStr, 10);
      const timeNum = hour * 100 + min; // e.g. 9:30 -> 930
      
      return timeNum >= 930 && timeNum < 1600;
    });

    cache.set(cacheKey, finalData);
    return finalData;
  } catch (err) {
    console.warn("Polygon API error/timeout. Returning cached data if available.", err);
    return cache.get(cacheKey) || [];
  }
}
