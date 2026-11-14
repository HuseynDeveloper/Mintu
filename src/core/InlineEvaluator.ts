/**
 * Mintu Inline Calculator & Unit Converter (v0.2.1)
 * Evaluates math expressions and common currency/unit conversions on the fly.
 * Uses a safe recursive-descent parser instead of eval/Function.
 */

/**
 * Recursive-descent math parser supporting:
 *   +, -, *, /, %, ^, ** (right-associative exponentiation)
 *   unary + and -
 *   decimal numbers
 *   parentheses
 * Returns null on any parse error or non-finite result.
 */
export function evaluateMath(input: string): number | null {
  const src = input;
  let pos = 0;

  function peek(): string {
    return pos < src.length ? src[pos] : "";
  }

  function skipSpaces(): void {
    while (pos < src.length && (src[pos] === " " || src[pos] === "\t")) {
      pos++;
    }
  }

  function parseAtom(): number | null {
    skipSpaces();

    // Parenthesised sub-expression
    if (peek() === "(") {
      pos++; // consume '('
      const val = parseExpr();
      if (val === null) return null;
      skipSpaces();
      if (peek() !== ")") return null; // unmatched paren
      pos++; // consume ')'
      return val;
    }

    // Unary + or -
    if (peek() === "+" || peek() === "-") {
      const sign = peek() === "-" ? -1 : 1;
      pos++;
      const val = parseAtom();
      if (val === null) return null;
      return sign * val;
    }

    // Numeric literal
    if (peek() >= "0" && peek() <= "9" || peek() === ".") {
      let s = "";
      while (pos < src.length && ((src[pos] >= "0" && src[pos] <= "9") || src[pos] === ".")) {
        s += src[pos++];
      }
      if (s === "" || s === ".") return null;
      const n = Number(s);
      return isNaN(n) ? null : n;
    }

    return null; // unexpected character
  }

  // Right-associative exponentiation: parseAtom (^ | **) parsePow
  function parsePow(): number | null {
    const base = parseAtom();
    if (base === null) return null;
    skipSpaces();
    // Handle ** (two chars)
    if (pos + 1 < src.length && src[pos] === "*" && src[pos + 1] === "*") {
      pos += 2;
      const exp = parsePow(); // right-associative
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    // Handle ^
    if (peek() === "^") {
      pos++;
      const exp = parsePow(); // right-associative
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  }

  // Multiplicative: *, /, %
  function parseMul(): number | null {
    let left = parsePow();
    if (left === null) return null;
    while (true) {
      skipSpaces();
      if (peek() === "*") {
        // Make sure it's not ** (exponent)
        if (pos + 1 < src.length && src[pos + 1] === "*") break;
        pos++;
        const right = parsePow();
        if (right === null) return null;
        left *= right;
      } else if (peek() === "/") {
        pos++;
        const right = parsePow();
        if (right === null) return null;
        left /= right;
      } else if (peek() === "%") {
        pos++;
        const right = parsePow();
        if (right === null) return null;
        left %= right;
      } else {
        break;
      }
    }
    return left;
  }

  // Additive: +, -
  function parseExpr(): number | null {
    let left = parseMul();
    if (left === null) return null;
    while (true) {
      skipSpaces();
      // Detect adjacent digit tokens like "3 3" - whitespace between two numbers is a syntax error
      if (peek() >= "0" && peek() <= "9") return null;
      if (peek() === "+") {
        pos++;
        // Reject "1 + + " style trailing operator
        skipSpaces();
        if (peek() === "" || peek() === ")") return null;
        const right = parseMul();
        if (right === null) return null;
        left += right;
      } else if (peek() === "-") {
        pos++;
        skipSpaces();
        if (peek() === "" || peek() === ")") return null;
        const right = parseMul();
        if (right === null) return null;
        left -= right;
      } else {
        break;
      }
    }
    return left;
  }

  const result = parseExpr();
  if (result === null) return null;

  skipSpaces();

  // Whitespace between two digit sequences (e.g. "3 3 + 1") detection:
  // If there are still characters left in the string that are not consumed, it is a syntax error.
  if (pos !== src.length) return null;

  if (!isFinite(result) || isNaN(result)) return null;
  return result;
}

export function tryEvaluateInline(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 50) return null;

  // 1. Math expressions
  if (/^[\d\s\+\-\*\/\%\^\(\)\.]+$/.test(trimmed) && /[\+\-\*\/\%\^]/.test(trimmed)) {
    const val = evaluateMath(trimmed);
    if (val !== null && isFinite(val)) {
      return `= ${Number(val.toFixed(4))}`;
    }
    return null;
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
