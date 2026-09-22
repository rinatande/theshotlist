import type { Format } from "./types";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** "twenty-four" — the advisory writes its range in words (§5.2). */
export function inWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${inWords(n % 100)}` : ""}`;
  return String(n);
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a reel", "a 45-second cut", "a five-to-ten-minute piece". */
export function cutPhrase(format: Format): string {
  switch (format.delivery) {
    case "reel":
      return "a reel";
    case "short":
      return "a one-to-three-minute cut";
    case "mid":
      return "a five-to-ten-minute piece";
    case "long":
      return "a ten-to-twenty-minute film";
    case "custom": {
      const s = format.lengthSeconds ?? 60;
      return s < 120 ? `a ${s}-second cut` : `a ${Math.round(s / 60)}-minute cut`;
    }
  }
}
