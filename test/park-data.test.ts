import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Park = {
  id: string;
  name: string;
  designated: string;
  era: string;
  prefectures: string[];
  total: number;
  protection: number;
  class1: number;
  class2: number;
  class3: number;
  ordinary: number;
};

const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const parks = JSON.parse(readFileSync(resolve(root, "public/data/parks.json"), "utf8")) as Park[];
const find = (name: string) => parks.find((park) => park.name === name);
const sum = (
  key: keyof Pick<Park, "total" | "protection" | "class1" | "class2" | "class3" | "ordinary">,
) => parks.reduce((total, park) => total + park[key], 0);

describe("official national-park zoning table", () => {
  it("retains verified source metadata and dimensions", () => {
    expect(index).toMatchObject({
      asOf: "2026-04-10",
      count: 35,
      totalAreaHa: 2447855,
      specialProtectionHa: 366129,
      class1Ha: 331776,
      class2Ha: 549772,
      class3Ha: 585134,
      ordinaryHa: 615044,
      prefectureCount: 42,
    });
    expect(index.sourceSha256).toEqual({
      overviewPdf: "648195b060ac2545208e09239c30c9cf26ec37bd1ba47ad0f0d53c1a068197a4",
      zoningPdf: "7cfa24b4c1be30219aef2a375a20e54b499a21ebf9dffbd16ccae67095f0d9f2",
    });
  });

  it("contains 35 unique parks and 42 represented prefectures", () => {
    expect(parks).toHaveLength(35);
    expect(new Set(parks.map((park) => park.id)).size).toBe(35);
    expect(new Set(parks.map((park) => park.name)).size).toBe(35);
    expect(new Set(parks.flatMap((park) => park.prefectures)).size).toBe(42);
  });

  it("matches the nationwide totals from the official table", () => {
    expect(sum("total")).toBe(index.totalAreaHa);
    expect(sum("protection")).toBe(index.specialProtectionHa);
    expect(sum("class1")).toBe(index.class1Ha);
    expect(sum("class2")).toBe(index.class2Ha);
    expect(sum("class3")).toBe(index.class3Ha);
    expect(sum("ordinary")).toBe(index.ordinaryHa);
  });

  it("retains known largest, smallest, strictest, and newest rows", () => {
    expect(find("日高山脈襟裳十勝")).toMatchObject({
      designated: "2024-06-25",
      total: 245668,
      protection: 73743,
      ordinary: 51392,
    });
    expect(find("慶良間諸島")).toMatchObject({ total: 3520, protection: 305, ordinary: 253 });
    expect(find("小笠原")).toMatchObject({ total: 6629, protection: 4934, ordinary: 18 });
    expect(find("知床")).toMatchObject({ protection: 23526, ordinary: 0 });
  });

  it("keeps official integer-hectare rows within their rounding tolerance", () => {
    for (const park of parks) {
      expect(Object.keys(park).sort()).toEqual([
        "class1",
        "class2",
        "class3",
        "designated",
        "era",
        "id",
        "name",
        "ordinary",
        "prefectures",
        "protection",
        "total",
      ]);
      const zoneSum = park.protection + park.class1 + park.class2 + park.class3 + park.ordinary;
      expect(Math.abs(zoneSum - park.total)).toBeLessThanOrEqual(1);
      expect(park.designated).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(park.prefectures.length).toBeGreaterThan(0);
    }
    expect(statSync(resolve(root, "public/data/parks.json")).size).toBeLessThan(20000);
  });
});
