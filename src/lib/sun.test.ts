import { describe, expect, it } from "vitest";
import { clockIn, round5, sunInstants, sunTimes } from "./sun";

// Reference times are published almanac values; the equation is good to a
// couple of minutes, so that's the tolerance.
const near = (actual: number | undefined, expected: number, within = 3) => {
  expect(actual).toBeDefined();
  expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(within);
};
const hm = (h: number, m: number) => h * 60 + m;

describe("sunTimes", () => {
  it("London at midsummer: sunrise 04:43, sunset 21:21 BST", () => {
    const t = sunTimes("2026-06-21", { lat: 51.5074, lng: -0.1278, timeZone: "Europe/London" });
    near(t.sunrise, hm(4, 43));
    near(t.sunset, hm(21, 21));
  });

  it("Sydney near the equinox: a 12-hour day, about 05:49 to 17:50 AEST", () => {
    const t = sunTimes("2026-09-19", { lat: -33.8688, lng: 151.2093, timeZone: "Australia/Sydney" });
    near(t.sunrise, hm(5, 49), 4);
    near(t.sunset, hm(17, 50), 4);
  });

  it("Kyoto in late September reads in Japan time, wherever the phone is", () => {
    const t = sunTimes("2026-09-25", { lat: 35.0116, lng: 135.7681, timeZone: "Asia/Tokyo" });
    near(t.sunrise, hm(5, 43), 4);
    near(t.sunset, hm(17, 48), 4);
  });

  it("puts golden hour inside the day, after sunrise and before sunset", () => {
    const t = sunTimes("2026-09-19", { lat: -33.8688, lng: 151.2093, timeZone: "Australia/Sydney" });
    expect(t.goldenMorningEnd!).toBeGreaterThan(t.sunrise!);
    expect(t.goldenEveningStart!).toBeLessThan(t.sunset!);
    // Roughly half an hour to an hour at this latitude.
    expect(t.goldenMorningEnd! - t.sunrise!).toBeGreaterThan(20);
    expect(t.goldenMorningEnd! - t.sunrise!).toBeLessThan(70);
  });

  it("has no sunrise in a polar night", () => {
    const s = sunInstants("2026-12-21", 78.22, 15.65); // Svalbard
    expect(s.sunrise).toBeNull();
    expect(s.sunset).toBeNull();
  });
});

describe("helpers", () => {
  it("reads an instant as a clock time in a zone", () => {
    expect(clockIn(new Date("2026-09-19T20:10:00Z"), "Australia/Sydney")).toBe(hm(6, 10));
  });

  it("rounds up to five minutes, so a quick time lands inside the light", () => {
    expect(round5(1037)).toBe(1040);
    expect(round5(360)).toBe(360);
  });
});
