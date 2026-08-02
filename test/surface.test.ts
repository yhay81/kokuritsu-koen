import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import app from "../src/worker";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const worker = read("src/worker.tsx");
const client = read("public/app.js");
const css = read("public/styles.css");
const migration = read("migrations/0001_telemetry.sql");
const surface = `${worker}\n${client}`;
const bindings = {
  ASSETS: {} as Fetcher,
  DB: {
    prepare: () => ({
      bind: () => ({ run: async () => ({ success: true }) }),
      first: async () => ({ ok: 1 }),
    }),
  } as unknown as D1Database,
};

describe("product surface", () => {
  it("communicates through terrain layers and zoning profiles", () => {
    expect(worker).toContain('class="terrain-figure"');
    expect(worker).toContain('class="terrain-layer protection"');
    expect(worker).toContain('class="zone-legend"');
    expect(client).toContain('class="zone-bar"');
    expect(client).toContain("zone-protection");
    expect(css.toLowerCase()).not.toContain("gradient");
  });

  it("keeps search and four public park ids in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain('fetch("/data/parks.json")');
    expect(client).toContain("localStorage");
    expect(client).toContain("MAX_COMPARE = 4");
    expect(client).toContain("slice(0, MAX_COMPARE)");
    expect(migration).not.toMatch(
      /park_(?:name|id)|query_(?:text|value)|search_term|prefecture_value|email|phone/iu,
    );
  });

  it("states the land-area and interpretation boundaries", () => {
    expect(worker).toContain("比較するのは陸域面積です");
    expect(worker).toContain("海域公園地区の面積は含みません");
    expect(worker).toContain("保全価値の順位でもありません");
    expect(worker).toContain("公共データ利用規約 第1.0版");
    expect(worker).toContain("https://www.env.go.jp/park/doc/data/national/np_2.pdf");
  });

  it("renders four indexable pages with constrained typography and no meta copy", async () => {
    for (const path of ["/", "/guide", "/source", "/privacy"]) {
      const response = await app.request(
        `https://kokuritsu-koen.yhay81.com${path}`,
        undefined,
        bindings,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<html lang="ja">');
    }
    expect(css).toContain("2.55rem");
    expect(css).not.toMatch(/font-size:\s*(?:[4-9]|\d{2,})rem/iu);
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });

  it("accepts only same-origin allowlisted telemetry", async () => {
    const accepted = await app.request(
      "https://kokuritsu-koen.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://kokuritsu-koen.yhay81.com",
          "x-kokuritsu-koen-session": "12345678-1234-4123-8123-123456789abc",
          "x-kokuritsu-koen-qa": "1",
        },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    const invalid = await app.request(
      "https://kokuritsu-koen.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "unknown" }),
      },
      bindings,
    );
    const foreign = await app.request(
      "https://kokuritsu-koen.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.com" },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    expect(accepted.status).toBe(202);
    expect(invalid.status).toBe(400);
    expect(foreign.status).toBe(403);
  });

  it("separates QA, honors privacy signals, and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain("navigator.doNotTrack");
    expect(client).toContain("globalPrivacyControl");
    expect(client).toContain('"x-kokuritsu-koen-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });
});
