/**
 * Mintu Inline Calculator & Unit Converter (v0.2.1)
 * Evaluates math expressions and common currency/unit conversions on the fly.
 */

export function tryEvaluateInline(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 50) return null;

  // 1. Math expressions
  if (/^[\d\s\+\-\*\/\%\^\(\)\.]+$/.test(trimmed) && /[\+\-\*\/\%\^]/.test(trimmed)) {
    try {
      const sanitized = trimmed.replace(/\^/g, "**");
      const fn = new Function(`"use strict"; return (${sanitized});`);
      const val = fn();
      if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
        return `= ${Number(val.toFixed(4))}`;
      }
    } catch {}
  }

  // 2. Simple currency & unit converter
  const convMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*(?:to|in|=)\s*([a-zA-Z]+)$/i);
  if (convMatch) {
    const num = parseFloat(convMatch[1]);
    const from = convMatch[2].toLowerCase();
    const to = convMatch[3].toLowerCase();

    const usdToAzn = 1.70;
    const eurToAzn = 1.84;
    const tryToAzn = 0.052;
    const rubToAzn = 0.018;

    if (from === "usd" && to === "azn") return `= ${(num * usdToAzn).toFixed(2)} AZN`;
    if (from === "azn" && to === "usd") return `= ${(num / usdToAzn).toFixed(2)} USD`;
    if (from === "eur" && to === "azn") return `= ${(num * eurToAzn).toFixed(2)} AZN`;
    if (from === "azn" && to === "eur") return `= ${(num / eurToAzn).toFixed(2)} EUR`;
    if (from === "try" && to === "azn") return `= ${(num * tryToAzn).toFixed(2)} AZN`;
    if (from === "rub" && to === "azn") return `= ${(num * rubToAzn).toFixed(2)} AZN`;
    if (from === "km" && to === "m") return `= ${(num * 1000).toLocaleString()} m`;
    if (from === "m" && to === "km") return `= ${(num / 1000).toFixed(3)} km`;
    if (from === "mb" && to === "gb") return `= ${(num / 1024).toFixed(2)} GB`;
    if (from === "gb" && to === "mb") return `= ${(num * 1024).toLocaleString()} MB`;
    if (from === "kg" && to === "g") return `= ${(num * 1000).toLocaleString()} g`;
    if (from === "g" && to === "kg") return `= ${(num / 1000).toFixed(3)} kg`;
  }

  return null;
}
