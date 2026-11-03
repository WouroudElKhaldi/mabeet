import { TYPE, parse } from "@formatjs/icu-messageformat-parser";
import type { MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import arLB from "../../messages/ar-LB.json";
import en from "../../messages/en.json";

// English is the model. A key missing in Arabic would show a raw key such as "booking.title" to a guest, and a broken
// message ("{count" without its brace) stops the whole page, so the three files must hold exactly the same keys, each
// a real text that next-intl can read.

type Tree = { [key: string]: string | Tree };

/** Every text with its full key: `{ site: { tagline: "x" } }` gives `site.tagline` -> "x". */
function flatten(tree: Tree, prefix = ""): Map<string, unknown> {
  const texts = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      for (const [innerPath, text] of flatten(value, path)) texts.set(innerPath, text);
    } else {
      texts.set(path, value);
    }
  }
  return texts;
}

// Every name a message needs from the code: {name}, the number of a plural, a select, and rich tags such as <em>.
// Plural and select branches are read too, so "one {guest} other {guests}" (words, not names) is not mistaken for names.
function neededNames(elements: MessageFormatElement[], found = new Set<string>()): Set<string> {
  for (const element of elements) {
    switch (element.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        found.add(element.value);
        break;
      case TYPE.plural:
      case TYPE.select:
        found.add(element.value);
        for (const option of Object.values(element.options)) neededNames(option.value, found);
        break;
      case TYPE.tag:
        found.add(`<${element.value}>`);
        neededNames(element.children, found);
        break;
    }
  }
  return found;
}

function readMessage(text: string): MessageFormatElement[] | null {
  try {
    return parse(text, { requiresOtherClause: true });
  } catch {
    return null;
  }
}

// next-intl reads "a.b" as the key b inside a, so a dot inside a key name can never be found.
function keyNamesWithDots(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}/${key}` : key;
    const inner = typeof value === "object" ? keyNamesWithDots(value, path) : [];
    return key.includes(".") ? [path, ...inner] : inner;
  });
}

const english = flatten(en);
const translations = [
  { name: "ar.json", texts: flatten(ar) },
  { name: "ar-LB.json", texts: flatten(arLB) },
];
const everyFile = [{ name: "en.json", texts: english }, ...translations];

describe("language files", () => {
  it.each(translations)("$name has every English key and nothing extra", ({ texts }) => {
    const missing = [...english.keys()].filter((key) => !texts.has(key));
    const extra = [...texts.keys()].filter((key) => !english.has(key));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it.each(everyFile)("$name has no empty text", ({ texts }) => {
    const empty = [...texts]
      .filter(([, text]) => typeof text !== "string" || text.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it.each(everyFile)("$name has only texts next-intl can read", ({ texts }) => {
    const broken = [...texts]
      .filter(([, text]) => typeof text === "string" && readMessage(text) === null)
      .map(([key]) => key);
    expect(broken).toEqual([]);
  });

  it.each(translations)("$name needs the same {names} and <tags> as English", ({ texts }) => {
    const different: string[] = [];
    for (const [key, englishText] of english) {
      const translated = texts.get(key);
      if (typeof englishText !== "string" || typeof translated !== "string") continue;
      const expected = neededNames(readMessage(englishText) ?? []);
      const actual = neededNames(readMessage(translated) ?? []);
      if ([...expected].sort().join() !== [...actual].sort().join()) different.push(key);
    }
    expect(different).toEqual([]);
  });

  it("has no dot inside a key name", () => {
    expect([en, ar, arLB].flatMap((file) => keyNamesWithDots(file))).toEqual([]);
  });
});
