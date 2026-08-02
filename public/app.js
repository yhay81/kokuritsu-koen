const MAX_COMPARE = 4;
const STORAGE_KEY = "kokuritsu-koen:compare:v1";
const zoneKeys = ["protection", "class1", "class2", "class3", "ordinary"];
const zoneLabels = ["特別保護", "第1種", "第2種", "第3種", "普通"];
const zoneClasses = ["zone-protection", "zone-one", "zone-two", "zone-three", "zone-ordinary"];

const search = document.querySelector("#search");
const prefecture = document.querySelector("#prefecture");
const sort = document.querySelector("#sort");
const results = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const dataStatus = document.querySelector("#data-status");
const compareList = document.querySelector("#compare-list");
const compareCount = document.querySelector("#compare-count");
const copyCompare = document.querySelector("#copy-compare");

let parks = [];
let selected = loadSelected();
let searchTimer;
let noResultReported = false;

const isPrivacyEnabled = () =>
  navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
const isQa = () => navigator.webdriver === true || new URLSearchParams(location.search).has("qa");
const getSession = () => {
  const key = "kokuritsu-koen:session:v1";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
};
const track = (name) => {
  if (isPrivacyEnabled()) return;
  fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kokuritsu-koen-session": getSession(),
      "x-kokuritsu-koen-qa": isQa() ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};

function loadSelected() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string").slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}
function saveSelected() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // Comparison still works for this page view when storage is unavailable.
  }
}
const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase("ja").replaceAll(/\s/gu, "");
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const number = new Intl.NumberFormat("ja-JP");
const date = (value) =>
  new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00+09:00`),
  );
const ratio = (value, total) => (value / total) * 100;
const specialRatio = (park) => ratio(park.total - park.ordinary, park.total);

function zoneBar(park, label) {
  let x = 0;
  const rects = zoneKeys
    .map((key, index) => {
      const width = ratio(park[key], park.total);
      const rect = `<rect class="${zoneClasses[index]}" height="20" width="${width}" x="${x}" y="0"><title>${zoneLabels[index]} ${width.toFixed(1)}%</title></rect>`;
      x += width;
      return rect;
    })
    .join("");
  return `<svg aria-label="${escapeHtml(label)}" class="zone-bar" preserveAspectRatio="none" role="img" viewBox="0 0 100 20">${rects}</svg>`;
}

function renderCompare() {
  const selectedParks = selected.map((id) => parks.find((park) => park.id === id)).filter(Boolean);
  compareCount.textContent = `${selectedParks.length} / ${MAX_COMPARE}`;
  copyCompare.disabled = selectedParks.length === 0;
  if (selectedParks.length === 0) {
    compareList.className = "empty-compare";
    compareList.textContent = "一覧の「比較に追加」から、2〜4公園を選んでください。";
    return;
  }
  compareList.className = "compare-list";
  compareList.innerHTML = selectedParks
    .map(
      (park) => `<article class="compare-row">
        <div class="compare-name"><strong>${escapeHtml(park.name)}</strong><span>${number.format(park.total)} ha</span></div>
        <div class="compare-profile">${zoneBar(park, `${park.name}の地種区分`)}</div>
        <div class="compare-stats"><span>特別保護 <b>${ratio(park.protection, park.total).toFixed(1)}%</b></span><span>特別地域計 <b>${specialRatio(park).toFixed(1)}%</b></span></div>
        <button aria-label="${escapeHtml(park.name)}を比較から外す" class="remove-button" data-remove="${park.id}" type="button">×</button>
      </article>`,
    )
    .join("");
}

function visibleParks() {
  const term = normalize(search.value);
  const pref = prefecture.value;
  const filtered = parks.filter((park) => {
    const haystack = normalize(`${park.name}${park.prefectures.join("")}`);
    return (
      (!term || haystack.includes(term)) && (pref === "all" || park.prefectures.includes(pref))
    );
  });
  const sorted = [...filtered];
  if (sort.value === "area-desc") sorted.sort((a, b) => b.total - a.total);
  if (sort.value === "protection-desc")
    sorted.sort((a, b) => ratio(b.protection, b.total) - ratio(a.protection, a.total));
  if (sort.value === "newest") sorted.sort((a, b) => b.designated.localeCompare(a.designated));
  if (sort.value === "oldest") sorted.sort((a, b) => a.designated.localeCompare(b.designated));
  return sorted;
}

function renderResults() {
  const visible = visibleParks();
  resultCount.textContent = number.format(visible.length);
  if (visible.length === 0) {
    results.innerHTML =
      '<div class="no-results"><span>0</span><h3>一致する公園がありません</h3><p>公園名や都道府県を短くしてみてください。</p></div>';
    if (!noResultReported) {
      noResultReported = true;
      track("no_result");
    }
    return;
  }
  noResultReported = false;
  results.innerHTML = visible
    .map((park) => {
      const active = selected.includes(park.id);
      const disabled = !active && selected.length >= MAX_COMPARE;
      return `<article class="park-card">
        <div class="park-heading"><div><p>${park.prefectures.map(escapeHtml).join(" · ")}</p><h3>${escapeHtml(park.name)}</h3></div><span>${number.format(park.total)}<small>ha</small></span></div>
        ${zoneBar(park, `${park.name}の地種区分`)}
        <div class="card-ratios"><span><i class="dot-protection"></i>特別保護 <b>${ratio(park.protection, park.total).toFixed(1)}%</b></span><span>普通 <b>${ratio(park.ordinary, park.total).toFixed(1)}%</b></span></div>
        <div class="park-meta"><span>指定 ${date(park.designated)}</span><span>${escapeHtml(park.era)}</span></div>
        <button class="compare-button${active ? " is-selected" : ""}" data-select="${park.id}" ${disabled ? "disabled" : ""} type="button">${active ? "比較中" : disabled ? "4公園を選択済み" : "比較に追加"}</button>
      </article>`;
    })
    .join("");
}

function toggleSelected(id) {
  if (selected.includes(id)) selected = selected.filter((item) => item !== id);
  else if (selected.length < MAX_COMPARE) {
    selected = [...selected, id];
    track("compared");
  }
  saveSelected();
  renderCompare();
  renderResults();
}

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) toggleSelected(button.dataset.select);
});
compareList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) toggleSelected(button.dataset.remove);
});
search.addEventListener("input", () => {
  renderResults();
  clearTimeout(searchTimer);
  if (search.value.trim()) searchTimer = setTimeout(() => track("searched"), 650);
});
prefecture.addEventListener("change", () => {
  renderResults();
  track("prefecture_changed");
});
sort.addEventListener("change", () => {
  renderResults();
  track("sort_changed");
});
copyCompare.addEventListener("click", async () => {
  const lines = selected
    .map((id) => parks.find((park) => park.id === id))
    .filter(Boolean)
    .map(
      (park) =>
        `${park.name}｜${number.format(park.total)}ha｜特別保護 ${ratio(park.protection, park.total).toFixed(1)}%｜特別地域計 ${specialRatio(park).toFixed(1)}%｜普通 ${ratio(park.ordinary, park.total).toFixed(1)}%`,
    );
  await navigator.clipboard.writeText(
    [
      "国立公園 地種区分比較（2026年4月10日現在・陸域）",
      ...lines,
      "出典：環境省「国立公園地種区分別面積」",
    ].join("\n"),
  );
  copyCompare.textContent = "コピーしました";
  setTimeout(() => {
    copyCompare.textContent = "比較をコピー";
  }, 1600);
  track("copied");
});

fetch("/data/parks.json")
  .then((response) => {
    if (!response.ok) throw new Error("data_unavailable");
    return response.json();
  })
  .then((data) => {
    parks = data;
    const validIds = new Set(parks.map((park) => park.id));
    selected = selected.filter((id) => validIds.has(id));
    saveSelected();
    const prefectures = [...new Set(parks.flatMap((park) => park.prefectures))].sort((a, b) =>
      a.localeCompare(b, "ja"),
    );
    prefecture.insertAdjacentHTML(
      "beforeend",
      prefectures
        .map((pref) => `<option value="${escapeHtml(pref)}">${escapeHtml(pref)}</option>`)
        .join(""),
    );
    dataStatus.textContent = "35公園 · 2026年4月10日現在";
    renderCompare();
    renderResults();
    track("visited");
  })
  .catch(() => {
    dataStatus.textContent = "データを読み込めませんでした。再読み込みしてください。";
    results.innerHTML =
      '<div class="no-results"><h3>公式表を表示できません</h3><p>通信状態を確認して、ページを再読み込みしてください。</p></div>';
  });
