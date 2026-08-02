import { readFile } from "node:fs/promises";

const parks = JSON.parse(
  await readFile(new URL("../public/data/parks.json", import.meta.url), "utf8"),
);
const index = JSON.parse(
  await readFile(new URL("../public/data/index.json", import.meta.url), "utf8"),
);
const keys = ["protection", "class1", "class2", "class3", "ordinary"];

if (parks.length !== 35 || index.count !== parks.length) throw new Error("Expected 35 parks");
if (new Set(parks.map((park) => park.id)).size !== parks.length)
  throw new Error("Duplicate park id");
if (new Set(parks.map((park) => park.name)).size !== parks.length)
  throw new Error("Duplicate park name");
const roundingDifferences = [];
for (const park of parks) {
  const sum = keys.reduce((total, key) => total + park[key], 0);
  const difference = sum - park.total;
  if (Math.abs(difference) > 5)
    throw new Error(`${park.name}: zone sum ${sum} differs from total ${park.total}`);
  if (difference !== 0) roundingDifferences.push({ name: park.name, differenceHa: difference });
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(park.designated)) throw new Error(`${park.name}: invalid date`);
  if (!Array.isArray(park.prefectures) || park.prefectures.length === 0)
    throw new Error(`${park.name}: prefectures`);
}
const totals = Object.fromEntries(
  ["total", ...keys].map((key) => [key, parks.reduce((sum, park) => sum + park[key], 0)]),
);
const expected = {
  total: index.totalAreaHa,
  protection: index.specialProtectionHa,
  class1: index.class1Ha,
  class2: index.class2Ha,
  class3: index.class3Ha,
  ordinary: index.ordinaryHa,
};
for (const [key, value] of Object.entries(expected)) {
  if (totals[key] !== value) throw new Error(`${key}: ${totals[key]} != ${value}`);
}
const prefectures = new Set(parks.flatMap((park) => park.prefectures));
if (prefectures.size !== index.prefectureCount) throw new Error(`prefectures: ${prefectures.size}`);

console.log(
  JSON.stringify({
    asOf: index.asOf,
    parks: parks.length,
    prefectures: prefectures.size,
    roundingDifferences,
    totals,
  }),
);
