// Lebanon's regions (its governorates, Akkar with the North, Baalbek-Hermel with the Bekaa, Nabatieh with the
// South) and the towns and areas in each. A place and an experience store their region's key (the host picks it,
// or it is worked out from the town they typed), so searching for a region ("North Lebanon", "the north",
// "الشمال") is an exact match on it. The towns also match places whose region is not known. All lower case.

const REGIONS = {
  north: {
    names: [
      "north",
      "north lebanon",
      "the north",
      "shmal",
      "el shmal",
      "الشمال",
      "شمال لبنان",
      "لبنان الشمالي",
    ],
    areas: [
      "tripoli",
      "batroun",
      "ehden",
      "zgharta",
      "bcharre",
      "bsharri",
      "tannourine",
      "douma",
      "hasroun",
      "qadisha",
      "koura",
      "amioun",
      "chekka",
      "anfeh",
      "akkar",
      "halba",
      "qobayat",
      "kousba",
      "bakhoun",
    ],
  },
  "mount-lebanon": {
    names: ["mount lebanon", "jabal lebanon", "جبل لبنان"],
    areas: [
      "chouf",
      "deir el qamar",
      "beiteddine",
      "baakline",
      "barouk",
      "maasser",
      "aley",
      "bhamdoun",
      "souk el gharb",
      "metn",
      "broummana",
      "beit mery",
      "baskinta",
      "bikfaya",
      "dhour el choueir",
      "zaarour",
      "keserwan",
      "jounieh",
      "harissa",
      "faraya",
      "faqra",
      "kfardebian",
      "mzaar",
      "ehmej",
      "byblos",
      "jbeil",
      "laqlouq",
      "annaya",
      "aaqoura",
    ],
  },
  beirut: {
    names: ["beirut", "بيروت"],
    areas: ["beirut", "achrafieh", "hamra", "gemmayzeh", "mar mikhael", "verdun", "ras beirut", "badaro"],
  },
  bekaa: {
    names: ["bekaa", "beqaa", "the bekaa", "البقاع"],
    areas: [
      "bekaa",
      "zahle",
      "chtaura",
      "anjar",
      "baalbek",
      "hermel",
      "rachaya",
      "kefraya",
      "ammiq",
      "taanayel",
      "saghbine",
      "jdita",
    ],
  },
  south: {
    names: ["south", "south lebanon", "the south", "jnoub", "الجنوب", "جنوب لبنان"],
    areas: [
      "saida",
      "sidon",
      "tyre",
      "sour",
      "jezzine",
      "nabatieh",
      "naqoura",
      "marjayoun",
      "bint jbeil",
      "hasbaya",
      "rmeish",
    ],
  },
} as const;

export type RegionKey = keyof typeof REGIONS;

export const REGION_KEYS = Object.keys(REGIONS) as [RegionKey, ...RegionKey[]];

/** Lower case, accents and punctuation dropped, so "Ehden – Zgharta" reads as "ehden zgharta". */
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A region's key from its name in English, Arabic or Arabizi ("north lebanon" → "north"), or undefined. */
function regionNamed(text: string): RegionKey | undefined {
  const wanted = text.trim().toLowerCase();
  return (Object.keys(REGIONS) as RegionKey[]).find(
    (key) => key === wanted || (REGIONS[key].names as readonly string[]).includes(wanted),
  );
}

/**
 * The region a typed town or area is in ("Ehden" → north, "West Bekaa" → bekaa, "Bcharre, Qadisha" → north), or
 * null when it names none of the towns. Whole words only, so "Hamra" never matches inside another name.
 */
export function regionOfArea(area: string | null | undefined): RegionKey | null {
  if (!area) return null;
  const text = ` ${normalize(area)} `;
  const named = regionNamed(normalize(area));
  if (named) return named;
  return (
    REGION_KEYS.find((key) =>
      (REGIONS[key].areas as readonly string[]).some((town) => text.includes(` ${town} `)),
    ) ?? null
  );
}
