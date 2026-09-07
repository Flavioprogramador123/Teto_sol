export interface ReverseAddress {
  endereco: string;
  bairro: string;
  cidade: string;
  display: string;
  source: "nominatim";
}

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  path?: string;
  residential?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  city_district?: string;
  state?: string;
  postcode?: string;
};

function streetLine(a: NominatimAddress): string {
  const road = a.road || a.pedestrian || a.path || a.residential || "";
  if (!road) return "";
  return a.house_number ? `${road}, ${a.house_number}` : road;
}

function bairroLine(a: NominatimAddress): string {
  return (a.neighbourhood || a.suburb || a.city_district || "").trim();
}

function cityLine(a: NominatimAddress): string {
  const city = a.city || a.town || a.village || a.municipality || "";
  const uf = a.state
    ? a.state
        .replace(/^Estado\s+(d[aeo]\s+)?/i, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
  if (city && uf) return `${city} - ${uf}`;
  if (city) return city;
  // sem cidade explícita, usa bairro/distrito só como último recurso
  const fallback = a.suburb || a.city_district || "";
  return fallback && uf ? `${fallback} - ${uf}` : fallback || uf;
}

export function formatNominatim(data: {
  display_name?: string;
  address?: NominatimAddress;
}): ReverseAddress {
  const a = data.address ?? {};
  let endereco = streetLine(a);
  let bairro = bairroLine(a);
  let cidade = cityLine(a);
  const display = data.display_name?.trim() || "";

  // Fallback: parseia display_name tipo "Rua X, 10, Bairro, Cidade - GO, Brasil"
  if (display && (!endereco || !cidade)) {
    const parts = display.split(",").map((p) => p.trim()).filter(Boolean);
    if (!endereco && parts[0]) {
      const maybeNum = parts[1] && /^\d/.test(parts[1]) ? parts[1] : "";
      endereco = maybeNum ? `${parts[0]}, ${maybeNum}` : parts[0];
    }
    if (!bairro && parts.length >= 3) {
      const candidate = parts.find(
        (p, i) => i > 0 && !/^\d/.test(p) && !/\b(Brasil|Brazil|GO|SP|MG|DF)\b/i.test(p) && !p.includes(" - "),
      );
      if (candidate && candidate !== endereco.split(",")[0]) bairro = bairro || candidate;
    }
    if (!cidade) {
      const withUf = parts.find((p) => /\s-\s*[A-Z]{2}\b/.test(p) || /^[A-Za-zÀ-ú\s]+-\s*[A-Z]{2}$/.test(p));
      cidade = withUf || parts.find((p) => /Goiânia|Anápolis|Brasília|São Paulo/i.test(p)) || parts[parts.length - 3] || "";
    }
  }

  return {
    endereco: endereco || display.split(",")[0]?.trim() || "",
    bairro,
    cidade: cidade || "",
    display: display || [endereco, bairro, cidade].filter(Boolean).join(" · "),
    source: "nominatim",
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseAddress> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(
      `/api/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      { signal: ctrl.signal },
    );
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      display_name?: string;
      address?: NominatimAddress;
    };
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Não foi possível obter o endereço.");
    }
    const formatted = formatNominatim(data);
    if (!formatted.endereco && !formatted.cidade && !formatted.bairro) {
      throw new Error("O ponto não retornou endereço legível.");
    }
    return formatted;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo esgotado ao consultar o endereço (OpenStreetMap).");
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}
