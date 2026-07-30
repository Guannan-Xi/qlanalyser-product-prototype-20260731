const subjects = [
  { id: "QL2026001", name: "林然", age: 26, gender: "女", date: "2026-07-22", height: 165, weight: 54, bmi: 19.8, collector: "陈老师", remark: "" },
  { id: "QL2026002", name: "王泽", age: 34, gender: "男", date: "2026-07-23", height: 178, weight: 73, bmi: 23.0, collector: "陈老师", remark: "" },
  { id: "QL2026003", name: "赵青", age: 29, gender: "女", date: "2026-07-24", height: 168, weight: 58, bmi: 20.5, collector: "李老师", remark: "" },
  { id: "QL2026004", name: "周远", age: 41, gender: "男", date: "2026-07-26", height: 172, weight: 69, bmi: 23.3, collector: "管理员", remark: "" },
  { id: "QL2026005", name: "沈知", age: 23, gender: "女", date: "2026-07-28", height: 160, weight: 50, bmi: 19.5, collector: "管理员", remark: "" },
  { id: "QL2026006", name: "许宁", age: 31, gender: "不便透露", date: "2026-07-29", height: 171, weight: 63, bmi: 21.5, collector: "管理员", remark: "" },
  { id: "QL2026007", name: "方可", age: 38, gender: "男", date: "2026-07-29", height: 175, weight: 71, bmi: 23.2, collector: "李老师", remark: "" },
  { id: "QL2026008", name: "唐晓", age: 27, gender: "女", date: "2026-07-29", height: 162, weight: 53, bmi: 20.2, collector: "陈老师", remark: "" }
];

const appState = {
  selectedSubjectId: null,
  tasks: [],
  selectedTaskId: null,
  search: "",
  sort: null,
  sortDirection: 1,
  currentPage: 1,
  pageSize: 6,
  editingSubjectId: null,
  pendingSubjectDeleteId: null,
  pendingTaskDeleteId: null,
  templates: [],
  reportPreviewReady: false,
  reportCommentDirty: false,
  reportHistory: [],
  activeReportSection: "overview",
  reportBatchState: "idle",
  reportBatchProgress: 0,
  reportBatchDetail: "等待开始报告批处理模拟",
  reportBatchScenario: "success",
  reportBatchItems: [],
  pdfSimulationState: "idle",
  pdfSimulationProgress: 0,
  pdfSimulationOutcome: "success"
};

const methodShortNames = {
  "Peak Alpha Frequency": "PAF",
  "Power Spectral Density": "PSD",
  "Theta/Beta Ratio": "TBR",
  "Z-Score Analysis": "Z-Score",
  "Full-Band Power Distribution": "Band Power",
  "Full-Band Ratio Distribution": "Band Ratio",
  "alpha Ratio(EC/EO)": "Alpha Ratio",
  "Frontal Alpha Asymmetry": "FAA",
  "Report Output": "Report Output"
};

const methodReportSections = {
  "Peak Alpha Frequency": "paf",
  "Power Spectral Density": "psd",
  "Theta/Beta Ratio": "tbr",
  "Z-Score Analysis": "zscore",
  "Full-Band Power Distribution": "band-power",
  "Full-Band Ratio Distribution": "band-ratio",
  "alpha Ratio(EC/EO)": "alpha-ratio",
  "Frontal Alpha Asymmetry": "faa",
  "Report Output": "assessment"
};

const reportSectionNames = {
  overview: "封面与受试者信息",
  paf: "Peak Alpha Frequency (PAF)",
  psd: "Power Spectral Density (PSD)",
  tbr: "Theta/Beta Ratio (TBR)",
  zscore: "Z-Score Analysis",
  "band-power": "Full-Band Power Distribution",
  "band-ratio": "Full-Band Ratio Distribution",
  faa: "Frontal Alpha Asymmetry",
  "alpha-ratio": "Alpha Ratio (EC/EO)",
  assessment: "综合评估与建议"
};

const reportSectionLabels = {
  overview: "封面与受试者信息",
  paf: "PAF",
  psd: "PSD",
  tbr: "TBR",
  zscore: "Z-Score",
  "band-power": "Full-Band Power",
  "band-ratio": "Full-Band Ratio",
  faa: "FAA",
  "alpha-ratio": "Alpha Ratio",
  assessment: "综合评估与建议"
};

const fullBand2HzBands = Array.from({ length: 16 }, (_, index) => `${2 + index * 2}–${4 + index * 2} Hz`);
const deterministicBandValues = (base, step) => fullBand2HzBands.map((_, index) => (base + step * index).toFixed(2));

const fixtureCatalog = {
  overview: {
    subtitle: "报告范围与受试者摘要",
    metrics: [["已确认方法", "2", "项"], ["模拟数据版本", "R44", "确定性 fixture"], ["诊断结论", "无", "研究用途"]],
    visual: "bars",
    bars: [["任务", 72], ["参数", 58], ["页面", 84], ["检查", 66]],
    note: "本页只汇总原型中的已确认任务，不代表真实检测、分析或诊断结果。"
  },
  paf: {
    subtitle: "枕区 Alpha 峰值频率模拟页",
    metrics: [["O1 PAF", "10.2", "Hz"], ["O2 PAF", "10.4", "Hz"], ["Mean PAF", "10.3", "Hz"]],
    visual: "spectrum",
    note: "频谱曲线和数值为固定演示数据，不来自 EEG 信号。"
  },
  psd: {
    subtitle: "功率谱密度模拟页",
    metrics: [["Delta", "18.4", "%"], ["Alpha", "31.6", "%"], ["Beta", "14.2", "%"]],
    visual: "spectrum",
    note: "确定性模拟频谱与频带占比不可用于个体判断。"
  },
  tbr: {
    subtitle: "Theta/Beta 比值模拟页",
    metrics: [["Fz TBR", "2.18", "ratio"], ["Cz TBR", "1.94", "ratio"], ["Mean TBR", "2.06", "ratio"]],
    visual: "bars",
    bars: [["Fz", 82], ["Cz", 69], ["Mean", 75]],
    note: "比值仅用于演示报告结构，不对应任何受试者。"
  },
  zscore: {
    subtitle: "标准化评分模拟页",
    metrics: [["最大 Z", "+1.24", "SD"], ["最小 Z", "-0.86", "SD"], ["模拟通道", "19", "channels"]],
    visual: "heatmap",
    note: "未接入常模数据库；色块不代表真实偏离程度。"
  },
  "band-power": {
    subtitle: "全频段功率分布模拟页",
    metrics: [["频率范围", "2–34", "Hz"], ["频带步进", "2", "Hz"], ["矩阵类型", "2", "绝对 / 相对"]],
    visual: "bars",
    bars: [["Delta", 42], ["Theta", 63], ["Alpha", 88], ["SMR", 38], ["Beta", 51], ["Gamma", 27]],
    matrices: [
      {
        key: "absolute",
        title: "绝对功率 Z",
        rows: [
          ["O1", deterministicBandValues(-0.84, 0.09)],
          ["O2", deterministicBandValues(-0.71, 0.08)],
          ["Fz", deterministicBandValues(-0.38, 0.05)]
        ]
      },
      {
        key: "relative",
        title: "相对功率 Z",
        rows: [
          ["O1", deterministicBandValues(-0.42, 0.06)],
          ["O2", deterministicBandValues(-0.31, 0.05)],
          ["Fz", deterministicBandValues(-0.16, 0.03)]
        ]
      }
    ],
    note: "各频段柱高与数值是固定模拟数据。"
  },
  "band-ratio": {
    subtitle: "全频段比率分布模拟页",
    metrics: [["T/A", "0.72", "ratio"], ["T/B", "1.94", "ratio"], ["A/B", "2.21", "ratio"]],
    visual: "bars",
    bars: [["T/A", 53], ["T/B", 74], ["A/B", 86], ["D/A", 41]],
    note: "频带比率为固定 fixture，不含临床解释。"
  },
  faa: {
    subtitle: "前额 Alpha 不对称性模拟页",
    metrics: [["F3", "8.72", "uV²"], ["F4", "9.11", "uV²"], ["FAA", "+0.044", "ln ratio"]],
    visual: "bars",
    bars: [["F3", 68], ["F4", 73]],
    note: "不对称性数值仅演示字段和视觉层级。"
  },
  "alpha-ratio": {
    subtitle: "睁眼 / 闭眼 Alpha 抑制指数模拟页",
    metrics: [["O1 EC", "14.82", "uV²"], ["O1 EO", "6.31", "uV²"], ["O2 EC", "15.06", "uV²"], ["O2 EO", "6.47", "uV²"], ["Mean EC/EO", "2.34", "ratio"]],
    visual: "bars",
    bars: [["EC", 86], ["EO", 37], ["Ratio", 63]],
    note: "两个分段和比值均为确定性模拟结果。"
  },
  assessment: {
    subtitle: "报告总结编辑区模拟页",
    metrics: [["已纳入方法", "2", "项"], ["自动诊断", "关闭", "未调用 AI"], ["数据来源", "模拟", "非患者数据"]],
    visual: "heatmap",
    note: "综合评估仅展示编辑流程；不得将模拟内容用于诊断、治疗或临床决策。"
  }
};

const reportSourceContracts = {
  paf: {
    source: "src/qeeg_algorithm-main/qeeg/analyzers/paf_analyzer.py:9-53",
    contract: "Required channels O1 and O2; Welch PSD searches PAF_SEARCH_BAND; mean_peak = (o1_peak_freq + o2_peak_freq) / 2.0.",
  },
  psd: {
    source: "src/qeeg_algorithm-main/qeeg/analyzers/psd_analyzer.py:9-100",
    contract: "Welch or periodogram PSD; absolute and relative Delta/Theta/Alpha/SMR/Beta/High Beta/Gamma band power by channel.",
  },
  tbr: {
    source: "src/qeeg_algorithm-main/qeeg/analyzers/tbr_analyzer.py:9-53",
    contract: "Required channels Fz and Cz; each ratio is theta / beta with a 1e-10 denominator guard; mean_ratio averages Fz and Cz.",
  },
  zscore: {
    source: "src/qeeg_algorithm-main/qeeg/zscore/norms_reader.py:9-210; zscore_calculator.py:266-646",
    contract: "Cuban 19-channel broadband/narrowband norms; age 5-87; PG/RD and eyes-open/eyes-closed model selection; significant deviations use abs(z) >= 1.96.",
  },
  "band-power": {
    source: "src/qeeg_algorithm-main/qeeg/analyzers/band_mapping_analyzer.py:9-51",
    contract: "2-34 Hz in 2 Hz steps; absolute_power and relative_power matrices; relative power divides by channel total power when total > 0.",
  },
  "band-ratio": {
    source: "src/qeeg_algorithm-main/qeeg/analyzers/ratio_mapping_analyzer.py:9-49",
    contract: "Channel ratios include theta_alpha and theta_beta; every numerator / denominator calculation returns 0 when denominator <= 1e-10.",
  },
  faa: {
    source: "src/qeeg_algorithm-main/qeeg/analyzers/faa_analyzer.py:9-68",
    contract: "Required channels F3 and F4; alpha power is log transformed and FAA is ln(F4) - ln(F3).",
  },
  "alpha-ratio": {
    source: "src/qeeg_algorithm-main/qeeg/analyzers/alpha_ratio_analyzer.py:9-75",
    contract: "Required channels O1 and O2 in closed-eye and open-eye segments; ratio = closed_mean / open_mean with zero-output guard.",
  },
};

const tableBody = document.querySelector("#subject-table-body");
const searchInput = document.querySelector("#subject-search");
const subjectEmpty = document.querySelector("#subject-empty");
const pagePrev = document.querySelector("#page-prev");
const pageNext = document.querySelector("#page-next");
const pageJump = document.querySelector("#page-jump");
const pageInput = document.querySelector("#page-input");
const pageTotal = document.querySelector("#page-total");
const taskList = document.querySelector("#task-list");
const taskEditor = document.querySelector("#task-editor");
const taskEmptyState = document.querySelector("#task-empty-state");
const taskNameInput = document.querySelector("#task-name");
const analysisMethod = document.querySelector("#analysis-method");
const analysisMethodTrigger = document.querySelector("#analysis-method-trigger");
const methodOptions = document.querySelector("#method-options");
const windowStartInput = document.querySelector("#window-start");
const windowDurationInput = document.querySelector("#window-duration");
const selectionSummary = document.querySelector("#selection-summary");
const bandpassSelect = document.querySelector("#bandpass");
const highpassEnabled = document.querySelector("#highpass-enabled");
const highpassValue = document.querySelector("#highpass-value");
const lowpassEnabled = document.querySelector("#lowpass-enabled");
const lowpassValue = document.querySelector("#lowpass-value");
const notchEnabled = document.querySelector("#notch-enabled");
const notchValue = document.querySelector("#notch-value");
const xAxisScale = document.querySelector("#x-axis-scale");
const yAxisScale = document.querySelector("#y-axis-scale");
const waveformTimeRuler = document.querySelector("#waveform-time-ruler");
const waveformStartTime = document.querySelector("#waveform-start-time");
const waveformEndTime = document.querySelector("#waveform-end-time");
const waveformTotalTime = document.querySelector("#waveform-total-time");
const toast = document.querySelector("#toast");
const confirmConfigButton = document.querySelector("#confirm-config");
const segmentButtons = [...document.querySelectorAll(".segment-button")];
const filterCheckboxes = [highpassEnabled, lowpassEnabled, notchEnabled];
const subjectForm = document.querySelector("#subject-form");
const subjectModalTitle = document.querySelector("#subject-modal-title");
const subjectSubmitButton = document.querySelector("#subject-submit-button");
const appShell = document.querySelector(".app-shell");
const taskRunState = document.querySelector("#task-run-state");
const taskRunDetail = document.querySelector("#task-run-detail");
const taskRunProgress = document.querySelector("#task-run-progress");
const taskSimulationOutcome = document.querySelector("#task-simulation-outcome");
const startTaskSimulationButton = document.querySelector("#start-task-simulation");
const cancelTaskSimulationButton = document.querySelector("#cancel-task-simulation");
const reportOutlineSections = document.querySelector("#report-outline-sections");
const reportSectionContent = document.querySelector("#report-section-content");
const reportComment = document.querySelector("#report-comment");
const reportBatchState = document.querySelector("#report-batch-state");
const reportBatchDetail = document.querySelector("#report-batch-detail");
const reportBatchProgress = document.querySelector("#report-batch-progress");
const reportBatchScenario = document.querySelector("#report-batch-scenario");
const reportMethodStatuses = document.querySelector("#report-method-statuses");
const startReportBatchButton = document.querySelector("#start-report-batch");
const cancelReportBatchButton = document.querySelector("#cancel-report-batch");
const pdfSimulationPanel = document.querySelector("#pdf-simulation-panel");
const pdfSimulationState = document.querySelector("#pdf-simulation-state");
const pdfSimulationProgress = document.querySelector("#pdf-simulation-progress");
const pdfSimulationOutcome = document.querySelector("#pdf-simulation-outcome");
const startPdfSimulationButton = document.querySelector("#start-pdf-simulation");
const cancelPdfSimulationButton = document.querySelector("#cancel-pdf-simulation");
const taskSimulationTimers = new Map();
let reportBatchTimer = null;
let pdfSimulationTimer = null;
let activeModalBackdrop = null;
let modalReturnFocus = null;

const bandpassPresets = {
  "Delta (0.5-4.0Hz)": [0.5, 4.0],
  "Theta (4.0-8.0Hz)": [4.0, 8.0],
  "Alpha (8.0-13.0Hz)": [8.0, 13.0],
  "SMR (12.0-15.0Hz)": [12.0, 15.0],
  "Beta (13.0-30.0Hz)": [13.0, 30.0],
  "Custom (0.5-30.0Hz)": [0.5, 30.0]
};

const xAxisTickDefinitions = {
  "5 秒/页": { maximum: 5, step: 1, unit: "s" },
  "10 秒/页": { maximum: 10, step: 2, unit: "s" },
  "15 秒/页": { maximum: 15, step: 3, unit: "s" },
  "20 秒/页": { maximum: 20, step: 4, unit: "s" },
  "30 秒/页": { maximum: 30, step: 5, unit: "s" },
  "60 秒/页": { maximum: 60, step: 10, unit: "s" },
  "15 分钟/页": { maximum: 15, step: 3, unit: "min" },
  "20 分钟/页": { maximum: 20, step: 4, unit: "min" },
  "1 小时/页": { maximum: 60, step: 10, unit: "min" }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function localDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatClock(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainingSeconds = value % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function setInputValidity(input, valid) {
  input.setAttribute("aria-invalid", String(!valid));
  return valid;
}

function normalizeNumberInput(input, integer = false, allowEmpty = false) {
  if (allowEmpty && input.value === "") return null;
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const parsed = Number(input.value);
  const fallback = Number.isFinite(minimum) ? minimum : 0;
  let value = Number.isFinite(parsed) ? parsed : fallback;
  value = Math.min(maximum, Math.max(minimum, value));
  if (integer) value = Math.round(value);
  input.value = integer ? String(value) : value.toFixed(1);
  setInputValidity(input, true);
  return value;
}

function currentSubject() {
  return subjects.find((subject) => subject.id === appState.selectedSubjectId) ?? null;
}

function currentTask() {
  return appState.tasks.find((task) => task.id === appState.selectedTaskId) ?? null;
}

function bmiToneClass(value) {
  if (value < 18.5) return "is-low";
  if (value < 24) return "is-normal";
  return "is-high";
}

function refreshReportStatus() {
  const reportStatus = document.querySelector("#report-status");
  const buildButton = document.querySelector("#build-report-preview");
  const reportNav = document.querySelector('.nav-button[data-page="report"]');
  if (!currentSubject()) {
    reportStatus.textContent = "请先选择受试者并完成至少一个任务配置";
    buildButton.disabled = true;
    reportNav.disabled = true;
    return;
  }

  const confirmed = appState.tasks.filter((task) => task.confirmed).length;
  reportStatus.textContent = confirmed
    ? `已完成 ${confirmed} 个任务配置，可查看报告交互预览`
    : "请先完成至少一个任务配置";
  buildButton.disabled = confirmed === 0;
  reportNav.disabled = confirmed === 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 2200);
}

function switchPage(pageName) {
  const navButton = document.querySelector(`.nav-button[data-page="${pageName}"]`);
  if (navButton?.disabled) return;

  if (pageName === "report") refreshReportStatus();

  document.querySelectorAll(".page").forEach((page) => page.classList.remove("is-active"));
  document.querySelector(`#page-${pageName}`).classList.add("is-active");
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.page === pageName));
}

function updateSubjectContext() {
  const subject = currentSubject();
  const currentId = document.querySelector("#current-subject-id");
  const taskNav = document.querySelector('.nav-button[data-page="tasks"]');
  const reportNav = document.querySelector('.nav-button[data-page="report"]');

  currentId.textContent = subject?.id ?? "None";
  currentId.classList.toggle("has-value", Boolean(subject));
  taskNav.disabled = !subject;
  reportNav.disabled = !subject || !appState.tasks.some((task) => task.confirmed);

  if (!subject) return;
  document.querySelector("#task-subject-name").textContent = subject.name;
  document.querySelector("#task-subject-code").textContent = subject.id;
  document.querySelector("#task-subject-gender").textContent = subject.gender;
  document.querySelector("#task-subject-age").textContent = `${subject.age}岁`;
  document.querySelector("#task-subject-bmi").textContent = `BMI:${subject.bmi.toFixed(1)}`;
}

function renderSubjects() {
  const query = appState.search.trim().toLowerCase();
  let visibleSubjects = subjects.filter((subject) => !query || subject.id.toLowerCase().includes(query) || subject.name.toLowerCase().includes(query));

  if (appState.sort) {
    visibleSubjects = [...visibleSubjects].sort((a, b) => {
      const left = a[appState.sort];
      const right = b[appState.sort];
      return (left > right ? 1 : left < right ? -1 : 0) * appState.sortDirection;
    });
  }

  const totalPages = Math.max(1, Math.ceil(visibleSubjects.length / appState.pageSize));
  appState.currentPage = Math.min(Math.max(1, appState.currentPage), totalPages);
  const pageStart = (appState.currentPage - 1) * appState.pageSize;
  const pageSubjects = visibleSubjects.slice(pageStart, pageStart + appState.pageSize);

  tableBody.replaceChildren(...pageSubjects.map((subject) => {
    const row = document.createElement("tr");
    row.dataset.subjectId = subject.id;
    row.classList.toggle("is-selected", appState.selectedSubjectId === subject.id);
    row.innerHTML = `
      <td>${escapeHtml(subject.id)}</td><td>${escapeHtml(subject.name)}</td><td>${subject.age}</td><td>${escapeHtml(subject.gender)}</td>
      <td>${escapeHtml(subject.date)}</td><td>${subject.height}</td><td>${subject.weight.toFixed(1)}</td><td><span class="bmi-pill ${bmiToneClass(subject.bmi)}">${subject.bmi.toFixed(1)}</span></td><td>${escapeHtml(subject.collector || "--")}</td>
      <td><div class="row-actions">
        <button class="row-action primary-row-action select-subject" type="button"><img src="assets/analysis.png" alt=""><span>分析</span></button>
        <button class="row-action history-subject" type="button" aria-label="查看历史" title="查看历史"><img src="assets/history_record.png" alt=""></button>
        <button class="row-action edit-subject" type="button" aria-label="编辑受试者" title="编辑受试者"><img src="assets/edit.png" alt=""></button>
        <button class="row-action is-danger delete-subject" type="button" aria-label="删除受试者" title="删除受试者"><img src="assets/delete.png" alt=""></button>
      </div></td>`;
    return row;
  }));

  subjectEmpty.hidden = visibleSubjects.length > 0;
  pageTotal.textContent = String(totalPages);
  pageInput.value = String(appState.currentPage);
  pageInput.max = String(totalPages);
  pageInput.disabled = totalPages === 1;
  pageJump.disabled = totalPages === 1;
  pagePrev.disabled = appState.currentPage === 1;
  pageNext.disabled = appState.currentPage === totalPages;
}

const taskStatePresentation = {
  idle: { label: "空闲", detail: "等待开始模拟" },
  running: { label: "运行中", detail: "正在推进确定性界面进度" },
  success: { label: "成功", detail: "模拟任务完成；未执行算法" },
  failure: { label: "失败", detail: "模拟任务失败；未产生分析结果" },
  cancelled: { label: "已取消", detail: "模拟任务已取消；可重新运行" }
};

function clearTaskSimulationTimer(taskId) {
  const timer = taskSimulationTimers.get(taskId);
  if (timer) window.clearInterval(timer);
  taskSimulationTimers.delete(taskId);
}

function clearAllTaskSimulationTimers() {
  taskSimulationTimers.forEach((timer) => window.clearInterval(timer));
  taskSimulationTimers.clear();
}

function resetTaskSimulation(task, detail = "等待开始模拟") {
  if (!task) return;
  clearTaskSimulationTimer(task.id);
  task.runState = "idle";
  task.runProgress = 0;
  task.runDetail = detail;
}

function invalidateTaskSimulation(task, detail = "配置已变更；请重新确认后开始模拟") {
  if (!task) return;
  resetTaskSimulation(task, detail);
  const badge = taskList.querySelector(`[data-task-id="${task.id}"] .task-state-badge`);
  if (badge) {
    badge.dataset.state = "idle";
    badge.textContent = taskStatePresentation.idle.label;
  }
  if (task.id === appState.selectedTaskId) renderTaskSimulation(task);
}

function renderTaskSimulation(task) {
  const state = task.runState ?? "idle";
  const presentation = taskStatePresentation[state] ?? taskStatePresentation.idle;
  const progress = Math.max(0, Math.min(100, Number(task.runProgress) || 0));
  taskRunState.dataset.state = state;
  taskRunState.className = `simulation-state is-${state}`;
  taskRunState.textContent = presentation.label;
  taskRunDetail.textContent = task.runDetail || presentation.detail;
  taskRunProgress.setAttribute("aria-valuenow", String(progress));
  taskRunProgress.querySelector("span").style.width = `${progress}%`;
  taskSimulationOutcome.value = task.simulationOutcome ?? "success";
  taskSimulationOutcome.disabled = state === "running";
  startTaskSimulationButton.disabled = !task.confirmed || state === "running";
  startTaskSimulationButton.textContent = state === "idle" ? "开始模拟" : "重新模拟";
  cancelTaskSimulationButton.disabled = state !== "running";
}

function startTaskSimulation() {
  const task = currentTask();
  if (!task?.confirmed) {
    showToast("请先确认任务配置，再运行状态模拟");
    return;
  }
  clearTaskSimulationTimer(task.id);
  task.runState = "running";
  task.runProgress = 0;
  task.runDetail = "正在推进确定性界面进度；不调用真实算法";
  renderTasks();
  const timer = window.setInterval(() => {
    const activeTask = appState.tasks.find((item) => item.id === task.id);
    if (!activeTask || activeTask.runState !== "running") {
      clearTaskSimulationTimer(task.id);
      return;
    }
    activeTask.runProgress = Math.min(100, activeTask.runProgress + 25);
    if (activeTask.runProgress >= 100) {
      clearTaskSimulationTimer(task.id);
      activeTask.runState = activeTask.simulationOutcome === "failure" ? "failure" : "success";
      activeTask.runDetail = activeTask.runState === "failure"
        ? "模拟任务失败；未产生分析结果"
        : "模拟任务完成；未执行算法";
    }
    renderTasks();
  }, 120);
  taskSimulationTimers.set(task.id, timer);
}

function cancelTaskSimulation() {
  const task = currentTask();
  if (!task || task.runState !== "running") return;
  clearTaskSimulationTimer(task.id);
  task.runState = "cancelled";
  task.runDetail = "模拟任务已取消；可重新运行";
  renderTasks();
}

const reportBatchPresentation = {
  idle: { label: "空闲", detail: "等待开始报告批处理模拟" },
  running: { label: "运行中", detail: "正在按已确认方法推进批处理；未调用真实算法" },
  success: { label: "成功", detail: "八个算法模拟项已完成；报告 fixture 已重建" },
  failure: { label: "失败", detail: "报告批处理被前提门禁阻断；可修正场景后重试" },
  cancelled: { label: "已取消", detail: "报告批处理已取消；未生成报告预览" }
};

const reportMethodPresentation = {
  idle: "等待计算",
  running: "正在计算",
  success: "计算完成",
  failure: "前提失败",
  cancelled: "已取消"
};

const reportFailureScenarios = {
  "paf-o1-missing": { method: "Peak Alpha Frequency", message: "PAF 前提失败：缺少 O1 通道。" },
  "paf-o2-missing": { method: "Peak Alpha Frequency", message: "PAF 前提失败：缺少 O2 通道。" },
  "tbr-fz-missing": { method: "Theta/Beta Ratio", message: "TBR 前提失败：缺少 Fz 通道。" },
  "tbr-cz-missing": { method: "Theta/Beta Ratio", message: "TBR 前提失败：缺少 Cz 通道。" },
  "faa-f3-missing": { method: "Frontal Alpha Asymmetry", message: "FAA 前提失败：缺少 F3 通道。" },
  "faa-f4-missing": { method: "Frontal Alpha Asymmetry", message: "FAA 前提失败：缺少 F4 通道。" },
  "alpha-o1-missing": { method: "alpha Ratio(EC/EO)", message: "Alpha Ratio 前提失败：缺少 O1 通道。" },
  "alpha-o2-missing": { method: "alpha Ratio(EC/EO)", message: "Alpha Ratio 前提失败：缺少 O2 通道。" },
  "alpha-condition-missing": { method: "alpha Ratio(EC/EO)", message: "Alpha Ratio 前提失败：必须明确 EC 与 EO 两个条件。" },
  "alpha-event-missing": { method: "alpha Ratio(EC/EO)", message: "Alpha Ratio 前提失败：事件锚点缺失或不可用，不得静默回退整段数据。" },
  "zscore-age-missing": { method: "Z-Score Analysis", message: "Z-Score 前提失败：未提供年龄，不得默认 30 岁。" },
  "zscore-age-range": { method: "Z-Score Analysis", message: "Z-Score 前提失败：年龄必须在 5–87 岁范围内，不得截断。" },
  "zscore-condition-missing": { method: "Z-Score Analysis", message: "Z-Score 前提失败：必须明确 eyes_open / eyes_closed。" },
  "zscore-model-missing": { method: "Z-Score Analysis", message: "Z-Score 前提失败：必须选择 broadband / narrowband 模型。" },
  "zscore-correction-missing": { method: "Z-Score Analysis", message: "Z-Score 前提失败：必须明确 PG / RD 校正。" },
  "zscore-norms-missing": { method: "Z-Score Analysis", message: "Z-Score 前提失败：对应常模文件不可用。" },
  "zscore-license-unverified": { method: "Z-Score Analysis", message: "Z-Score 前提失败：常模许可未验证，禁止生成常模比较输出。" }
};

function clearReportBatchTimer() {
  if (reportBatchTimer) window.clearTimeout(reportBatchTimer);
  reportBatchTimer = null;
}

function confirmedAlgorithmTasks() {
  return appState.tasks.filter((task) => task.confirmed && task.method !== "Report Output" && methodReportSections[task.method]);
}

function syncReportBatchItems() {
  appState.reportBatchItems = confirmedAlgorithmTasks().map((task) => ({
    taskId: task.id,
    method: task.method,
    taskName: task.name,
    state: "idle",
    detail: "等待报告生成"
  }));
}

function renderReportBatch() {
  const state = appState.reportBatchState;
  const presentation = reportBatchPresentation[state] ?? reportBatchPresentation.idle;
  const progress = Math.max(0, Math.min(100, Number(appState.reportBatchProgress) || 0));
  const hasConfirmedTasks = appState.tasks.some((task) => task.confirmed);
  reportBatchState.dataset.state = state;
  reportBatchState.className = `simulation-state is-${state}`;
  reportBatchState.textContent = presentation.label;
  reportBatchDetail.textContent = appState.reportBatchDetail || presentation.detail;
  reportBatchProgress.setAttribute("aria-valuenow", String(progress));
  reportBatchProgress.querySelector("span").style.width = `${progress}%`;
  reportBatchScenario.value = appState.reportBatchScenario;
  reportBatchScenario.disabled = state === "running";
  startReportBatchButton.disabled = !hasConfirmedTasks || state === "running";
  startReportBatchButton.textContent = state === "idle" ? "开始报告批处理" : "重新生成报告";
  cancelReportBatchButton.disabled = state !== "running";
  document.querySelector("#build-report-preview").disabled = !hasConfirmedTasks || state === "running";
  reportMethodStatuses.replaceChildren(...appState.reportBatchItems.map((item, index) => {
    const row = document.createElement("div");
    row.className = "report-method-status";
    row.dataset.method = item.method;
    row.dataset.state = item.state;
    row.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(methodShortNames[item.method] ?? item.method)}</strong><small>${escapeHtml(item.taskName)}</small></div><em>${escapeHtml(item.detail || reportMethodPresentation[item.state] || "")}</em>`;
    return row;
  }));
}

function resetReportBatch(detail = "等待开始报告批处理模拟") {
  clearReportBatchTimer();
  appState.reportBatchState = "idle";
  appState.reportBatchProgress = 0;
  appState.reportBatchDetail = detail;
  appState.reportBatchScenario = "success";
  syncReportBatchItems();
  renderReportBatch();
}

function completeReportBatch() {
  clearReportBatchTimer();
  appState.reportBatchState = "success";
  appState.reportBatchProgress = 100;
  appState.reportBatchDetail = "全部算法模拟项完成；Report Output 未计入计算项";
  renderReportBatch();
  prepareReportPreview();
}

function startReportBatch() {
  const confirmedTasks = appState.tasks.filter((task) => task.confirmed);
  if (!confirmedTasks.length) {
    openReportBlocker("没有已配置完成的任务，请先对至少一个任务点击", "「确认配置」");
    return;
  }
  clearReportBatchTimer();
  syncReportBatchItems();
  appState.reportBatchState = "running";
  appState.reportBatchProgress = 0;
  appState.reportBatchDetail = reportBatchPresentation.running.detail;
  appState.reportPreviewReady = false;
  resetReportCommentForNewRun();
  document.querySelector("#report-empty-state").hidden = false;
  document.querySelector("#report-workspace").hidden = true;
  const failure = reportFailureScenarios[appState.reportBatchScenario] ?? null;
  let index = 0;

  const advance = () => {
    if (appState.reportBatchState !== "running") return;
    if (index >= appState.reportBatchItems.length) {
      completeReportBatch();
      return;
    }
    const item = appState.reportBatchItems[index];
    item.state = "running";
    item.detail = `正在计算 ${methodShortNames[item.method] ?? item.method}`;
    appState.reportBatchDetail = item.detail;
    renderReportBatch();
    reportBatchTimer = window.setTimeout(() => {
      if (appState.reportBatchState !== "running") return;
      if (failure?.method === item.method) {
        item.state = "failure";
        item.detail = failure.message;
        appState.reportBatchState = "failure";
        appState.reportBatchProgress = Math.round((index / Math.max(1, appState.reportBatchItems.length)) * 100);
        appState.reportBatchDetail = failure.message;
        clearReportBatchTimer();
        renderReportBatch();
        showToast(failure.message);
        return;
      }
      item.state = "success";
      item.detail = "模拟计算完成；未运行算法";
      index += 1;
      appState.reportBatchProgress = Math.round((index / Math.max(1, appState.reportBatchItems.length)) * 100);
      renderReportBatch();
      advance();
    }, 110);
  };

  renderReportBatch();
  if (!appState.reportBatchItems.length) {
    reportBatchTimer = window.setTimeout(completeReportBatch, 110);
    return;
  }
  advance();
}

function cancelReportBatch() {
  if (appState.reportBatchState !== "running") return;
  clearReportBatchTimer();
  const runningItem = appState.reportBatchItems.find((item) => item.state === "running");
  if (runningItem) {
    runningItem.state = "cancelled";
    runningItem.detail = "报告批处理已取消";
  }
  appState.reportBatchState = "cancelled";
  appState.reportBatchDetail = reportBatchPresentation.cancelled.detail;
  document.querySelector("#report-empty-state").hidden = false;
  document.querySelector("#report-workspace").hidden = true;
  renderReportBatch();
}

const pdfStatePresentation = {
  idle: "空闲 · 未创建文件",
  running: "运行中 · 未创建文件",
  success: "成功 · 模拟完成，未创建文件",
  failure: "失败 · 未创建文件",
  cancelled: "已取消 · 未创建文件"
};

function clearPdfSimulationTimer() {
  if (pdfSimulationTimer) window.clearInterval(pdfSimulationTimer);
  pdfSimulationTimer = null;
}

function renderPdfSimulation() {
  const state = appState.pdfSimulationState;
  const progress = Math.max(0, Math.min(100, Number(appState.pdfSimulationProgress) || 0));
  pdfSimulationState.dataset.state = state;
  pdfSimulationState.className = `simulation-state is-${state}`;
  pdfSimulationState.textContent = pdfStatePresentation[state] ?? pdfStatePresentation.idle;
  pdfSimulationProgress.setAttribute("aria-valuenow", String(progress));
  pdfSimulationProgress.querySelector("span").style.width = `${progress}%`;
  pdfSimulationOutcome.value = appState.pdfSimulationOutcome;
  pdfSimulationOutcome.disabled = state === "running";
  startPdfSimulationButton.disabled = state === "running";
  startPdfSimulationButton.textContent = state === "idle" ? "开始模拟" : "重新模拟";
  cancelPdfSimulationButton.disabled = state !== "running";
}

function resetPdfSimulation() {
  clearPdfSimulationTimer();
  appState.pdfSimulationState = "idle";
  appState.pdfSimulationProgress = 0;
  appState.pdfSimulationOutcome = "success";
  renderPdfSimulation();
}

function startPdfSimulation() {
  clearPdfSimulationTimer();
  appState.pdfSimulationOutcome = pdfSimulationOutcome.value;
  appState.pdfSimulationState = "running";
  appState.pdfSimulationProgress = 0;
  renderPdfSimulation();
  pdfSimulationTimer = window.setInterval(() => {
    appState.pdfSimulationProgress = Math.min(100, appState.pdfSimulationProgress + 25);
    if (appState.pdfSimulationProgress >= 100) {
      clearPdfSimulationTimer();
      appState.pdfSimulationState = appState.pdfSimulationOutcome === "failure" ? "failure" : "success";
    }
    renderPdfSimulation();
  }, 120);
}

function cancelPdfSimulation() {
  if (appState.pdfSimulationState !== "running") return;
  clearPdfSimulationTimer();
  appState.pdfSimulationState = "cancelled";
  renderPdfSimulation();
}

function selectSubject(subjectId) {
  clearAllTaskSimulationTimers();
  clearReportBatchTimer();
  clearPdfSimulationTimer();
  appState.selectedSubjectId = subjectId;
  appState.tasks = [];
  appState.selectedTaskId = null;
  pdfSimulationPanel.hidden = true;
  resetPdfSimulation();
  resetReportBatch("已切换受试者；等待新的已确认任务");
  updateSubjectContext();
  renderSubjects();
  renderTasks();
  switchPage("tasks");
}

function renderTasks() {
  taskList.replaceChildren(...appState.tasks.map((task, index) => {
    const item = document.createElement("div");
    item.className = `task-item${task.id === appState.selectedTaskId ? " is-active" : ""}`;
    item.dataset.taskId = String(task.id);
    const runState = task.runState ?? "idle";
    const runLabel = taskStatePresentation[runState]?.label ?? taskStatePresentation.idle.label;
    item.innerHTML = `<button class="select-task" type="button" aria-label="选择任务 ${escapeHtml(task.name)}"><span class="task-index">${String(index + 1).padStart(2, "0")}</span><span class="task-copy"><strong>${escapeHtml(task.name)}</strong><span>${escapeHtml(methodShortNames[task.method] ?? task.method)}</span><span class="task-state-badge" data-state="${runState}">${escapeHtml(runLabel)}</span></span></button><button class="delete-task" type="button" aria-label="删除任务 ${escapeHtml(task.name)}"><img src="assets/delete.png" alt=""></button>`;
    return item;
  }));

  const task = currentTask();
  taskEmptyState.hidden = Boolean(task);
  taskEditor.hidden = !task;
  if (task) {
    taskNameInput.value = task.name;
    analysisMethod.value = task.method;
    renderMethodCombobox(task.method);
    renderSegmentInputs(task);
    renderFilterInputs(task);
    renderPlotInputs(task);
    confirmConfigButton.classList.toggle("is-confirmed", task.confirmed);
    confirmConfigButton.textContent = task.confirmed ? "配置已确认" : "确认配置";
    setTaskControlsLocked(task.confirmed);
    renderTaskSimulation(task);
  }
  refreshReportStatus();
}

function renderMethodCombobox(method) {
  const option = methodOptions.querySelector(`[data-method="${method}"]`);
  if (!option) return;
  analysisMethodTrigger.querySelector(".method-chinese").textContent = option.querySelector("span").textContent;
  analysisMethodTrigger.querySelector(".method-english").textContent = option.querySelector("small").textContent;
  methodOptions.querySelectorAll("[role='option']").forEach((item) => item.setAttribute("aria-selected", String(item === option)));
  const segmentSwitch = document.querySelector("#segment-switch");
  const isAlphaRatio = method === "alpha Ratio(EC/EO)";
  segmentSwitch.classList.toggle("is-visible", isAlphaRatio);
  segmentSwitch.setAttribute("aria-hidden", String(!isAlphaRatio));
  selectionSummary.hidden = !isAlphaRatio;
}

function renderSegmentInputs(task) {
  const activeSegment = task.activeSegment ?? 1;
  const values = task.segments?.[activeSegment] ?? { start: 0, duration: activeSegment === 1 ? 120 : 60 };
  windowStartInput.value = String(values.start);
  windowDurationInput.value = String(values.duration);
  setInputValidity(windowStartInput, true);
  setInputValidity(windowDurationInput, true);
  selectionSummary.textContent = `Selection: ${values.duration} Sec`;
  document.querySelectorAll(".segment-button").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.segment) === activeSegment));
  updateWaveformTimeInfo(values);
}

function saveActiveSegment(task, normalizeInputs = false) {
  if (!task) return null;
  const startValid = setInputValidity(windowStartInput, windowStartInput.checkValidity() && Number.isInteger(Number(windowStartInput.value)));
  const durationValid = setInputValidity(windowDurationInput, windowDurationInput.checkValidity() && Number.isInteger(Number(windowDurationInput.value)));
  if (!startValid || !durationValid) return null;
  const activeSegment = task.activeSegment ?? 1;
  const values = {
    start: Number(windowStartInput.value),
    duration: Number(windowDurationInput.value)
  };
  task.segments[activeSegment] = values;
  selectionSummary.textContent = `Selection: ${values.duration} Sec`;
  updateWaveformTimeInfo(values);
  if (normalizeInputs) {
    windowStartInput.value = String(values.start);
    windowDurationInput.value = String(values.duration);
  }
  return values;
}

function updateWaveformTimeInfo(values) {
  const start = Number(values?.start) || 0;
  const duration = Number(values?.duration) || 0;
  waveformStartTime.textContent = formatClock(start);
  waveformEndTime.textContent = formatClock(start + duration);
  waveformTotalTime.textContent = `${duration.toFixed(1)} Sec`;
}

function renderFilterInputs(task) {
  const filter = task.filter;
  bandpassSelect.value = filter.bandpass;
  highpassEnabled.checked = filter.highpassEnabled;
  highpassValue.value = filter.highpass.toFixed(1);
  highpassValue.disabled = task.confirmed || !filter.highpassEnabled;
  lowpassEnabled.checked = filter.lowpassEnabled;
  lowpassValue.value = filter.lowpass.toFixed(1);
  lowpassValue.disabled = task.confirmed || !filter.lowpassEnabled;
  notchEnabled.checked = filter.notchEnabled;
  notchValue.value = filter.notch.toFixed(1);
  notchValue.disabled = task.confirmed || !filter.notchEnabled;
  [highpassValue, lowpassValue, notchValue].forEach((input) => setInputValidity(input, true));
  [highpassEnabled, lowpassEnabled, notchEnabled].forEach((checkbox) => checkbox.closest(".filter-control").classList.toggle("is-off", !checkbox.checked));
}

function validateTaskInputs() {
  normalizeNumberInput(windowStartInput, true);
  normalizeNumberInput(windowDurationInput, true);
  if (highpassEnabled.checked) normalizeNumberInput(highpassValue);
  if (lowpassEnabled.checked) normalizeNumberInput(lowpassValue);
  if (notchEnabled.checked) normalizeNumberInput(notchValue);
  const inputs = [windowStartInput, windowDurationInput];
  if (highpassEnabled.checked) inputs.push(highpassValue);
  if (lowpassEnabled.checked) inputs.push(lowpassValue);
  if (notchEnabled.checked) inputs.push(notchValue);

  let valid = true;
  inputs.forEach((input) => {
    const inputValid = input.checkValidity() && Number.isFinite(Number(input.value));
    setInputValidity(input, inputValid);
    valid = inputValid && valid;
  });
  if (!valid) showToast("请检查分析时间和滤波参数的取值范围");
  return valid;
}

function renderPlotInputs(task) {
  xAxisScale.value = task.plot.xAxisScale;
  yAxisScale.value = task.plot.yAxisScale;
  renderWaveformTimeRuler(task.plot.xAxisScale);
}

function renderWaveformTimeRuler(scale) {
  const definition = xAxisTickDefinitions[scale];
  const labels = definition
    ? Array.from(
      { length: Math.floor(definition.maximum / definition.step) + 1 },
      (_, index) => `${index * definition.step} ${definition.unit}`
    )
    : ["Auto"];

  waveformTimeRuler.replaceChildren(...labels.map((label) => {
    const tick = document.createElement("span");
    tick.textContent = label;
    return tick;
  }));
  waveformTimeRuler.classList.toggle("is-auto", !definition);
  waveformTimeRuler.dataset.scale = scale;
  waveformTimeRuler.setAttribute("aria-label", definition ? `X轴范围：${scale}` : "X轴范围：自动");
}

function reportSectionsForConfirmedTasks() {
  const methodSections = appState.tasks
    .filter((task) => task.confirmed)
    .map((task) => methodReportSections[task.method])
    .filter((section) => section && section !== "assessment");
  const sections = ["overview", ...new Set(methodSections)];
  if (appState.tasks.some((task) => task.confirmed && methodReportSections[task.method] === "assessment")) sections.push("assessment");
  return sections;
}

function taskForReportSection(section) {
  return appState.tasks.find((task) => task.confirmed && methodReportSections[task.method] === section) ?? null;
}

function reportParameterEntries(section) {
  const task = taskForReportSection(section);
  if (!task) {
    return [
      ["已确认任务", String(appState.tasks.filter((item) => item.confirmed).length)],
      ["数据来源", "确定性模拟 fixture"],
      ["算法状态", "未运行算法"]
    ];
  }
  if (section === "zscore") {
    return [
      ["受试者年龄", `${currentSubject()?.age ?? "缺失"} 岁`],
      ["条件", "Eyes Closed (EC)"],
      ["模型", "Broadband + Narrowband"],
      ["校正", "PG"],
      ["常模门禁", "SIMULATED VERIFIED GATE"],
      ["许可边界", "真实来源与授权仍未验证"]
    ];
  }
  const segmentOne = task.segments?.[1] ?? { start: 0, duration: 120 };
  const segmentTwo = task.segments?.[2] ?? { start: 0, duration: 60 };
  const windowLabel = task.method === "alpha Ratio(EC/EO)"
    ? `分段1 ${segmentOne.start}-${segmentOne.start + segmentOne.duration}s / 分段2 ${segmentTwo.start}-${segmentTwo.start + segmentTwo.duration}s`
    : `${segmentOne.start}-${segmentOne.start + segmentOne.duration}s`;
  const enabledFilters = [];
  if (task.filter.highpassEnabled) enabledFilters.push(`HP ${task.filter.highpass.toFixed(1)} Hz`);
  if (task.filter.lowpassEnabled) enabledFilters.push(`LP ${task.filter.lowpass.toFixed(1)} Hz`);
  if (task.filter.notchEnabled) enabledFilters.push(`Notch ${task.filter.notch.toFixed(1)} Hz`);
  const entries = [
    ["分析方法", methodShortNames[task.method] ?? task.method],
    ["分析时间窗", windowLabel],
    ["滤波参数", enabledFilters.join(" · ") || "全部关闭"]
  ];
  if (section === "paf") entries.push(["必需通道", "O1 + O2"]);
  if (section === "tbr") entries.push(["必需通道", "Fz + Cz"]);
  if (section === "faa") entries.push(["必需通道", "F3 + F4"]);
  if (section === "alpha-ratio") {
    entries.push(["必需通道", "O1 + O2"]);
    entries.push(["实验条件", "闭眼 EC / 睁眼 EO"]);
    entries.push(["事件锚点", "SIMULATED EC_START / EO_START"]);
  }
  if (section === "band-power") entries.push(["窄带矩阵", "2–34 Hz · 2 Hz 步进 · 绝对/相对功率"]);
  return entries;
}

function fixtureVisualMarkup(fixture) {
  if (fixture.visual === "bars") {
    const bars = fixture.bars ?? [["模拟值", 50]];
    return `<div class="fixture-visual" role="img" aria-label="确定性模拟柱图">${bars.map(([label, height]) => `<div class="fixture-bar" data-fixture-value="${escapeHtml(height)}" style="--fixture-height:${Math.max(8, Math.min(100, Number(height) || 0))}%"><span>${escapeHtml(label)}</span></div>`).join("")}</div>`;
  }
  if (fixture.visual === "heatmap") {
    const cells = Array.from({ length: 24 }, (_, index) => {
      const hue = 198 + ((index * 11) % 54);
      const light = 38 + ((index * 7) % 34);
      return `<span data-fixture-value="${index + 1}" style="--fixture-hue:${hue};--fixture-light:${light}%"></span>`;
    }).join("");
    return `<div class="fixture-visual fixture-heatmap" role="img" aria-label="确定性模拟热图">${cells}</div>`;
  }
  return `<div class="fixture-visual fixture-spectrum" role="img" aria-label="确定性模拟频谱曲线" data-fixture-value="spectrum"></div>`;
}

function fixtureMatrixMarkup(fixture) {
  if (!fixture.matrices?.length) return "";
  return fixture.matrices.map((matrix) => `
    <section class="fixture-matrix-panel">
      <h3>${escapeHtml(matrix.title)}</h3>
      <div class="fixture-matrix-scroll">
        <table class="fixture-matrix" data-matrix="${escapeHtml(matrix.key)}">
          <thead><tr><th>Channel</th>${fullBand2HzBands.map((band) => `<th data-band="${escapeHtml(band)}">${escapeHtml(band)}</th>`).join("")}</tr></thead>
          <tbody>${matrix.rows.map(([channel, values]) => `<tr><th>${escapeHtml(channel)}</th>${values.map((value) => `<td data-fixture-value="${escapeHtml(value)}">${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
  `).join("");
}

function reportSourceContractMarkup(section) {
  const trace = reportSourceContracts[section];
  if (!trace) return "";
  return `<section class="report-source-contract" data-report-source-contract="${escapeHtml(section)}">
    <div><strong>PC source contract</strong><code>${escapeHtml(trace.source)}</code></div>
    <p>${escapeHtml(trace.contract)}</p>
    <em>Deterministic non-patient fixture. The PC algorithm was not run; no patient samples, norms, or scientific output were produced.</em>
  </section>`;
}

function renderReportOutline() {
  const sections = reportSectionsForConfirmedTasks();
  if (!sections.includes(appState.activeReportSection)) appState.activeReportSection = "overview";
  reportOutlineSections.replaceChildren(...sections.map((section, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.reportSection = section;
    button.classList.toggle("is-active", section === appState.activeReportSection);
    button.textContent = `${String(index + 1).padStart(2, "0")}  ${reportSectionLabels[section]}`;
    return button;
  }));
}

function renderReportSection(section) {
  const sections = reportSectionsForConfirmedTasks();
  const resolvedSection = sections.includes(section) ? section : "overview";
  const fixture = fixtureCatalog[resolvedSection] ?? fixtureCatalog.overview;
  const subject = currentSubject();
  const confirmedCount = appState.tasks.filter((task) => task.confirmed).length;
  const metrics = fixture.metrics.map((metric) => [...metric]);
  if (["overview", "assessment"].includes(resolvedSection)) metrics[0][1] = String(confirmedCount);
  appState.activeReportSection = resolvedSection;
  document.querySelectorAll("[data-report-section]").forEach((item) => item.classList.toggle("is-active", item.dataset.reportSection === resolvedSection));
  document.querySelector("#report-section-title").textContent = reportSectionNames[resolvedSection];
  const parameters = reportParameterEntries(resolvedSection);
  reportSectionContent.innerHTML = `
    <div class="fixture-page-header">
      <div><h2>${escapeHtml(fixture.subtitle)}</h2><p>确定性浏览器 fixture，仅验证 PC 报告页面结构和交互。</p></div>
      <span class="simulation-badge">SIMULATED / NOT PATIENT DATA</span>
    </div>
    <section class="fixture-subject-summary" aria-label="模拟受试者摘要">
      <div><span>受试者 ID</span><strong>${escapeHtml(subject?.id ?? "None")}</strong></div>
      <div><span>姓名</span><strong>${escapeHtml(subject?.name ?? "未选择")}</strong></div>
      <div><span>录入日期</span><strong>${escapeHtml(subject?.date ?? "-")}</strong></div>
      <div><span>数据声明</span><strong>非患者数据 · 未运行算法</strong></div>
    </section>
    <section class="fixture-method-panel">
      <h3>本页参数与来源</h3>
      <div class="fixture-parameter-list">${parameters.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>
    </section>
    ${reportSourceContractMarkup(resolvedSection)}
    <section class="fixture-metrics" aria-label="确定性模拟指标">${metrics.map(([label, value, unit]) => `<div class="fixture-metric"><span>${escapeHtml(label)}</span><strong data-fixture-value="${escapeHtml(value)}">${escapeHtml(value)}</strong><em>${escapeHtml(unit)}</em></div>`).join("")}</section>
    <section class="fixture-visual-panel"><h3>模拟结果视觉</h3>${fixtureVisualMarkup(fixture)}</section>
    ${fixtureMatrixMarkup(fixture)}
    <p class="fixture-note"><strong>SIMULATED / NOT PATIENT DATA</strong> · 非患者数据，未运行算法。${escapeHtml(fixture.note)}</p>
  `;
}

function setTaskControlsLocked(locked) {
  taskEditor.classList.toggle("is-locked", locked);
  taskNameInput.disabled = locked;
  analysisMethodTrigger.disabled = locked;
  windowStartInput.disabled = locked;
  windowDurationInput.disabled = locked;
  bandpassSelect.disabled = locked;
  segmentButtons.forEach((button) => { button.disabled = locked; });
  filterCheckboxes.forEach((checkbox) => { checkbox.disabled = locked; });

  const task = currentTask();
  highpassValue.disabled = locked || !task?.filter.highpassEnabled;
  lowpassValue.disabled = locked || !task?.filter.lowpassEnabled;
  notchValue.disabled = locked || !task?.filter.notchEnabled;
}

function setMethodOptionsOpen(open) {
  methodOptions.hidden = !open;
  analysisMethodTrigger.setAttribute("aria-expanded", String(open));
}

function addTask() {
  const id = Date.now();
  const task = {
    id,
    name: "新任务",
    method: "Peak Alpha Frequency",
    confirmed: false,
    runState: "idle",
    runProgress: 0,
    runDetail: "等待确认配置后开始模拟",
    simulationOutcome: "success",
    activeSegment: 1,
    segments: { 1: { start: 0, duration: 120 }, 2: { start: 0, duration: 60 } },
    filter: { bandpass: "Custom (0.5-30.0Hz)", highpassEnabled: true, highpass: 1.0, lowpassEnabled: true, lowpass: 35.0, notchEnabled: true, notch: 50.0 },
    plot: { xAxisScale: "Auto", yAxisScale: "Auto" }
  };
  appState.tasks.push(task);
  appState.selectedTaskId = id;
  renderTasks();
}

function openModal(id) {
  const backdrop = document.querySelector(`#${id}`);
  if (!backdrop) return;
  window.clearTimeout(showToast.timer);
  toast.hidden = true;
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModalBackdrop = backdrop;
  appShell.inert = true;
  backdrop.hidden = false;
  (backdrop.querySelector("[data-default-focus]") ?? backdrop.querySelector(".modal"))?.focus();
}

function closeModal(backdrop) {
  backdrop.hidden = true;
  if (backdrop !== activeModalBackdrop) return;
  activeModalBackdrop = null;
  appShell.inert = false;
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
  modalReturnFocus = null;
}

function updateSubjectBmi() {
  const height = Number(subjectForm.elements.height.value);
  const weight = Number(subjectForm.elements.weight.value);
  const valid = height >= 30 && height <= 250 && weight >= 2 && weight <= 300;
  subjectForm.elements.bmi.value = valid ? (weight / ((height / 100) ** 2)).toFixed(1) : "";
}

function openSubjectModal(subject = null) {
  subjectForm.reset();
  appState.editingSubjectId = subject?.id ?? null;
  subjectModalTitle.textContent = "受试者档案录入";
  subjectSubmitButton.textContent = subject ? "确认修改" : "确认添加";
  subjectForm.elements.id.readOnly = Boolean(subject);

  if (subject) {
    subjectForm.elements.id.value = subject.id;
    subjectForm.elements.name.value = subject.name;
    subjectForm.elements.age.value = String(subject.age);
    subjectForm.elements.height.value = String(subject.height);
    subjectForm.elements.weight.value = String(subject.weight);
    subjectForm.elements.collector.value = subject.collector ?? "";
    subjectForm.elements.remark.value = subject.remark ?? "";
    const gender = subjectForm.querySelector(`[name="gender"][value="${CSS.escape(subject.gender)}"]`);
    if (gender) gender.checked = true;
  }
  updateSubjectBmi();
  openModal("subject-modal");
}

function openHistoryModal(subject) {
  const items = [
    ["姓名", subject.name],
    ["性别", subject.gender],
    ["年龄", String(subject.age)],
    ["身体指标", `${subject.height}cm/${subject.weight.toFixed(1)}kg`],
    ["采集人", subject.collector || "--"]
  ];
  document.querySelector("#history-subject-info").replaceChildren(...items.map(([label, value]) => {
    const item = document.createElement("div");
    item.className = "history-info-item";
    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    const valueElement = document.createElement("strong");
    valueElement.textContent = value;
    item.append(labelElement, valueElement);
    return item;
  }));
  openModal("history-modal");
}

function openReportBlocker(message, actionName = "") {
  const messageElement = document.querySelector("#report-blocked-message");
  messageElement.replaceChildren(document.createTextNode(message));
  if (actionName) {
    const actionElement = document.createElement("span");
    actionElement.className = "report-action-name";
    actionElement.textContent = actionName;
    messageElement.append(actionElement, document.createTextNode("。"));
  }
  openModal("report-blocked-modal");
}

document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => switchPage(button.dataset.page)));
document.querySelectorAll("[data-page-jump]").forEach((button) => button.addEventListener("click", () => switchPage(button.dataset.pageJump)));
document.querySelectorAll("[data-open-modal]").forEach((button) => button.addEventListener("click", () => openModal(button.dataset.openModal)));
document.querySelectorAll(".close-modal").forEach((button) => button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop"))));
document.addEventListener("keydown", (event) => {
  if (!activeModalBackdrop) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal(activeModalBackdrop);
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...activeModalBackdrop.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) {
    event.preventDefault();
    activeModalBackdrop.querySelector(".modal")?.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeFocusIndex = focusable.indexOf(document.activeElement);
  if (event.shiftKey && activeFocusIndex <= 0) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (activeFocusIndex === -1 || activeFocusIndex === focusable.length - 1)) {
    event.preventDefault();
    first.focus();
  }
});

document.querySelector("#open-subject-create").addEventListener("click", () => openSubjectModal());
searchInput.addEventListener("input", () => {
  appState.search = searchInput.value;
  appState.currentPage = 1;
  renderSubjects();
});
document.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
  const field = button.dataset.sort;
  appState.sortDirection = appState.sort === field ? appState.sortDirection * -1 : 1;
  appState.sort = field;
  appState.currentPage = 1;
  renderSubjects();
}));
pagePrev.addEventListener("click", () => { appState.currentPage -= 1; renderSubjects(); });
pageNext.addEventListener("click", () => { appState.currentPage += 1; renderSubjects(); });
function jumpToSubjectPage() {
  const requestedPage = Number(pageInput.value);
  const totalPages = Number(pageTotal.textContent);
  if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > totalPages) {
    pageInput.value = String(appState.currentPage);
    showToast(`请输入 1 到 ${totalPages} 之间的页码`);
    return;
  }
  appState.currentPage = requestedPage;
  renderSubjects();
}
pageJump.addEventListener("click", jumpToSubjectPage);
pageInput.addEventListener("keydown", (event) => { if (event.key === "Enter") jumpToSubjectPage(); });

tableBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if (!row) return;
  const subjectId = row.dataset.subjectId;
  const subject = subjects.find((item) => item.id === subjectId);
  if (!subject) return;
  if (event.target.closest(".select-subject")) selectSubject(subjectId);
  if (event.target.closest(".history-subject")) openHistoryModal(subject);
  if (event.target.closest(".edit-subject")) openSubjectModal(subject);
  if (event.target.closest(".delete-subject")) {
    appState.pendingSubjectDeleteId = subjectId;
    document.querySelector("#subject-delete-message").innerHTML = `确定要删除受试者<strong>【${escapeHtml(subject.name)}&nbsp;&nbsp;${escapeHtml(subject.id)}】</strong>的数据吗？删除后将无法找回！`;
    openModal("subject-delete-modal");
  }
});

subjectForm.elements.height.addEventListener("input", updateSubjectBmi);
subjectForm.elements.weight.addEventListener("input", updateSubjectBmi);
subjectForm.elements.remark.addEventListener("input", () => {
  if (subjectForm.elements.remark.value.length > 500) subjectForm.elements.remark.value = subjectForm.elements.remark.value.slice(0, 500);
});

subjectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const height = Number(form.get("height"));
  const weight = Number(form.get("weight"));
  const id = String(form.get("id")).trim();
  const name = String(form.get("name")).trim();
  const normalizedName = name.replace(/\s+/g, " ");
  const validName = normalizedName.length >= 2 && normalizedName.length <= 20 && /^[A-Za-z\u4e00-\u9fff· ]+$/.test(normalizedName);
  if (!validName) { showToast("姓名需为 2-20 个中英文字符，可含空格和“·”"); return; }
  if (!/^[A-Za-z0-9]{1,10}$/.test(id)) { showToast("ID 仅支持英文字母和数字，最多 10 位"); return; }
  if (!event.currentTarget.checkValidity()) { showToast("请检查必填项和数值范围"); return; }
  if (!appState.editingSubjectId && subjects.some((subject) => subject.id === id)) { showToast("受试者 ID 已存在"); return; }
  const bmi = weight / ((height / 100) ** 2);
  const subjectData = { id, name: normalizedName, age: Number(form.get("age")), gender: String(form.get("gender")), height, weight, bmi, collector: String(form.get("collector")).trim(), remark: String(form.get("remark")), date: localDateStamp() };
  if (appState.editingSubjectId) {
    const index = subjects.findIndex((subject) => subject.id === appState.editingSubjectId);
    if (index >= 0) subjects[index] = { ...subjects[index], ...subjectData, id: appState.editingSubjectId, date: subjects[index].date };
    if (appState.editingSubjectId === appState.selectedSubjectId) updateSubjectContext();
    showToast("受试者档案已在当前原型中更新，未写入 PC 数据库");
  } else {
    subjects.unshift(subjectData);
    appState.currentPage = 1;
    showToast("受试者档案已加入当前原型，未写入 PC 数据库");
  }
  closeModal(document.querySelector("#subject-modal"));
  renderSubjects();
  event.currentTarget.reset();
  appState.editingSubjectId = null;
});

document.querySelector("#confirm-subject-delete").addEventListener("click", () => {
  const subjectId = appState.pendingSubjectDeleteId;
  const index = subjects.findIndex((subject) => subject.id === subjectId);
  if (index >= 0) subjects.splice(index, 1);
  if (appState.selectedSubjectId === subjectId) {
    appState.selectedSubjectId = null;
    appState.tasks = [];
    appState.selectedTaskId = null;
    updateSubjectContext();
  }
  appState.pendingSubjectDeleteId = null;
  closeModal(document.querySelector("#subject-delete-modal"));
  renderSubjects();
  renderTasks();
  showToast("受试者档案已从当前原型移除，未写入 PC 数据库");
});

document.querySelector("#new-task-button").addEventListener("click", addTask);
taskSimulationOutcome.addEventListener("change", () => {
  const task = currentTask();
  if (task) task.simulationOutcome = taskSimulationOutcome.value;
});
startTaskSimulationButton.addEventListener("click", startTaskSimulation);
cancelTaskSimulationButton.addEventListener("click", cancelTaskSimulation);
taskList.addEventListener("click", (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;
  const taskId = Number(item.dataset.taskId);
  saveActiveSegment(currentTask(), true);
  if (event.target.closest(".delete-task")) {
    const task = appState.tasks.find((itemTask) => itemTask.id === taskId);
    appState.pendingTaskDeleteId = taskId;
    document.querySelector("#task-delete-message").innerHTML = `确定删除任务<strong>【${escapeHtml(task?.name ?? "")}】</strong>吗？删除后将无法找回！`;
    openModal("task-delete-modal");
    return;
  } else if (event.target.closest(".select-task")) {
    appState.selectedTaskId = taskId;
  } else {
    return;
  }
  renderTasks();
});

document.querySelector("#confirm-task-delete").addEventListener("click", () => {
  const taskId = appState.pendingTaskDeleteId;
  clearTaskSimulationTimer(taskId);
  appState.tasks = appState.tasks.filter((task) => task.id !== taskId);
  appState.selectedTaskId = null;
  appState.pendingTaskDeleteId = null;
  closeModal(document.querySelector("#task-delete-modal"));
  renderTasks();
});

taskNameInput.addEventListener("input", () => {
  const task = currentTask();
  if (!task) return;
  task.name = taskNameInput.value;
  task.confirmed = false;
  invalidateTaskSimulation(task);
  const taskLabel = taskList.querySelector(`[data-task-id="${task.id}"] .task-copy strong`);
  if (taskLabel) taskLabel.textContent = task.name;
  confirmConfigButton.classList.remove("is-confirmed");
  confirmConfigButton.textContent = "确认配置";
  refreshReportStatus();
});

analysisMethodTrigger.addEventListener("click", () => setMethodOptionsOpen(methodOptions.hidden));
methodOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-method]");
  if (!option) return;
  const task = currentTask();
  if (!task) return;
  analysisMethod.value = option.dataset.method;
  task.method = option.dataset.method;
  if (task.method !== "alpha Ratio(EC/EO)") task.activeSegment = 1;
  task.confirmed = false;
  resetTaskSimulation(task);
  setMethodOptionsOpen(false);
  renderTasks();
});

document.querySelector("#segment-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-segment]");
  if (!button) return;
  const task = currentTask();
  if (!task) return;
  if (!saveActiveSegment(task)) {
    showToast("请先修正当前分段的分析时间");
    return;
  }
  task.activeSegment = Number(button.dataset.segment);
  renderSegmentInputs(task);
  showToast(`已切换到分段 ${button.dataset.segment}`);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".method-combobox")) setMethodOptionsOpen(false);
});

confirmConfigButton.addEventListener("click", () => {
  const task = currentTask();
  if (!task) return;
  if (task.confirmed) {
    task.confirmed = false;
    resetTaskSimulation(task, "配置已解除确认；请重新确认后开始模拟");
    resetReportBatch("任务确认状态已变更；请重新开始报告批处理");
    renderTasks();
    updateSubjectContext();
    refreshReportStatus();
    showToast("配置已取消，可以重新修改配置");
    return;
  }

  if (!validateTaskInputs() || !saveActiveSegment(task, true)) return;
  task.confirmed = true;
  resetReportBatch("任务配置已确认；可开始报告批处理");
  renderTasks();
  updateSubjectContext();
  refreshReportStatus();
  showToast("任务配置已确认");
});

[windowStartInput, windowDurationInput].forEach((input) => {
  input.addEventListener("input", () => {
    const task = currentTask();
    if (normalizeNumberInput(input, true, true) !== null) {
      saveActiveSegment(task);
      invalidateTaskSimulation(task);
    }
  });
  input.addEventListener("change", () => {
    const task = currentTask();
    normalizeNumberInput(input, true);
    saveActiveSegment(task, true);
    invalidateTaskSimulation(task);
  });
});

bandpassSelect.addEventListener("change", () => {
  const task = currentTask();
  const preset = bandpassPresets[bandpassSelect.value];
  if (!task || !preset) return;
  task.filter.bandpass = bandpassSelect.value;
  task.filter.highpassEnabled = true;
  task.filter.highpass = preset[0];
  task.filter.lowpassEnabled = true;
  task.filter.lowpass = preset[1];
  task.filter.notchEnabled = true;
  invalidateTaskSimulation(task);
  renderFilterInputs(task);
  showToast(`${bandpassSelect.value} 滤波参数已应用`);
});
function renderTemplateList() {
  const list = document.querySelector(".template-list");
  if (!appState.templates.length) {
    list.innerHTML = '<div class="template-empty-state"><img src="assets/file.png" alt=""><strong>未接入持久化模板数据</strong><span>当前会话可新建内存模板，刷新页面后清空</span></div>';
    return;
  }
  list.innerHTML = appState.templates.map((template, index) => `<div class="template-row" data-template-index="${index}"><div><strong>${escapeHtml(template.name)}</strong><span>${template.tasks.length} 个任务 · 当前浏览器会话</span></div><button type="button" data-template-action="apply">套用</button><button type="button" data-template-action="delete">删除</button></div>`).join("");
}

document.querySelector("#load-template").addEventListener("click", () => {
  renderTemplateList();
  openModal("template-load-modal");
});
document.querySelector("#save-template").addEventListener("click", () => {
  if (!appState.tasks.length) {
    showToast("请先新建任务");
    return;
  }
  openModal("template-save-modal");
});
document.querySelector("#template-save-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#template-name").value.trim();
  if (appState.templates.some((template) => template.name.toLowerCase() === name.toLowerCase())) {
    showToast("模板名称已存在，请使用唯一名称");
    return;
  }
  appState.templates.push({ name, tasks: structuredClone(appState.tasks) });
  closeModal(document.querySelector("#template-save-modal"));
  showToast("模板已保存到当前浏览器内存，未写入 PC 模板数据库");
  event.currentTarget.reset();
});
document.querySelector(".template-list").addEventListener("click", (event) => {
  const action = event.target.closest("[data-template-action]");
  if (!action) return;
  const row = action.closest("[data-template-index]");
  const index = Number(row.dataset.templateIndex);
  if (action.dataset.templateAction === "delete") {
    appState.templates.splice(index, 1);
    renderTemplateList();
    showToast("内存模板已删除");
    return;
  }
  clearAllTaskSimulationTimers();
  appState.tasks = structuredClone(appState.templates[index].tasks).map((task, taskIndex) => ({
    ...task,
    id: Date.now() + taskIndex,
    confirmed: false,
    runState: "idle",
    runProgress: 0,
    runDetail: "模板已套用；请确认配置后开始模拟",
    simulationOutcome: "success"
  }));
  appState.selectedTaskId = appState.tasks[0]?.id ?? null;
  closeModal(document.querySelector("#template-load-modal"));
  renderTasks();
  showToast("模板已套用；任务确认状态已重置");
});

const logoFileInput = document.querySelector("#logo-file-input");
document.querySelector("#choose-logo").addEventListener("click", () => logoFileInput.click());
logoFileInput.addEventListener("change", () => {
  const file = logoFileInput.files[0];
  if (!file) return;
  if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 5 * 1048576) {
    showToast("请选择 5 MB 以内的 PNG 或 JPEG 图片");
    logoFileInput.value = "";
    return;
  }
  const url = URL.createObjectURL(file);
  document.querySelector("#logo-setting-preview").src = url;
  document.querySelector("#report-logo-preview").src = url;
  showToast("Logo 只用于当前浏览器预览，未写入 PC 数据库");
});
document.querySelector("#clear-logo").addEventListener("click", () => {
  document.querySelector("#logo-setting-preview").src = "assets/qlanalyser-logo.png";
  document.querySelector("#report-logo-preview").src = "assets/qlanalyser-logo.png";
  logoFileInput.value = "";
  showToast("已恢复默认报告 Logo");
});
document.querySelector("#generate-report").addEventListener("click", () => {
  const confirmedTasks = appState.tasks.filter((task) => task.confirmed);
  if (!confirmedTasks.length) {
    openReportBlocker("没有已配置完成的任务，请先对至少一个任务点击", "「确认配置」");
    return;
  }
  switchPage("report");
  document.querySelector("#report-empty-state").hidden = false;
  document.querySelector("#report-workspace").hidden = true;
  resetReportBatch("已收集确认参数；等待开始报告批处理");
  refreshReportStatus();
});

function resetReportCommentForNewRun() {
  appState.reportCommentDirty = false;
  reportComment.value = "";
  reportComment.disabled = false;
  document.querySelector("#save-report-comment").hidden = false;
  document.querySelector("#report-save-state").textContent = "评论已保存";
  document.querySelector("#report-save-state").classList.remove("is-dirty");
}

function prepareReportPreview() {
  appState.reportPreviewReady = true;
  appState.activeReportSection = "overview";
  document.querySelector("#report-empty-state").hidden = true;
  document.querySelector("#report-workspace").hidden = false;
  document.querySelector("#report-preview-title").textContent = `${currentSubject().id} · QLanalyser QEEG Report`;
  pdfSimulationPanel.hidden = true;
  resetPdfSimulation();
  renderReportOutline();
  renderReportSection("overview");
  showToast("报告批处理模拟完成；已重建确定性报告 fixture，未执行算法");
}

document.querySelector("#build-report-preview").addEventListener("click", startReportBatch);
startReportBatchButton.addEventListener("click", startReportBatch);
cancelReportBatchButton.addEventListener("click", cancelReportBatch);
reportBatchScenario.addEventListener("change", () => { appState.reportBatchScenario = reportBatchScenario.value; });

document.querySelector(".report-outline").addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-section]");
  if (!button) return;
  renderReportSection(button.dataset.reportSection);
});
reportComment.addEventListener("input", () => {
  appState.reportCommentDirty = true;
  document.querySelector("#report-save-state").textContent = "评论未保存";
  document.querySelector("#report-save-state").classList.add("is-dirty");
});
document.querySelector("#save-report-comment").addEventListener("click", () => {
  appState.reportCommentDirty = false;
  document.querySelector("#report-save-state").textContent = "评论已保存（当前会话）";
  document.querySelector("#report-save-state").classList.remove("is-dirty");
  showToast("评论保存在当前浏览器内存，未写入 PC HistoryTask");
});
function openPdfState() {
  const subjectId = currentSubject()?.id ?? "NO-SUBJECT";
  document.querySelector("#pdf-simulated-path").value = `SIMULATED://${subjectId}/QLanalyser-QEEG-${localDateStamp()}.pdf`;
  pdfSimulationPanel.hidden = false;
  renderPdfSimulation();
  showToast("PDF 打印成功回调未接入；未生成文件");
}
document.querySelector("#print-report").addEventListener("click", () => {
  if (appState.reportCommentDirty) return openModal("report-pdf-modal");
  openPdfState();
});
document.querySelector("#confirm-report-pdf").addEventListener("click", () => {
  appState.reportCommentDirty = false;
  reportComment.value = "";
  reportComment.disabled = true;
  document.querySelector("#save-report-comment").hidden = true;
  document.querySelector("#report-save-state").textContent = "评论已丢弃（当前导出）";
  document.querySelector("#report-save-state").classList.remove("is-dirty");
  closeModal(document.querySelector("#report-pdf-modal"));
  openPdfState();
});
pdfSimulationOutcome.addEventListener("change", () => { appState.pdfSimulationOutcome = pdfSimulationOutcome.value; });
startPdfSimulationButton.addEventListener("click", startPdfSimulation);
cancelPdfSimulationButton.addEventListener("click", cancelPdfSimulation);
document.querySelector("#open-report-history").addEventListener("click", () => openModal("report-history-modal"));

filterCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => {
  const valueInput = checkbox.closest(".filter-control").querySelector("input[type='number']");
  valueInput.disabled = !checkbox.checked;
  checkbox.closest(".filter-control").classList.toggle("is-off", !checkbox.checked);
  const task = currentTask();
  if (!task) return;
  if (checkbox === highpassEnabled) task.filter.highpassEnabled = checkbox.checked;
  if (checkbox === lowpassEnabled) task.filter.lowpassEnabled = checkbox.checked;
  if (checkbox === notchEnabled) task.filter.notchEnabled = checkbox.checked;
  invalidateTaskSimulation(task);
}));

[[highpassValue, "highpass"], [lowpassValue, "lowpass"], [notchValue, "notch"]].forEach(([input, key]) => {
  input.addEventListener("input", () => {
    const task = currentTask();
    if (!task || input.value === "") return;
    const value = Number(input.value);
    const minimum = Number(input.min);
    const maximum = Number(input.max);
    if (Number.isFinite(value) && value >= minimum && value <= maximum) {
      task.filter[key] = value;
      invalidateTaskSimulation(task);
    }
  });
  const commitValue = () => {
    const task = currentTask();
    const value = normalizeNumberInput(input);
    if (task) {
      task.filter[key] = value;
      invalidateTaskSimulation(task);
    }
  };
  input.addEventListener("change", commitValue);
  input.addEventListener("blur", commitValue);
});

[[xAxisScale, "xAxisScale"], [yAxisScale, "yAxisScale"]].forEach(([select, key]) => {
  select.addEventListener("change", () => {
    const task = currentTask();
    if (!task) return;
    task.plot[key] = select.value;
    invalidateTaskSimulation(task);
    if (select === xAxisScale) renderWaveformTimeRuler(select.value);
  });
});

renderSubjects();
updateSubjectContext();
renderTasks();
resetReportBatch();
