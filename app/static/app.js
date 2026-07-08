const state = {
  meta: null,
  month: null,
  startMonth: null,
  timeScope: "cumulative",
  district: "",
  category: "",
  status: "",
  q: "",
  reportPeriod: "month",
  reportScope: "cumulative",
  publicShareUrl: "",
  publicShareReachable: null,
  publicShareChecking: false,
};

const $ = (id) => document.getElementById(id);

const statusLabels = {
  done: "已完成",
  warning: "接近完成",
  behind: "未完成",
  unknown: "待判断",
};

function iconSafe(value) {
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

function formatPeriod(value) {
  const historical = String(value || "").match(/^HIST-(20\d{2})-(20\d{2})$/);
  if (historical) return `${historical[1]}-${historical[2]}年累计`;
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return value || "累计";
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

function currentTimeLabel() {
  if (state.timeScope === "since2021") {
    return `2021年至${formatMonthName(state.month)}累计`;
  }
  if (state.timeScope === "range") {
    const start = state.startMonth || state.month;
    return start === state.month ? formatMonthName(state.month) : `${formatMonthName(start)}-${formatMonthName(state.month)}`;
  }
  return formatPeriod(state.month);
}

function isHistoricalPeriod(value) {
  return /^HIST-(20\d{2})-(20\d{2})$/.test(String(value || ""));
}

function monthSortValue(month) {
  const historical = String(month || "").match(/^HIST-(20\d{2})-(20\d{2})$/);
  if (historical) return Number(historical[2]) * 12 + 12;
  const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
  return match ? Number(match[1]) * 12 + Number(match[2]) : 0;
}

function buildTimeParams() {
  const params = new URLSearchParams();
  if (state.month) params.set("month", state.month);
  params.set("time_scope", state.timeScope);
  if (state.timeScope === "range" && state.startMonth) {
    params.set("start_month", state.startMonth);
  }
  return params;
}

function syncUrlToState() {
  const next = new URL(location.href);
  if (state.month) next.searchParams.set("month", state.month);
  else next.searchParams.delete("month");
  next.searchParams.set("time_scope", state.timeScope);
  if (state.timeScope === "range" && state.startMonth) next.searchParams.set("start_month", state.startMonth);
  else next.searchParams.delete("start_month");
  history.replaceState(null, "", next.toString());
}

function hydrateStateFromUrl() {
  const params = new URLSearchParams(location.search);
  const month = params.get("month");
  const startMonth = params.get("start_month");
  const timeScope = params.get("time_scope");
  if (month) state.month = month;
  if (startMonth) state.startMonth = startMonth;
  if (timeScope) state.timeScope = timeScope === "range" || timeScope === "since2021" ? timeScope : "cumulative";
}

function formatReportPeriodLabel(month, reportPeriod = state.reportPeriod, reportScope = state.reportScope) {
  const base = formatPeriod(month);
  if (reportPeriod === "quarter") {
    const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
    const quarter = match ? Math.floor((Number(match[2]) - 1) / 3) + 1 : "";
    const quarterText = quarter ? `第${["一", "二", "三", "四"][quarter - 1]}季度` : "季度";
    return reportScope === "single" ? `${match?.[1] || ""}年${quarterText}` : `${base}（截至${quarterText}）`;
  }
  if (reportScope === "single") {
    const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
    return match ? `${match[1]}年${Number(match[2])}月` : base;
  }
  return base;
}

function formatValue(value, unit = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const number = Number(value);
  const text = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${text}${unit || ""}`;
}

function statusClass(status) {
  if (status === "done") return "done";
  if (status === "warning") return "warning";
  if (status === "behind") return "behind";
  return "unknown";
}

function shortIndicatorName(name) {
  if (String(name || "").includes("高级工以上")) return "高级工以上";
  if (String(name || "").includes("技师以上")) return "技师以上";
  if (String(name || "").includes("专业技能人才")) return "专业技能人才";
  if (String(name || "").includes("人工智能")) return "人工智能类";
  return "新增取证";
}

function isProfessionalSkillIndicator(name) {
  return String(name || "").includes("专业技能人才");
}

function citySourceLabel(item) {
  const name = String(item?.indicator_name || "");
  if (name.includes("专业技能人才")) return "手工填入";
  if (name.includes("人工智能")) return "专项表汇总";
  const category = String(item?.category || "").trim();
  return category.includes("?") ? "职业技能证书" : category;
}

function displayDistrictName(name) {
  const text = String(name || "").trim();
  if (text === "南京江北新区" || text === "江北新区") return "直管区";
  return text === "合计" || text === "总计" || text === "全市合计" ? "全市" : text;
}

function formatUploadTime(value) {
  if (!value) return "-";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function progressClass(status) {
  if (status === "done") return "good";
  if (status === "warning") return "warn";
  if (status === "behind") return "bad";
  return "";
}

function renderInsight(overview, cityItems, cityDone, cityWarning, cityBehind, cityUnknown) {
  const districts = overview.districts || [];
  const districtCount = districts.length;
  const lowest = districts
    .filter((item) => item.completion_avg !== null && item.completion_avg !== undefined)
    .slice()
    .sort((a, b) => Number(a.completion_avg) - Number(b.completion_avg))[0];
  const nearText = overview.warning ? `区级${overview.warning}项接近完成` : "暂无接近完成项";
  const behindText = overview.behind ? `区级${overview.behind}项未完成` : "暂无未完成项";
  const unknownText = cityUnknown ? `${cityUnknown}项市级指标待补数据` : "市级数据完整";
  const focusText = lowest ? `重点关注 ${displayDistrictName(lowest.district)}（${formatRate(lowest.completion_avg)}）` : "暂无重点关注区域";
  $("insightTitle").textContent = `${overview.label || formatPeriod(overview.month)}总体判断`;
  $("insightText").textContent = `全市${cityItems.length}项指标中，已完成${cityDone}项、接近完成${cityWarning}项、未完成${cityBehind}项、待补${cityUnknown}项；区级${overview.total || 0}项任务覆盖${districtCount}个区域口径，${behindText}。`;
  $("insightChips").innerHTML = [nearText, behindText, unknownText, focusText]
    .map((text) => `<span>${iconSafe(text)}</span>`)
    .join("");
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function setOptions(select, options, allLabel, selected = "") {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = allLabel;
  select.appendChild(all);
  for (const option of options) {
    const el = document.createElement("option");
    if (typeof option === "string") {
      el.value = option;
      el.textContent = option;
    } else {
      el.value = option.value;
      el.textContent = option.label;
    }
    select.appendChild(el);
  }
  select.value = selected;
}

function setPlainOptions(select, options, selected = "") {
  select.innerHTML = "";
  for (const option of options) {
    const el = document.createElement("option");
    if (typeof option === "string") {
      el.value = option;
      el.textContent = option;
    } else {
      el.value = option.value;
      el.textContent = option.label;
    }
    select.appendChild(el);
  }
  select.value = selected;
}

function updateTimeControls() {
  const field = $("startMonthField");
  const select = $("startMonthFilter");
  if (isHistoricalPeriod(state.month)) {
    state.timeScope = "cumulative";
  }
  const isRange = state.timeScope === "range";
  field.hidden = !isRange;
  select.disabled = !isRange;
  $("timeScopeFilter").value = state.timeScope;
  $("timeScopeFilter").disabled = isHistoricalPeriod(state.month);
  if (state.startMonth) select.value = state.startMonth;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { detail: text };
  }
  if (!response.ok) {
    throw new Error(payload.detail || "请求失败");
  }
  return payload;
}

function filenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1].replaceAll("+", "%20"));
  const quotedMatch = disposition.match(/filename="?([^";]+)"?/i);
  return quotedMatch ? quotedMatch[1] : fallback;
}

function fallbackReportFilename(anchor) {
  const month =
    state.timeScope === "range" && state.startMonth && state.month
      ? `${state.startMonth}_to_${state.month}`
      : state.month || "report";
  const suffix = `${month}_${state.reportPeriod}_${state.reportScope}.docx`;
  if (anchor.id === "downloadMonthlyReport") return `monthly_progress_${suffix}`;
  if (anchor.id === "downloadQuarterReport") return `district_progress_${suffix}`;
  return `indicator_report_${suffix}`;
}

async function openReportFolder(filename) {
  try {
    await requestJson("/api/report/open-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    return true;
  } catch (error) {
    console.warn("Unable to open report folder", error);
    return false;
  }
}

async function downloadReportFile(anchor) {
  const href = anchor.getAttribute("href");
  const label = anchor.dataset.label || anchor.querySelector("strong")?.textContent?.trim() || anchor.textContent.trim() || "报告";
  if (!href || href === "#") {
    showToast("报告链接还在生成，请稍后再试");
    return;
  }

  anchor.classList.add("loading");
  anchor.setAttribute("aria-busy", "true");
  showToast(`正在生成${label}...`);
  try {
    const response = await fetch(href, { cache: "no-store" });
    if (!response.ok) {
      let detail = "下载失败";
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        detail = payload.detail || detail;
      } else {
        detail = (await response.text()) || detail;
      }
      throw new Error(detail);
    }
    const blob = await response.blob();
    const filename = filenameFromDisposition(response.headers.get("content-disposition"), anchor.download || fallbackReportFilename(anchor));
    const objectUrl = URL.createObjectURL(blob);
    const temp = document.createElement("a");
    temp.href = objectUrl;
    temp.download = filename;
    temp.style.display = "none";
    document.body.appendChild(temp);
    temp.click();
    temp.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
    const opened = await openReportFolder(filename);
    showToast(opened ? `${label}已生成，已打开文件夹` : `${label}已生成，浏览器开始下载`);
  } catch (error) {
    showToast(error.message || `${label}下载失败`);
  } finally {
    anchor.classList.remove("loading");
    anchor.removeAttribute("aria-busy");
  }
}

async function loadMeta() {
  const meta = await requestJson("/api/meta");
  state.meta = meta;
  state.month = state.month || meta.latest_month;
  const monthOptions = meta.months.map((month) => ({ value: month, label: formatPeriod(month) }));
  const ascendingMonths = [...(meta.months || [])].filter((month) => !isHistoricalPeriod(month)).reverse();
  if (!meta.months.includes(state.month)) {
    state.month = meta.latest_month || meta.months[0] || "";
  }
  state.startMonth = state.startMonth || ascendingMonths[0] || state.month;
  if (state.startMonth && state.month && monthSortValue(state.startMonth) > monthSortValue(state.month)) {
    state.startMonth = state.month;
  }
  $("uploadMonth").value = state.month;
  setPlainOptions(
    $("monthFilter"),
    monthOptions,
    state.month,
  );
  setPlainOptions(
    $("startMonthFilter"),
    ascendingMonths.map((month) => ({ value: month, label: formatMonthName(month) })),
    state.startMonth,
  );
  updateTimeControls();
  setOptions(
    $("districtFilter"),
    meta.districts.map((district) => ({ value: district, label: displayDistrictName(district) })),
    "全部区域",
    state.district,
  );
  setOptions($("categoryFilter"), meta.categories, "全部类别", state.category);
  setOptions($("statusFilter"), meta.statuses, "全部状态", state.status);
}

async function loadOverview() {
  const params = buildTimeParams();
  const overview = await requestJson(`/api/overview?${params.toString()}`);
  const cityItems = overview.city || [];
  const cityDone = cityItems.filter((item) => item.status === "done").length;
  const cityWarning = cityItems.filter((item) => item.status === "warning").length;
  const cityBehind = cityItems.filter((item) => item.status === "behind").length;
  const cityUnknown = cityItems.filter((item) => item.status === "unknown").length;
  renderInsight(overview, cityItems, cityDone, cityWarning, cityBehind, cityUnknown);
  $("cityTaskCount").textContent = cityItems.length || "-";
  $("cityTaskStatus").textContent = `已完成 ${cityDone} · 接近 ${cityWarning} · 未完成 ${cityBehind} · 待补 ${cityUnknown}`;
  $("totalCount").textContent = overview.total ?? 0;
  $("totalNote").textContent = `${(overview.districts || []).length}个区域口径 × 2项分解任务`;
  $("doneCount").textContent = overview.done ?? 0;
  $("warningCount").textContent = overview.warning ?? 0;
  $("behindCount").textContent = overview.behind ?? 0;
  $("unknownCount").textContent = overview.unknown ? `待判断 ${overview.unknown} 条` : "低于 80%";
  renderCity(cityItems);
  renderDistricts(overview.districts || []);
  const reportParams = buildTimeParams();
  reportParams.set("period", state.reportPeriod);
  reportParams.set("scope", state.reportScope);
  const reportFilenamePart =
    state.timeScope === "range" && state.startMonth ? `${state.startMonth}_to_${overview.month}` : overview.month;
  $("downloadReport").href = `/api/report/word?${reportParams.toString()}`;
  $("downloadReport").download = `indicator_report_${reportFilenamePart}_${state.reportPeriod}_${state.reportScope}.docx`;
  $("downloadMonthlyReport").href = `/api/report/monthly-word?${reportParams.toString()}`;
  $("downloadMonthlyReport").download = `monthly_progress_${reportFilenamePart}_${state.reportPeriod}_${state.reportScope}.docx`;
  $("downloadQuarterReport").href = `/api/report/quarter-word?${reportParams.toString()}`;
  $("downloadQuarterReport").download = `district_progress_${reportFilenamePart}_${state.reportPeriod}_${state.reportScope}.docx`;
}

async function loadMetrics() {
  const params = buildTimeParams();
  if (state.district) params.set("district", state.district);
  if (state.category) params.set("category", state.category);
  if (state.status) params.set("status", state.status);
  if (state.q) params.set("q", state.q);
  const payload = await requestJson(`/api/metrics?${params.toString()}`);
  $("tableCount").textContent = `${payload.count} 条`;
  renderTable(payload.items || []);
}

async function loadReport() {
  const periodText = state.reportPeriod === "quarter" ? "季度" : "月度";
  const scopeText = state.timeScope === "since2021" ? "2021年以来" : state.reportScope === "single" ? "单期" : "累计";
  const current = state.timeScope === "range" ? currentTimeLabel() : formatReportPeriodLabel(state.month);
  $("reportText").innerHTML = `<span>${periodText}</span><span>${scopeText}</span>${iconSafe(current)}，选择上方卡片生成 Word 文件`;
}

async function loadPublicShareUrl() {
  const box = $("publicShareBox");
  if (!box) return;
  try {
    const payload = await requestJson("/api/public-share-url");
    renderPublicShare(payload);
  } catch (error) {
    box.hidden = false;
    $("publicShareUrl").textContent = "公网链接读取失败";
    $("publicShareNote").textContent = error.message || "请稍后重试。";
    box.dataset.status = "invalid";
  }
}

function renderPublicShare(payload = {}, checking = false) {
  const box = $("publicShareBox");
  if (!box) return;
  const disabled = payload.status === "disabled";
  state.publicShareUrl = disabled ? "" : payload.url || "";
  state.publicShareReachable = checking ? null : payload.reachable;
  state.publicShareChecking = checking;
  box.hidden = false;
  const status = checking
    ? "checking"
    : disabled
      ? "disabled"
      : !state.publicShareUrl
      ? "missing"
      : payload.reachable === true
        ? "ok"
        : payload.reachable === false
          ? "invalid"
          : "unchecked";
  box.dataset.status = status;
  const urlNode = $("publicShareUrl");
  urlNode.textContent = disabled ? "公网自动分享已停用" : state.publicShareUrl || "尚未生成公网分享链接";
  urlNode.dataset.url = state.publicShareUrl;
  let note = payload.note || "供微信或外部电脑查看，不开放上传修改。";
  if (checking) note = "正在检测公网链接；如已失效，将自动更新公网链接...";
  $("publicShareNote").textContent = note;
  const copyButton = $("copyPublicShare");
  const checkButton = $("checkPublicShare");
  if (copyButton) copyButton.disabled = disabled || !state.publicShareUrl || checking || payload.reachable !== true;
  if (checkButton) checkButton.disabled = disabled || checking;
}

async function checkPublicShareUrl(showToastOnDone = false) {
  if (state.publicShareChecking) return;
  renderPublicShare({ url: state.publicShareUrl, note: $("publicShareNote")?.textContent || "" }, true);
  try {
    const payload = await requestJson("/api/public-share-url/check", { method: "POST" });
    renderPublicShare(payload);
    if (showToastOnDone) {
      showToast(payload.reachable ? (payload.refreshed ? "公网分享链接已自动更新" : "公网分享链接可访问") : "公网分享链接更新失败");
    }
  } catch (error) {
    renderPublicShare({
      url: state.publicShareUrl,
      reachable: false,
      note: error.message || "公网链接检测失败",
      detail: error.message || "",
    });
    if (showToastOnDone) showToast("公网链接检测失败");
  }
}

async function loadStatusHighlights() {
  const [donePayload, warningPayload] = await Promise.all([fetchStatusItems("done"), fetchStatusItems("warning")]);
  renderStatusList($("doneList"), donePayload.items || [], "暂无已完成任务");
  renderStatusList($("warningList"), warningPayload.items || [], "暂无接近完成任务");
}

async function loadAiDistricts() {
  const params = buildTimeParams();
  const payload = await requestJson(`/api/ai-districts?${params.toString()}`);
  renderAiDistricts(payload.items || []);
}

async function loadLevelStats() {
  const params = buildTimeParams();
  const payload = await requestJson(`/api/level-stats?${params.toString()}`);
  renderLevelStats(payload);
}

async function loadUploads() {
  const payload = await requestJson("/api/uploads");
  renderUploadList(payload.items || []);
}

async function fetchStatusItems(status) {
  const params = buildTimeParams();
  params.set("status", status);
  params.set("limit", "8");
  return requestJson(`/api/metrics?${params.toString()}`);
}

function renderStatusList(root, items, emptyText) {
  if (!items.length) {
    root.innerHTML = `<div class="status-item"><div><strong>${emptyText}</strong><span>可切换期数查看其他累计期</span></div><div class="status-rate">-</div></div>`;
    return;
  }
  root.innerHTML = items
    .map(
      (item) => `
        <div class="status-item" title="${iconSafe(displayDistrictName(item.district))}：${iconSafe(item.indicator_name)}">
          <div>
            <strong>${iconSafe(displayDistrictName(item.district))}</strong>
            <span>${iconSafe(item.indicator_name)}</span>
          </div>
          <div class="status-rate">${formatRate(item.completion_rate)}</div>
        </div>
      `,
    )
    .join("");
}

function renderUploadList(items) {
  const root = $("uploadList");
  const visibleItems = [];
  const seen = new Set();
  for (const item of items || []) {
    const key = `${item.filename || ""}::${item.month || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    visibleItems.push(item);
  }
  $("uploadCount").textContent = `${visibleItems.length} 个`;
  if (!visibleItems.length) {
    root.innerHTML = `<div class="upload-item empty"><strong>暂无上传记录</strong><span>导入表格后会显示在这里</span></div>`;
    return;
  }
  root.innerHTML = visibleItems
    .slice(0, 10)
    .map((item) => {
      const sheets = Array.isArray(item.sheet_names) ? item.sheet_names.join("、") : "";
      return `
        <div class="upload-item" title="${iconSafe(item.filename)}">
          <div class="upload-file">
            <strong class="upload-filename">${iconSafe(item.filename)}</strong>
            <form class="upload-edit-form" data-upload-id="${Number(item.id)}" hidden>
              <input name="filename" value="${iconSafe(item.filename)}" maxlength="180" />
              <button class="upload-action save" type="submit" title="保存文件名">
                <svg><use href="#icon-check"></use></svg>
              </button>
              <button class="upload-action cancel" type="button" title="取消修改">
                <svg><use href="#icon-x"></use></svg>
              </button>
            </form>
            <span>${iconSafe(formatPeriod(item.month))} · ${iconSafe(formatUploadTime(item.uploaded_at))}</span>
          </div>
          <div class="upload-meta">
            <span>${Number(item.row_count || 0)} 条</span>
            <span>${iconSafe(item.status === "parsed" ? "已解析" : item.status || "未知")}</span>
            ${sheets ? `<span>${iconSafe(sheets)}</span>` : ""}
          </div>
          <button class="upload-edit" type="button" data-upload-id="${Number(item.id)}" title="修改文件名">
            <svg><use href="#icon-edit"></use></svg>
          </button>
          <button class="upload-delete" type="button" data-upload-id="${Number(item.id)}" data-filename="${iconSafe(item.filename)}" title="删除这次上传及其指标记录">
            <svg><use href="#icon-trash"></use></svg>
          </button>
        </div>
      `;
    })
    .join("");
}

function setUploadEditMode(item, editing) {
  const name = item.querySelector(".upload-filename");
  const form = item.querySelector(".upload-edit-form");
  const editButton = item.querySelector(".upload-edit");
  if (!name || !form || !editButton) return;
  name.hidden = editing;
  form.hidden = !editing;
  editButton.hidden = editing;
  if (editing) {
    const input = form.querySelector("input");
    input?.focus();
    input?.select();
  }
}

async function updateUploadFilename(uploadId, filename) {
  const nextName = String(filename || "").trim();
  if (!nextName) {
    showToast("文件名不能为空");
    return;
  }
  try {
    await requestJson(`/api/uploads/${uploadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: nextName }),
    });
    await loadUploads();
    showToast("文件名已修改");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteUpload(uploadId, filename) {
  if (!uploadId) return;
  const ok = window.confirm(`确定删除这次上传吗？\n\n${filename}\n\n删除后会同步移除这次上传产生的指标记录。`);
  if (!ok) return;
  try {
    const payload = await requestJson(`/api/uploads/${uploadId}`, { method: "DELETE" });
    await refreshAll();
    showToast(`已删除 ${payload.filename || filename}，移除 ${payload.deleted_metrics || 0} 条指标记录`);
  } catch (error) {
    showToast(error.message);
  }
}

async function saveProfessionalSkillMetric(value) {
  const actualValue = String(value ?? "").trim();
  const body = {
    month: state.month,
    actual_value: actualValue === "" ? null : Number(actualValue),
  };
  if (body.actual_value !== null && (!Number.isFinite(body.actual_value) || body.actual_value < 0)) {
    showToast("请输入不小于0的数字");
    return;
  }
  await requestJson("/api/manual/professional-skill", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await Promise.all([loadOverview(), loadMetrics(), loadReport(), loadStatusHighlights()]);
  showToast(actualValue === "" ? "已清空专业技能人才手工数" : "专业技能人才指标已保存");
}

function renderCity(items) {
  const root = $("cityList");
  if (!items.length) {
    root.innerHTML = `<div class="city-item"><h3>暂无数据</h3><div class="city-meta">等待导入表格</div></div>`;
    return;
  }
  root.innerHTML = items
    .map((item) => {
      const hasRate = item.completion_rate !== null && item.completion_rate !== undefined;
      const rate = Math.max(0, Math.min(100, Number(item.completion_rate || 0)));
      const manual = isProfessionalSkillIndicator(item.indicator_name);
      return `
        <article class="city-item ${progressClass(item.status)}">
          <h3>${iconSafe(item.indicator_name)}</h3>
          <div class="city-meta">
            <span>${iconSafe(citySourceLabel(item))}</span>
            <strong>${hasRate ? formatRate(item.completion_rate) : iconSafe(formatValue(item.actual_value, item.unit))}</strong>
          </div>
          ${hasRate ? `<div class="progress ${progressClass(item.status)}"><span style="width:${rate}%"></span></div>` : `<div class="metric-value">全市 ${iconSafe(formatValue(item.actual_value, item.unit))}</div>`}
          <div class="city-meta">
            <span>目标 ${iconSafe(formatValue(item.target_value, item.unit))}</span>
            <span>完成 ${iconSafe(formatValue(item.actual_value, item.unit))}</span>
          </div>
          ${
            manual
              ? `<form class="manual-metric-form" data-manual="professional-skill">
                  <label>
                    <span>完成数</span>
                    <input name="actual" type="number" min="0" step="1" placeholder="填入人数" value="${item.actual_value ?? ""}" />
                  </label>
                  <button type="submit">保存</button>
                </form>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderDistricts(items) {
  const root = $("districtBars");
  if (!items.length) {
    root.innerHTML = `<div class="district-block"><strong>暂无数据</strong><div class="district-metric-row"><div class="progress"></div><span>-</span></div></div>`;
    return;
  }
  root.innerHTML = items
    .map((item) => {
      const taskRows = (item.tasks || [])
        .map(
          (task) => {
            const hasRate = task.completion_rate !== null && task.completion_rate !== undefined;
            const rate = Math.max(0, Math.min(100, Number(task.completion_rate || 0)));
            return `
              <div class="district-metric-row ${statusClass(task.status)}" title="${iconSafe(task.indicator_name)}">
                <span class="district-metric-name">${iconSafe(shortIndicatorName(task.indicator_name))}</span>
                <div class="progress ${progressClass(task.status)}"><span style="width:${rate}%"></span></div>
                <span class="district-rate">${hasRate ? formatRate(task.completion_rate) : "-"}</span>
                <span class="district-values">目标 ${iconSafe(formatValue(task.target_value, task.unit))} / 完成 ${iconSafe(formatValue(task.actual_value, task.unit))}</span>
              </div>
            `;
          },
        )
        .join("");
      return `
        <div class="district-block" title="${iconSafe(item.district)}：已完成 ${item.done}，接近完成 ${item.warning}，未完成 ${item.behind}，待判断 ${item.unknown || 0}">
          <strong>${iconSafe(displayDistrictName(item.district))}</strong>
          <div class="district-metrics">${taskRows || "目标和完成值待补充"}</div>
        </div>
      `;
    })
    .join("");
}

function renderAiDistricts(items) {
  const root = $("aiDistrictList");
  $("aiDistrictCount").textContent = `${items.length} 个`;
  if (!items.length) {
    root.innerHTML = `<div class="ai-district-empty">导入“按区输出——人工智能类”统计表后显示</div>`;
    return;
  }
  const maxValue = Math.max(...items.map((item) => Number(item.actual_value || 0)), 1);
  root.innerHTML = items
    .map((item, index) => {
      const value = Number(item.actual_value || 0);
      const width = value > 0 ? Math.max(3, Math.round((value / maxValue) * 100)) : 0;
      return `
        <div class="ai-bar-row">
          <strong>${iconSafe(displayDistrictName(item.district))}</strong>
          <div class="ai-bar-track" aria-hidden="true">
            <span style="width:${width}%"></span>
          </div>
          <span class="ai-bar-value">${iconSafe(formatValue(item.actual_value, item.unit || "人次"))}</span>
        </div>
      `;
    })
    .join("");
}

function renderLevelStats(payload) {
  const root = $("levelStats");
  const items = payload.items || [];
  const total = payload.total || items.find((item) => item.district === "合计") || {};
  $("levelPeriod").textContent = payload.label || currentTimeLabel();
  const statNote = payload.time_scope === "range" ? "期间取证数" : payload.time_scope === "since2021" ? "2021年以来累计" : "取证数累计";
  const specialTotal = Object.prototype.hasOwnProperty.call(total, "special_technician") ? total.special_technician : 0;
  const chiefTotal = Object.prototype.hasOwnProperty.call(total, "chief_technician") ? total.chief_technician : 0;
  const districts = items.filter((item) => item.district !== "合计" && (Number(item.special_technician || 0) > 0 || Number(item.chief_technician || 0) > 0));
  const districtRows = districts.length
    ? districts
        .slice(0, 10)
        .map(
          (item) => `
            <div class="level-row">
              <strong>${iconSafe(displayDistrictName(item.district))}</strong>
              <span>特级/特技 ${iconSafe(formatValue(item.special_technician, item.unit || "人次"))}</span>
              <span>首席 ${iconSafe(formatValue(item.chief_technician, item.unit || "人次"))}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="level-empty">所选时间口径下暂无区级专项取证数</div>`;
  root.innerHTML = `
    <div class="level-summary">
      <article>
        <span>特级/特技技师</span>
        <strong>${iconSafe(formatValue(specialTotal, total.unit || "人次"))}</strong>
        <small>${statNote}</small>
      </article>
      <article>
        <span>首席技师</span>
        <strong>${iconSafe(formatValue(chiefTotal, total.unit || "人次"))}</strong>
        <small>${statNote}</small>
      </article>
    </div>
    <div class="level-list">${districtRows}</div>
  `;
}

function renderTable(items) {
  const root = $("metricTable");
  if (!items.length) {
    root.innerHTML = `<tr><td colspan="7">暂无匹配数据</td></tr>`;
    return;
  }
  root.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td>${iconSafe(displayDistrictName(item.district))}</td>
          <td>${iconSafe(item.indicator_name)}</td>
          <td>${iconSafe(item.category)}</td>
          <td class="number">${iconSafe(formatValue(item.target_value, item.unit))}</td>
          <td class="number">${iconSafe(formatValue(item.actual_value, item.unit))}</td>
          <td class="number">${formatRate(item.completion_rate)}</td>
          <td><span class="status-pill ${statusClass(item.status)}">${statusLabels[item.status] || "待判断"}</span></td>
        </tr>
      `,
    )
    .join("");
}

function setDetailsCollapsed(collapsed) {
  const panel = document.querySelector(".table-panel");
  const button = $("toggleDetails");
  if (!panel || !button) return;
  panel.classList.toggle("collapsed", collapsed);
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
  const label = button.querySelector("span");
  if (label) label.textContent = collapsed ? "展开" : "收起";
}

async function refreshAll() {
  await loadMeta();
  syncUrlToState();
  await Promise.all([loadOverview(), loadMetrics(), loadReport(), loadPublicShareUrl(), loadStatusHighlights(), loadAiDistricts(), loadLevelStats(), loadUploads()]);
}

async function setStatusFilter(status) {
  state.status = status;
  $("statusFilter").value = status;
  await loadMetrics();
  setDetailsCollapsed(false);
  document.querySelector(".table-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindEvents() {
  $("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    $("fileName").textContent = file ? file.name : "选择表格";
  });

  $("uploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = $("fileInput").files[0];
    if (!file) {
      showToast("请选择要导入的表格");
      return;
    }
    const form = new FormData();
    form.append("month", $("uploadMonth").value || state.month || "");
    form.append("file", file);
    try {
      const payload = await requestJson("/api/upload", { method: "POST", body: form });
      state.month = payload.month;
      $("fileInput").value = "";
      $("fileName").textContent = "选择表格";
      syncUrlToState();
      await refreshAll();
      syncUrlToState();
      showToast(`已导入 ${payload.rows} 条核心任务记录`);
    } catch (error) {
      showToast(error.message);
    }
  });

  const demoButton = $("demoButton");
  if (demoButton) {
    demoButton.addEventListener("click", async () => {
      showToast("正式数据模式下已关闭模拟数据重置");
    });
  }

  $("monthFilter").addEventListener("change", async (event) => {
    state.month = event.target.value || state.meta.latest_month;
    if (state.startMonth && monthSortValue(state.startMonth) > monthSortValue(state.month)) {
      state.startMonth = state.month;
    }
    $("uploadMonth").value = state.month;
    updateTimeControls();
    $("monthFilter").value = state.month;
    await Promise.all([loadOverview(), loadMetrics(), loadReport(), loadStatusHighlights(), loadAiDistricts(), loadLevelStats(), loadUploads()]);
    syncUrlToState();
  });
  $("timeScopeFilter").addEventListener("change", async (event) => {
    state.timeScope = event.target.value === "range" || event.target.value === "since2021" ? event.target.value : "cumulative";
    if (!state.startMonth) state.startMonth = state.month;
    updateTimeControls();
    await Promise.all([loadOverview(), loadMetrics(), loadReport(), loadStatusHighlights(), loadAiDistricts(), loadLevelStats()]);
    syncUrlToState();
  });
  $("startMonthFilter").addEventListener("change", async (event) => {
    state.startMonth = event.target.value || state.month;
    if (state.startMonth && state.month && monthSortValue(state.startMonth) > monthSortValue(state.month)) {
      state.startMonth = state.month;
    }
    updateTimeControls();
    await Promise.all([loadOverview(), loadMetrics(), loadReport(), loadStatusHighlights(), loadAiDistricts(), loadLevelStats()]);
    syncUrlToState();
  });
  $("districtFilter").addEventListener("change", async (event) => {
    state.district = event.target.value;
    await loadMetrics();
  });
  $("categoryFilter").addEventListener("change", async (event) => {
    state.category = event.target.value;
    await loadMetrics();
  });
  $("statusFilter").addEventListener("change", async (event) => {
    state.status = event.target.value;
    await loadMetrics();
  });
  $("toggleDetails").addEventListener("click", () => {
    const panel = document.querySelector(".table-panel");
    setDetailsCollapsed(!panel?.classList.contains("collapsed"));
  });
  $("reportPeriod").addEventListener("change", async (event) => {
    state.reportPeriod = event.target.value;
    await Promise.all([loadOverview(), loadReport()]);
  });
  $("reportScope").addEventListener("change", async (event) => {
    state.reportScope = event.target.value;
    await Promise.all([loadOverview(), loadReport()]);
  });
  for (const id of ["downloadReport", "downloadMonthlyReport", "downloadQuarterReport"]) {
    $(id).addEventListener("click", async (event) => {
      event.preventDefault();
      await downloadReportFile(event.currentTarget);
    });
  }
  $("copyPublicShare")?.addEventListener("click", async () => {
    let payload = {};
    try {
      payload = await requestJson("/api/public-share-url");
      renderPublicShare(payload);
    } catch (error) {
      showToast("公网分享链接读取失败");
      return;
    }
    const url = $("publicShareUrl")?.dataset.url || payload.url || "";
    if (!url) {
      showToast("公网分享链接还没生成");
      return;
    }
    if (payload.reachable !== true) {
      showToast(payload.status === "disabled" ? "公网自动分享已停用" : "公网分享链接不可用，请先检测/更新");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("公网分享链接已复制");
    } catch (error) {
      window.prompt("复制这个公网分享链接", url);
    }
  });
  $("checkPublicShare")?.addEventListener("click", async () => {
    await checkPublicShareUrl(true);
  });
  $("doneCard").addEventListener("click", () => setStatusFilter("done"));
  $("warningCard").addEventListener("click", () => setStatusFilter("warning"));
  $("behindCard").addEventListener("click", () => setStatusFilter("behind"));
  $("queryInput").addEventListener("input", () => {
    window.clearTimeout(bindEvents.queryTimer);
    bindEvents.queryTimer = window.setTimeout(async () => {
      state.q = $("queryInput").value.trim();
      await loadMetrics();
    }, 220);
  });
  $("clearButton").addEventListener("click", async () => {
    state.district = "";
    state.category = "";
    state.status = "";
    state.q = "";
    $("districtFilter").value = "";
    $("categoryFilter").value = "";
    $("statusFilter").value = "";
    $("queryInput").value = "";
    await loadMetrics();
  });
  $("uploadList").addEventListener("click", async (event) => {
    const editButton = event.target.closest(".upload-edit");
    if (editButton) {
      setUploadEditMode(editButton.closest(".upload-item"), true);
      return;
    }
    const cancelButton = event.target.closest(".upload-action.cancel");
    if (cancelButton) {
      setUploadEditMode(cancelButton.closest(".upload-item"), false);
      return;
    }
    const deleteButton = event.target.closest(".upload-delete");
    if (deleteButton) {
      await deleteUpload(Number(deleteButton.dataset.uploadId), deleteButton.dataset.filename || "上传文件");
    }
  });
  $("uploadList").addEventListener("submit", async (event) => {
    const form = event.target.closest(".upload-edit-form");
    if (!form) return;
    event.preventDefault();
    await updateUploadFilename(Number(form.dataset.uploadId), new FormData(form).get("filename"));
  });
  $("cityList").addEventListener("submit", async (event) => {
    const form = event.target.closest(".manual-metric-form");
    if (!form) return;
    event.preventDefault();
    await saveProfessionalSkillMetric(new FormData(form).get("actual"));
  });
}

async function boot() {
  hydrateStateFromUrl();
  bindEvents();
  try {
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
}

boot();
