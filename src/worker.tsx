import { Hono } from "hono";
import type { Context } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

const origin = "https://kokuritsu-koen.yhay81.com";
const dataPage = "https://www.env.go.jp/park/doc/data.html";
const overviewPdf = "https://www.env.go.jp/park/doc/data/national/np_1.pdf";
const zoningPdf = "https://www.env.go.jp/park/doc/data/national/np_2.pdf";
const terms = "https://www.env.go.jp/mail.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "prefecture_changed",
  "sort_changed",
  "compared",
  "copied",
]);

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (Number(c.req.header("content-length") ?? "0") > 512)
    throw new ApiError("invalid_payload", 400);
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-kokuritsu-koen-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-kokuritsu-koen-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const nav = [
  { href: "/", label: "くらべる" },
  { href: "/guide", label: "区分の見方" },
  { href: "/source", label: "出典" },
  { href: "/privacy", label: "保存" },
];

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="ja_JP" property="og:locale" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#173e32" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
    </head>
    <body>
      <header class="site-header">
        <a aria-label="国立公園くらべ ホーム" class="brand" href="/">
          <span aria-hidden="true" class="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>国立公園くらべ</span>
        </a>
        <nav aria-label="主なページ">
          {nav.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <div>
          <strong>国立公園くらべ</strong>
          <p>環境省「国立公園地種区分別面積」ほかを加工して作成</p>
        </div>
        <div class="footer-links">
          <a href="/source">出典と注意</a>
          <a href="/privacy">保存と計測</a>
          <a href="https://github.com/yhay81/kokuritsu-koen">ソースコード</a>
        </div>
      </footer>
    </body>
  </html>
);

const TerrainFigure = () => (
  <div aria-label="地種区分を重ねた模式図" class="terrain-figure" role="img">
    <div class="terrain-sky">
      <span>35 parks · 2,447,855 ha</span>
    </div>
    <div class="terrain-layer ordinary">
      <span>普通地域</span>
    </div>
    <div class="terrain-layer class-three">
      <span>第3種</span>
    </div>
    <div class="terrain-layer class-two">
      <span>第2種</span>
    </div>
    <div class="terrain-layer class-one">
      <span>第1種</span>
    </div>
    <div class="terrain-layer protection">
      <span>特別保護</span>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="日本の35国立公園を検索し、陸域面積と特別保護地区・第1種から第3種特別地域・普通地域の構成を最大4公園で比較できます。"
    title="35国立公園の地種区分を比較 | 国立公園くらべ"
  >
    <main>
      <section class="hero-shell">
        <div class="hero-copy">
          <p class="eyebrow">2026.04.10 · 環境省</p>
          <h1>日本の35国立公園</h1>
          <p class="lead">
            公園を選ぶと、陸域がどの地種区分で構成されているかを同じ縮尺で並べられます。
          </p>
          <div class="hero-facts" aria-label="収録内容">
            <span>
              <b>35</b> 公園
            </span>
            <span>
              <b>5</b> 地種区分
            </span>
            <span>
              <b>最大4</b> 公園比較
            </span>
          </div>
        </div>
        <TerrainFigure />
      </section>

      <section aria-labelledby="compare-title" class="compare-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">ZONE PROFILE</p>
            <h2 id="compare-title">選んだ公園を重ねる</h2>
          </div>
          <div class="compare-actions">
            <span id="compare-count">0 / 4</span>
            <button disabled id="copy-compare" type="button">
              比較をコピー
            </button>
          </div>
        </div>
        <div class="zone-legend" aria-label="地種区分の凡例">
          <span class="key-protection">特別保護</span>
          <span class="key-one">第1種</span>
          <span class="key-two">第2種</span>
          <span class="key-three">第3種</span>
          <span class="key-ordinary">普通</span>
        </div>
        <div class="empty-compare" id="compare-list">
          一覧の「比較に追加」から、2〜4公園を選んでください。
        </div>
      </section>

      <section aria-labelledby="finder-title" class="finder">
        <div class="section-heading">
          <div>
            <p class="eyebrow">PARK INDEX</p>
            <h2 id="finder-title">公園を選ぶ</h2>
          </div>
          <p id="data-status" role="status">
            公式表を読み込んでいます
          </p>
        </div>
        <div class="controls">
          <label class="search-field">
            <span>公園名・都道府県</span>
            <input
              autocomplete="off"
              id="search"
              placeholder="例：知床、沖縄、アルプス"
              type="search"
            />
          </label>
          <label>
            <span>都道府県</span>
            <select id="prefecture">
              <option value="all">すべて</option>
            </select>
          </label>
          <label>
            <span>並び順</span>
            <select id="sort">
              <option value="source">公式表の順</option>
              <option value="area-desc">面積が大きい順</option>
              <option value="protection-desc">特別保護の割合順</option>
              <option value="newest">指定が新しい順</option>
              <option value="oldest">指定が古い順</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="results-title" class="results-section">
        <div class="results-heading">
          <h2 id="results-title">国立公園</h2>
          <p>
            <b id="result-count">—</b> 公園
          </p>
        </div>
        <div class="park-grid" id="results" />
      </section>

      <aside class="boundary">
        <span aria-hidden="true">陸</span>
        <div>
          <strong>比較するのは陸域面積です</strong>
          <p>
            海域公園地区、現在の天候・入山規制・交通、訪問のしやすさは含みません。面積構成は保全価値の順位でもありません。
          </p>
        </div>
      </aside>
    </main>
    <script defer src="/app.js" />
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="国立公園の特別保護地区、第1種から第3種特別地域、普通地域と比較帯の見方を説明します。"
    title="地種区分の見方 | 国立公園くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">READ THE BANDS</p>
        <h1>色の帯は、陸域の構成。</h1>
        <p>横幅を100%として、公園ごとの5区分を同じ順で並べます。</p>
      </div>
      <section class="guide-grid">
        <article class="guide-protection">
          <span>01</span>
          <h2>特別保護地区</h2>
          <p>地種区分の中で規制が最も厳しい地区。帯のいちばん濃い部分です。</p>
        </article>
        <article class="guide-special">
          <span>02–04</span>
          <h2>第1・第2・第3種特別地域</h2>
          <p>自然の状態や使われ方に応じて3段階に区分されます。数字の小さい順に濃く表示します。</p>
        </article>
        <article class="guide-ordinary">
          <span>05</span>
          <h2>普通地域</h2>
          <p>特別地域に含まれない公園区域。比較帯では最も明るい部分です。</p>
        </article>
        <article>
          <span>↔</span>
          <h2>面積も一緒に見る</h2>
          <p>100%の帯は構成比です。公園自体の大きさは隣のha値で確かめてください。</p>
        </article>
      </section>
      <section class="note-panel">
        <h2>帯だけで訪問判断はできません</h2>
        <p>
          地種区分は公園計画上の区分です。通行可否や立入可否は場所・行為・時期により異なります。現地の最新案内を確認してください。
        </p>
      </section>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="国立公園くらべが利用する環境省の概要表・地種区分別面積、加工内容、更新日、利用条件を示します。"
    title="出典とデータ | 国立公園くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">SOURCE</p>
        <h1>35公園、2つの公式表。</h1>
        <p>名称・指定日と、陸域の地種区分別面積を組み合わせています。</p>
      </div>
      <section class="source-ledger">
        <div>
          <span>提供元</span>
          <strong>環境省 自然環境局</strong>
          <a href={dataPage}>自然保護各種データ</a>
        </div>
        <div>
          <span>基準日</span>
          <strong>2026年4月10日</strong>
          <a href={zoningPdf}>地種区分別面積 PDF</a>
        </div>
        <div>
          <span>概要</span>
          <strong>35公園・2,447,855ha</strong>
          <a href={overviewPdf}>国立公園の概要 PDF</a>
        </div>
        <div>
          <span>利用条件</span>
          <strong>公共データ利用規約 第1.0版</strong>
          <a href={terms}>環境省の利用条件</a>
        </div>
      </section>
      <section class="prose-section">
        <h2>行った加工</h2>
        <ul>
          <li>
            2つのPDFから公園名を対応させ、指定年月日・関係都道府県と地種区分別の陸域面積を結合しました。
          </li>
          <li>和暦の指定年月日を西暦に変換しました。</li>
          <li>都道府県別の絞り込みと、各区分の構成比を面積から計算しました。</li>
          <li>出典：環境省「国立公園の概要」「国立公園地種区分別面積」を加工して作成。</li>
        </ul>
      </section>
      <section class="prose-section">
        <h2>数値の境界</h2>
        <p>
          収録値は陸域のみです。海域公園地区の面積は含みません。面積は公園区域の合計で、歩行可能な面積、国有地面積、自然度、利用者数ではありません。
        </p>
      </section>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="国立公園くらべの端末保存、匿名利用計測、保持期間、追跡拒否への対応を示します。"
    title="保存と計測 | 国立公園くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">PRIVACY</p>
        <h1>選んだ公園は、端末に。</h1>
        <p>検索語や選択した公園名をサーバーへ記録しません。</p>
      </div>
      <section class="privacy-grid">
        <article>
          <h2>端末に保存</h2>
          <p>
            比較に選んだ公開公園IDを最大4件、ブラウザのlocalStorageへ保存します。検索語と絞り込みは保存しません。
          </p>
        </article>
        <article>
          <h2>操作名だけを計測</h2>
          <p>
            訪問、検索、0件、絞り込み変更、比較追加、コピーの操作名だけを計測します。検索語、公園ID、都道府県は送りません。
          </p>
        </article>
        <article>
          <h2>35日で削除</h2>
          <p>
            ランダムなセッションIDをSHA-256で変換し、操作名、QA区分、時刻とともにD1へ保存します。原データは35日後に削除します。
          </p>
        </article>
        <article>
          <h2>追跡拒否を尊重</h2>
          <p>
            Do Not TrackまたはGlobal Privacy
            Controlが有効な場合は計測しません。広告・外部解析・Cookieは使いません。
          </p>
        </article>
      </section>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.use(
  "*",
  jsxRenderer(({ children }) => <>{children}</>),
);
app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_payload", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ asOf: "2026-04-10", ok: row?.ok === 1, parks: 35, service: "kokuritsu-koen" });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 国立公園くらべ"
    >
      <main class="text-page">
        <div class="page-intro">
          <p class="eyebrow">404</p>
          <h1>この区域は見つかりません。</h1>
          <p>
            <a href="/">公園の比較へ戻る</a>
          </p>
        </div>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message, requestId: c.get("requestId") }, error.status);
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export default app;
