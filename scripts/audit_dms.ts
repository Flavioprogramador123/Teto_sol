import { parseGeorefText } from "../src/engine/georef";

function dmsToDd(deg: number, minutes: number, seconds: number, hemi: string): number {
  const sign = hemi === "S" || hemi === "W" || hemi === "O" ? -1 : 1;
  return sign * (deg + minutes / 60 + seconds / 3600);
}

const cases = [
  {
    text: `16°19'27.8"S 48°55'31.9"W`,
    expected: [-16.324392, -48.925526] as const,
    parts: [
      [16, 19, 27.8, "S"],
      [48, 55, 31.9, "W"],
    ] as const,
  },
  {
    text: `16°43'33.4"S 49°09'50.2"W`,
    expected: [-16.725952, -49.163954] as const,
    parts: [
      [16, 43, 33.4, "S"],
      [49, 9, 50.2, "W"],
    ] as const,
  },
];

for (const c of cases) {
  const [latP, lonP] = c.parts;
  const mLat = dmsToDd(...latP);
  const mLon = dmsToDd(...lonP);
  const p = parseGeorefText(c.text);
  console.log(c.text);
  console.log("  esperado ", c.expected[0].toFixed(6), c.expected[1].toFixed(6));
  console.log("  fórmula  ", mLat.toFixed(6), mLon.toFixed(6), "Δ", Math.abs(mLat - c.expected[0]).toExponential(3), Math.abs(mLon - c.expected[1]).toExponential(3));
  console.log(
    "  parser   ",
    p.latitude_deg?.toFixed(6),
    p.longitude_deg?.toFixed(6),
    "Δ",
    Math.abs((p.latitude_deg ?? 0) - c.expected[0]).toExponential(3),
    Math.abs((p.longitude_deg ?? 0) - c.expected[1]).toExponential(3),
  );
}
