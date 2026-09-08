import { generateLayout } from "./layout";
import { sortModulesReadingOrder } from "./launch";
import { buildingHeadingDeg, cardinalDirectionPt, computeScale, lineAzimuthDeg, orderHeadingEndpoints } from "./scale";
import { DEFAULT_MODULE } from "../types";
import { polygonsTouchOrOverlap, rectPolygon } from "./geometry";
import { DEFAULT_ROOF_PLANE, fallAxis, roofGridDeg, roofPlaneOf, slopeToDegrees, surfaceFactor } from "./roofPlane";
import { parseEarthMeters, parseGeorefText } from "./georef";
import { formatNominatim } from "./reverseGeocode";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const scale = computeScale([0, 0], [100, 0], 10);
assert(Math.abs(scale.pixels_per_meter - 10) < 1e-9, "escala 10 px/m");

const roof = {
  id: "area-1",
  name: "Telhado teste",
  polygon_px: [
    [0, 0],
    [200, 0],
    [200, 140],
    [0, 140],
  ] as [number, number][],
  azimuth_deg: null,
  tilt_deg: null,
  allowed_orientations: ["paisagem" as const, "retrato" as const],
  margin_m: 0.3,
  height_from_ground_m: 3,
  active: true,
};

const first = generateLayout({
  areas: [roof],
  obstacles: [],
  module: { ...DEFAULT_MODULE },
  meters_per_pixel: scale.meters_per_pixel,
  grid_step_m: 0.2,
});

assert(first.installed === 18, `esperava 18 módulos, veio ${first.installed}`);
assert(first.status === "Aprovado", `status ${first.status}`);
assert(Math.abs(first.power_kwp - 12.24) < 1e-9, `potência ${first.power_kwp}`);

const second = generateLayout({
  areas: [roof],
  obstacles: [],
  module: { ...DEFAULT_MODULE },
  meters_per_pixel: scale.meters_per_pixel,
  grid_step_m: 0.2,
});
assert(second.installed === first.installed, "resultado deve ser determinístico");
assert(second.best.modules[0].x_m === first.best.modules[0].x_m, "mesma origem");

for (const m of first.best.modules) {
  for (const n of first.best.modules) {
    if (m.id === n.id) continue;
    const overlap = polygonsTouchOrOverlap(
      rectPolygon(m.x_m, m.y_m, m.width_m, m.height_m),
      rectPolygon(n.x_m, n.y_m, n.width_m, n.height_m),
    );
    assert(!overlap, "módulos não podem se sobrepor");
  }
}

const blocked = generateLayout({
  areas: [roof],
  obstacles: [
    {
      id: "obstaculo-01",
      type: "caixa_dagua",
      name: "Caixa",
      polygon_px: [
        [20, 20],
        [80, 20],
        [80, 80],
        [20, 80],
      ] as [number, number][],
      safety_margin_m: 0.8,
      height_from_ground_m: 4.5,
      excluded: true,
    },
  ],
  module: { ...DEFAULT_MODULE, quantity_target: 18 },
  meters_per_pixel: scale.meters_per_pixel,
  grid_step_m: 0.2,
});
assert(blocked.installed <= first.installed, "obstáculo não pode aumentar a quantidade");

assert(Math.abs(slopeToDegrees(30) - 16.699) < 0.01, "30% deve ser ~16,70°");
assert(Math.abs(surfaceFactor(30) - 1.04403) < 0.001, "fator de 30%");

const geo = parseGeorefText("16°19.4580'S 48°55.5277'W Câmera: 1.074 m 1.025 m 6 m 21/07/2026");
assert(geo.north_up, "norte para cima");
assert(Math.abs((geo.latitude_deg ?? 0) - -(16 + 19.458 / 60)) < 1e-6, "latitude Earth");
assert(Math.abs((geo.longitude_deg ?? 0) - -(48 + 55.5277 / 60)) < 1e-6, "longitude Earth");
assert(geo.scale_bar_m === 6, `barra ${geo.scale_bar_m}`);
assert(geo.camera_m === 1074, `câmera ${geo.camera_m}`);
assert(geo.elevation_m === 1025, `solo ${geo.elevation_m}`);
assert(geo.imagery_date === "21/07/2026", "data Earth");
assert(parseEarthMeters("1.074", "camera") === 1074, "milhar PT-BR");
const geoOcr = parseGeorefText("6 m Camera: 1.074 m 16?19.4580'S 48?55.5277'W 1.025 m");
assert(geoOcr.confidence === "high", "OCR com ? no grau");
assert(Math.abs((geoOcr.latitude_deg ?? 0) - -(16 + 19.458 / 60)) < 1e-6, "lat OCR");
assert(Math.abs((geoOcr.longitude_deg ?? 0) - -(48 + 55.5277 / 60)) < 1e-6, "lon OCR");
assert(geoOcr.scale_bar_m === 6 && geoOcr.elevation_m === 1025, "ordem fixa com OCR");
const geoColon = parseGeorefText("6m Câmera: 1.074 m 16: 19.4580'S 48'55.5277 W 1.025 m");
assert(geoColon.confidence === "high", "OCR com : e ' no grau");
assert(Math.abs((geoColon.latitude_deg ?? 0) - -(16 + 19.458 / 60)) < 1e-6, "lat colon OCR");
assert(Math.abs((geoColon.longitude_deg ?? 0) - -(48 + 55.5277 / 60)) < 1e-6, "lon quote OCR");
const geoDms = parseGeorefText("16°19'27.48\"S 48°55'31.66\"W Câmera: 1.074 m 6 m");
assert(geoDms.confidence === "high", "formato DMS");
assert(Math.abs((geoDms.latitude_deg ?? 0) - -(16 + 19 / 60 + 27.48 / 3600)) < 1e-6, "lat DMS");
assert(Math.abs((geoDms.longitude_deg ?? 0) - -(48 + 55 / 60 + 31.66 / 3600)) < 1e-6, "lon DMS");
const geoDd = parseGeorefText("Câmera: 1.074 m -16.324300, -48.925462 6 m");
assert(geoDd.confidence === "high", "formato graus decimais");
assert(Math.abs((geoDd.latitude_deg ?? 0) + 16.3243) < 1e-4, "lat DD");
assert(Math.abs(lineAzimuthDeg([0, 0], [1, 0]) - 90) < 1e-6, "leste = 90°");
assert(Math.abs(lineAzimuthDeg([0, 0], [0, 1]) - 180) < 1e-6, "sul = 180°");
assert(Math.abs(buildingHeadingDeg([0, 0], [0, 1]) - 180) < 1e-6, "rumo aceita sul");
assert(Math.abs(buildingHeadingDeg([0, 1], [0, 0]) - 0) < 1e-6, "rumo aceita norte (sentido do clique)");
{
  const sul = orderHeadingEndpoints([0, 0], [0, 10]);
  assert(sul.point_b[1] > sul.point_a[1], "seta para o sul no último ponto");
  assert(Math.abs(sul.azimuth_deg - 180) < 1e-6, "azimute sul");
  assert(cardinalDirectionPt(sul.azimuth_deg) === "sul", "cardeal sul");
  const so = orderHeadingEndpoints([0, 0], [-1, 1]);
  assert(cardinalDirectionPt(so.azimuth_deg) === "sudoeste", "cardeal sudoeste");
}
assert(Math.abs(lineAzimuthDeg([0, 0], [0, -1])) < 1e-6, "norte = 0°");
assert(cardinalDirectionPt(0) === "norte", "0° = norte");
assert(cardinalDirectionPt(90) === "leste", "90° = leste");
assert(cardinalDirectionPt(135) === "sudeste", "135° = sudeste");
assert(cardinalDirectionPt(225) === "sudoeste", "225° = sudoeste");
assert(cardinalDirectionPt(315) === "noroeste", "315° = noroeste");
assert(cardinalDirectionPt(16.8) === "norte", "16.8° ≈ norte");
assert(fallAxis(93) === "x", "casa a 93° cai no eixo leste-oeste");
assert(fallAxis(0) === "y", "0° norte estica o eixo Y");
assert(
  roofPlaneOf({
    ...roof,
    azimuth_deg: 93,
    roof_plane: { ...DEFAULT_ROOF_PLANE, fall_direction_deg: 90 },
  }).fall_direction_deg === 93,
  "azimute da casa manda na queda",
);
assert(Math.abs(roofGridDeg({ ...roof, azimuth_deg: 90 }) ) < 1e-6, "90° = grade horizontal");
assert(Math.abs(roofGridDeg({ ...roof, azimuth_deg: 93 }) - 3) < 1e-6, "93° = 3° de desvio");
const place = formatNominatim({
  display_name: "Rua Teste, 10, Goiânia - Goiás, Brasil",
  address: { road: "Rua Teste", house_number: "10", city: "Goiânia", state: "Goiás" },
});
assert(place.endereco === "Rua Teste, 10", "endereço Nominatim");
assert(place.cidade.includes("Goiânia"), "cidade Nominatim");
const place2 = formatNominatim({
  display_name: "Rua A, Bairro Centro, Goiânia",
  address: {
    road: "Rua A",
    neighbourhood: "Centro",
    city: "Goiânia",
    state: "Goiás",
  },
});
assert(place2.bairro === "Centro", "bairro Nominatim");
const tilted = generateLayout({
  areas: [{ ...roof, azimuth_deg: 93 }],
  obstacles: [],
  module: { ...DEFAULT_MODULE },
  meters_per_pixel: scale.meters_per_pixel,
  grid_step_m: 0.2,
});
assert(tilted.installed > 0, "encaixa no telhado a 93°");
assert(Math.abs((tilted.best.modules[0]?.rotation_deg ?? 0) - 3) < 1e-6, "módulos giram 3°");

{
  const stub = (id: string, x: number, y: number, area: string) => ({
    id,
    x_m: x,
    y_m: y,
    width_m: 1,
    height_m: 2,
    orientation: "retrato" as const,
    source: "manual" as const,
    violation: null,
    area_id: area,
  });
  // Área B mais abaixo; dentro de A: topo-direita primeiro
  const sorted = sortModulesReadingOrder([
    stub("a1", 0, 0, "A"),
    stub("a2", 3, 0, "A"),
    stub("a3", 0, 3, "A"),
    stub("b1", 0, 10, "B"),
    stub("b2", 3, 10, "B"),
  ]);
  assert(sorted.map((m) => m.id).join(",") === "a2,a1,a3,b2,b1", "numeração D→E / cima→baixo / área a área");
}

console.log("selfcheck ok", {
  installed: first.installed,
  kwp: first.power_kwp,
  withObstacle: blocked.installed,
});
