const $ = (id) => document.getElementById(id);
const state = {
  month: "",
  startMonth: "",
  timeScope: "cumulative",
  months: [],
};

function safe(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatRate(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(2)}%`;
}

function formatValue(value, unit = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const number = Number(value);
  const text = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${text}${unit || ""}`;
}

function formatPeriod(value) {
  const historical = String(value || "").match(/^HIST-(20\d{2})-(20\d{2})$/);
  if (historical) return `${historical[1]}-${historical[2]}年累计`;
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return value || "累计期";
  const year = match[1];
  const month = Number(match[2]);
  return month <= 1 ? `${year}年1月累计` : `${year}年1-${month}月累计`;
}

function formatMonthName(value) {
  const historical = String(value || "").match(/^HIST-(20\d{2})-(20\d{2})$/);
  if (historical) return `${historical[1]}-${historical[2]}年累计`;
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return value || "-";
  return `${match[1]}年${Number(match[2])}月`;
}

function monthSortValue(month) {
  const historical = String(month || "").match(/^HIST-(20\d{2})-(20\d{2})$/);
  if (historical) return Number(historical[2]) * 12 + 12;
  const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
  return match ? Number(match[1]) * 12 + Number(match[2]) : 0;
}

function isHistoricalPeriod(value) {
  return /^HIST-(20\d{2})-(20\d{2})$/.test(String(value || ""));
}

function buildTimeParams() {
  const params = new URLSearchParams();
  if (state.month) params.set("month", state.month);
  params.set("time_scope", state.timeScope);
  if (state.timeScope === "range" && state.startMonth) params.set("start_month", state.startMonth);
  return params;
}

function currentShareTimeLabel() {
  if (state.timeScope === "since2021") return `2021年至${formatMonthName(state.month)}累计`;
  return formatPeriod(state.month);
}

function pdfDownloadUrl(disposition = "attachment") {
  const params = buildTimeParams();
  if (disposition === "inline") params.set("disposition", "inline");
  return `/api/share/pdf?${params.toString()}`;
}

function refreshPdfLinks() {
  const safeTitle = currentShareTimeLabel().replace(/[\\/:*?"<>|]/g, "-");
  const exportLink = $("exportPdfButton");
  const fallbackLink = $("pdfFallbackLink");
  if (exportLink) {
    exportLink.href = pdfDownloadUrl();
    exportLink.download = `指标完成情况分享页-${safeTitle}.pdf`;
  }
  if (fallbackLink) fallbackLink.href = pdfDownloadUrl("inline");
}

function exportSharePdf() {
  refreshPdfLinks();
}

function updateShareControls() {
  if (isHistoricalPeriod(state.month)) {
    state.timeScope = "cumulative";
  }
  $("timeScopeSelect").value = state.timeScope;
  $("shareStartField").hidden = state.timeScope !== "range";
  $("startMonthSelect").disabled = state.timeScope !== "range";
  $("timeScopeSelect").disabled = isHistoricalPeriod(state.month);
  $("monthSelect").value = state.month;
  if (state.startMonth) $("startMonthSelect").value = state.startMonth;
  refreshPdfLinks();
}

function progressClass(status) {
  if (status === "done") return "good";
  if (status === "warning") return "warn";
  if (status === "behind") return "bad";
  return "";
}

function shortName(name) {
  const text = String(name || "");
  if (text.includes("高级工以上")) return "高级工以上";
  if (text.includes("技师以上")) return "技师以上";
  if (text.includes("专业技能人才")) return "专业技能人才";
  if (text.includes("人工智能")) return "人工智能类";
  return "新增取证";
}

function citySourceLabel(item) {
  const name = String(item?.indicator_name || "");
  if (name.includes("专业技能人才")) return "手工填入";
  if (name.includes("人工智能")) return "专项表汇总";
  const category = String(item?.category || "").trim();
  return category || "职业技能证书";
}

function displayDistrictName(name) {
  const text = String(name || "").trim();
  if (["合计", "总计", "全市合计"].includes(text)) return "全市";
  return text;
}

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "数据读取失败");
  return response.json();
}

function renderCity(items) {
  $("cityList").innerHTML = (items || [])
    .map((item) => {
      const rate = Math.max(0, Math.min(100, Number(item.completion_rate || 0)));
      return `
        <article class="city-card">
          <h3>${safe(item.indicator_name)}</h3>
          <div class="metric-top">
            <span>${safe(citySourceLabel(item))}</span>
            <span class="rate">${formatRate(item.completion_rate)}</span>
          </div>
          <div class="progress ${progressClass(item.status)}"><span style="width:${rate}%"></span></div>
          <div class="values">
            <span>目标 ${safe(formatValue(item.target_value, item.unit))}</span>
            <span>完成 ${safe(formatValue(item.actual_value, item.unit))}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDistricts(items) {
  $("districtList").innerHTML = (items || [])
    .map((district) => {
      const tasks = (district.tasks || [])
        .map((task) => {
          const rate = Math.max(0, Math.min(100, Number(task.completion_rate || 0)));
          return `
            <div class="metric-pill ${progressClass(task.status)}">
              <div class="metric-title">
                <span>${safe(shortName(task.indicator_name))}</span>
                <span class="rate">${formatRate(task.completion_rate)}</span>
              </div>
              <div class="progress ${progressClass(task.status)}"><span style="width:${rate}%"></span></div>
              <div class="values">
                <span>目标 ${safe(formatValue(task.target_value, task.unit))}</span>
                <span>完成 ${safe(formatValue(task.actual_value, task.unit))}</span>
              </div>
            </div>
          `;
        })
        .join("");
      return `
        <article class="district-card">
          <strong>${safe(displayDistrictName(district.district))}</strong>
          <div class="district-metrics">${tasks || '<div class="metric-pill">暂无任务数据</div>'}</div>
        </article>
      `;
    })
    .join("");
}

function renderAiDistricts(items) {
  $("aiCount").textContent = `${(items || []).length} 个`;
  if (!items?.length) {
    $("aiDistrictList").innerHTML = `<div class="empty-state">导入“按区输出--人工智能类”统计表后显示。</div>`;
    return;
  }
  const max = Math.max(...items.map((item) => Number(item.actual_value || 0)), 1);
  $("aiDistrictList").innerHTML = items
    .map((item) => {
      const width = Math.max(2, Math.min(100, (Number(item.actual_value || 0) / max) * 100));
      return `
        <div class="ai-row">
          <strong>${safe(displayDistrictName(item.district))}</strong>
          <div class="ai-track"><span style="width:${width}%"></span></div>
          <em>${safe(formatValue(item.actual_value, item.unit || "人次"))}</em>
        </div>
      `;
    })
    .join("");
}

function renderLevelStats(payload) {
  const items = payload.items || [];
  const total = payload.total || items.find((item) => item.district === "合计") || {};
  const note = payload.time_scope === "range" ? "期间取证数" : payload.time_scope === "since2021" ? "2021年以来累计" : "取证数累计";
  $("levelPeriod").textContent = payload.label || "-";
  const specialTotal = Object.prototype.hasOwnProperty.call(total, "special_technician") ? total.special_technician : 0;
  const chiefTotal = Object.prototype.hasOwnProperty.call(total, "chief_technician") ? total.chief_technician : 0;
  const districts = items.filter((item) => item.district !== "合计" && (Number(item.special_technician || 0) > 0 || Number(item.chief_technician || 0) > 0));
  const rows = districts.length
    ? districts
        .slice(0, 10)
        .map(
          (item) => `
            <div class="level-row">
              <strong>${safe(displayDistrictName(item.district))}</strong>
              <span>特级/特技 ${safe(formatValue(item.special_technician, item.unit || "人次"))}</span>
              <span>首席 ${safe(formatValue(item.chief_technician, item.unit || "人次"))}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">所选时间口径下暂无区级专项取证数</div>`;
  $("levelStats").innerHTML = `
    <div class="level-summary">
      <article><span>特级/特技技师</span><strong>${safe(formatValue(specialTotal, total.unit || "人次"))}</strong><small>${note}</small></article>
      <article><span>首席技师</span><strong>${safe(formatValue(chiefTotal, total.unit || "人次"))}</strong><small>${note}</small></article>
    </div>
    <div class="level-list">${rows}</div>
  `;
}

async function loadShare() {
  const params = buildTimeParams();
  const [overview, aiDistricts, levelStats] = await Promise.all([
    getJson(`/api/overview?${params.toString()}`),
    getJson(`/api/ai-districts?${params.toString()}`),
    getJson(`/api/level-stats?${params.toString()}`),
  ]);
  const city = overview.city || [];
  const done = city.filter((item) => item.status === "done").length;
  const warning = city.filter((item) => item.status === "warning").length;
  const behind = city.filter((item) => item.status === "behind").length;
  const unknown = city.filter((item) => item.status === "unknown").length;

  $("shareTitle").textContent = `${overview.label || formatPeriod(overview.month)}完成情况`;
  $("shareSummary").textContent = `市级${city.length}项指标：已完成${done}项、接近完成${warning}项、未完成${behind}项、待补${unknown}项；区级${overview.total || 0}项任务覆盖${(overview.districts || []).length}个区域口径。`;
  $("cityCount").textContent = city.length || "-";
  $("doneCount").textContent = done;
  $("warningCount").textContent = warning;
  $("behindCount").textContent = behind;

  renderCity(city);
  renderDistricts(overview.districts || []);
  renderAiDistricts(aiDistricts.items || []);
  renderLevelStats(levelStats);
}

async function boot() {
  const meta = await getJson("/api/meta");
  const months = meta.months || [];
  const regularMonths = months.filter((month) => !isHistoricalPeriod(month));
  state.months = months;
  $("monthSelect").innerHTML = months.map((month) => `<option value="${safe(month)}">${safe(formatPeriod(month))}</option>`).join("");
  $("startMonthSelect").innerHTML = [...regularMonths]
    .reverse()
    .map((month) => `<option value="${safe(month)}">${safe(formatMonthName(month))}</option>`)
    .join("");
  const urlMonth = new URLSearchParams(location.search).get("month");
  const initial = urlMonth || meta.latest_month || months[0] || "";
  state.month = initial;
  state.startMonth = new URLSearchParams(location.search).get("start_month") || [...regularMonths].reverse()[0] || initial;
  const urlScope = new URLSearchParams(location.search).get("time_scope");
  state.timeScope = urlScope === "range" || urlScope === "since2021" ? urlScope : "cumulative";
  if (state.startMonth && state.month && monthSortValue(state.startMonth) > monthSortValue(state.month)) state.startMonth = state.month;
  updateShareControls();
  $("exportPdfButton").addEventListener("click", exportSharePdf);
  $("monthSelect").addEventListener("change", async (event) => {
    state.month = event.target.value;
    if (state.startMonth && monthSortValue(state.startMonth) > monthSortValue(state.month)) state.startMonth = state.month;
    updateShareControls();
    await loadShare();
    const next = new URL(location.href);
    next.searchParams.set("month", state.month);
    history.replaceState(null, "", next.toString());
  });
  $("timeScopeSelect").addEventListener("change", async (event) => {
    state.timeScope = event.target.value === "range" || event.target.value === "since2021" ? event.target.value : "cumulative";
    if (!state.startMonth) state.startMonth = state.month;
    updateShareControls();
    await loadShare();
    const next = new URL(location.href);
    next.searchParams.set("time_scope", state.timeScope);
    if (state.timeScope === "range") next.searchParams.set("start_month", state.startMonth);
    else next.searchParams.delete("start_month");
    history.replaceState(null, "", next.toString());
  });
  $("startMonthSelect").addEventListener("change", async (event) => {
    state.startMonth = event.target.value || state.month;
    if (state.startMonth && state.month && monthSortValue(state.startMonth) > monthSortValue(state.month)) state.startMonth = state.month;
    updateShareControls();
    await loadShare();
    const next = new URL(location.href);
    next.searchParams.set("start_month", state.startMonth);
    history.replaceState(null, "", next.toString());
  });
  await loadShare();
}

boot().catch((error) => {
  $("shareTitle").textContent = "数据读取失败";
  $("shareSummary").textContent = error.message || "请稍后重试。";
});
