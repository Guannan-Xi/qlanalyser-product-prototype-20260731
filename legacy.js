const lifecycleModuleKinds = ["ecg", "emg", "sleep", "epilepsy-threshold", "epilepsy-ml"];

function createLifecycleModuleState() {
  return {
    phase: "idle",
    outcome: "success",
    timerId: null,
    runToken: 0,
    page: 1,
    classificationByEpoch: new Map(),
    undoStack: [],
    redoStack: [],
    selectedEpoch: 1,
    selectedEpochs: new Set(),
    epochAnchor: 1,
    thresholdFactor: 2.0,
    epochLength: null,
  };
}

const moduleStates = Object.fromEntries(lifecycleModuleKinds.map((kind) => [kind, createLifecycleModuleState()]));

const legacyState = {
  file: null,
  fileType: null,
  dataProfile: "research-4eeg-acc",
  samplingRate: 500,
  durationSeconds: 7200,
  processing: { filter: "None", crop: "None", rejection: "None" },
  currentModule: null,
  epochPage: 1,
  selectedEpoch: 1,
  rejectedEpochs: new Set(),
  selectedEpochs: new Set(),
  classificationByEpoch: new Map(),
  pendingMessageAction: null,
  closeWithoutAsk: new Set(),
  rejectionUndoStack: [],
  rejectionRedoStack: [],
  correctionUndoStack: [],
  correctionRedoStack: [],
  selectedSignalChannels: { ecg: "", emg: "" },
  specialPages: { ecg: 1, emg: 1 },
  analysisPhases: { sleep: "idle", "epilepsy-threshold": "idle", "epilepsy-ml": "idle" },
  moduleStates,
  activeAnalysisModules: new Set(),
  epochAnchor: 1,
  pendingDroppedFile: null,
  exportReturn: null,
  exportContext: null,
  lastSimulatedExport: null,
  dataSelectDraft: null,
  hrvState: { phase: "idle", outcome: "success", backendScenario: "cuda-cpp-success", failureKind: null, timerId: null, runToken: 0 },
  startupEvidence: { duplicateInstance: null },
  lastImportEvidence: null,
};

const moduleBackdrop = document.querySelector("#module-backdrop");
const moduleWindow = document.querySelector("#module-window");
const moduleBody = document.querySelector("#module-body");
const moduleTitle = document.querySelector("#module-title");
const moduleSubtitle = document.querySelector("#module-subtitle");
const messageBackdrop = document.querySelector("#message-backdrop");
const toast = document.querySelector("#legacy-toast");
const fileInput = document.querySelector("#edf-file-input");
const folderInput = document.querySelector("#conversion-folder-input");
const rememberedDirectoryStorageKey = "qlanalyser.prototype.QUANLAN.AR_analyser.lastOpenedPath";

function readRememberedDirectory() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(rememberedDirectoryStorageKey));
    return stored?.provider === "browser-local fixture" && /^SIMULATED:\/\//.test(stored?.value || "") ? stored : null;
  } catch {
    return null;
  }
}

function rememberFixtureDirectory() {
  const evidence = {
    organization: "QUANLAN",
    application: "AR_analyser",
    key: "lastOpenedPath",
    value: "SIMULATED://Research/EEG",
    provider: "browser-local fixture",
    realPathRead: false,
    nativePickerControlled: false,
  };
  try {
    window.localStorage.setItem(rememberedDirectoryStorageKey, JSON.stringify(evidence));
  } catch {
    return { ...evidence, persisted: false };
  }
  return { ...evidence, persisted: true };
}

function lifecycleState(kind) {
  return legacyState.moduleStates[kind] || null;
}

function activateLifecycleState(kind) {
  const state = lifecycleState(kind);
  if (!state) return null;
  legacyState.classificationByEpoch = state.classificationByEpoch;
  legacyState.correctionUndoStack = state.undoStack;
  legacyState.correctionRedoStack = state.redoStack;
  legacyState.selectedEpoch = state.selectedEpoch;
  legacyState.selectedEpochs = state.selectedEpochs;
  legacyState.epochAnchor = state.epochAnchor;
  legacyState.analysisPhases[kind] = state.phase;
  if (["ecg", "emg"].includes(kind)) legacyState.specialPages[kind] = state.page;
  return state;
}

function clearAnalysisTimer(kind) {
  const state = lifecycleState(kind);
  if (!state) return;
  if (state.timerId !== null) window.clearTimeout(state.timerId);
  state.timerId = null;
}

function resetAnalysisModule(kind) {
  const state = lifecycleState(kind);
  if (!state) return;
  clearAnalysisTimer(kind);
  state.runToken += 1;
  state.phase = "idle";
  state.outcome = "success";
  state.page = 1;
  state.classificationByEpoch.clear();
  state.undoStack.length = 0;
  state.redoStack.length = 0;
  state.selectedEpoch = 1;
  state.selectedEpochs.clear();
  state.epochAnchor = 1;
  state.thresholdFactor = 2.0;
  state.epochLength = null;
  legacyState.analysisPhases[kind] = "idle";
  if (["ecg", "emg"].includes(kind)) legacyState.specialPages[kind] = 1;
  if (legacyState.currentModule === kind) activateLifecycleState(kind);
}

function resetAllFileScopedState() {
  lifecycleModuleKinds.forEach(resetAnalysisModule);
  resetHrvState();
  legacyState.activeAnalysisModules.clear();
  legacyState.selectedSignalChannels.ecg = "";
  legacyState.selectedSignalChannels.emg = "";
  legacyState.specialPages.ecg = 1;
  legacyState.specialPages.emg = 1;
  legacyState.epochPage = 1;
  legacyState.selectedEpoch = 1;
  legacyState.epochAnchor = 1;
  legacyState.rejectedEpochs.clear();
  legacyState.selectedEpochs = new Set();
  legacyState.classificationByEpoch = new Map();
  legacyState.rejectionUndoStack.length = 0;
  legacyState.rejectionRedoStack.length = 0;
  legacyState.correctionUndoStack = [];
  legacyState.correctionRedoStack = [];
  legacyState.processing = { filter: "None", crop: "None", rejection: "None" };
  legacyState.exportReturn = null;
  legacyState.exportContext = null;
  legacyState.lastSimulatedExport = null;
  legacyState.dataSelectDraft = null;
}

function renderLifecycleModule(kind) {
  const state = lifecycleState(kind);
  if (!state) return;
  if (["ecg", "emg"].includes(kind)) return openSignalWorkbench(kind, state.phase);
  if (kind === "sleep") return openSleepWorkbench(state.phase);
  return openEpilepsyWorkbench(kind, state.phase);
}

function startAnalysisTask(kind) {
  const state = activateLifecycleState(kind);
  if (!state) return;
  state.outcome = document.querySelector("#analysis-outcome")?.value || state.outcome || "success";
  clearAnalysisTimer(kind);
  state.runToken += 1;
  const token = state.runToken;
  state.phase = "progress";
  legacyState.analysisPhases[kind] = state.phase;
  renderLifecycleModule(kind);
  state.timerId = window.setTimeout(() => {
    if (state.runToken !== token || state.phase !== "progress") return;
    state.timerId = null;
    state.phase = state.outcome === "failure" ? "failure" : "result";
    legacyState.analysisPhases[kind] = state.phase;
    if (legacyState.currentModule === kind && !moduleBackdrop.hidden) renderLifecycleModule(kind);
  }, 550);
}

function cancelAnalysisTask(kind) {
  const state = activateLifecycleState(kind);
  if (!state) return;
  clearAnalysisTimer(kind);
  state.runToken += 1;
  state.phase = "idle";
  legacyState.analysisPhases[kind] = state.phase;
  if (legacyState.currentModule === kind) renderLifecycleModule(kind);
}

function clearHrvTimer() {
  if (legacyState.hrvState.timerId !== null) window.clearTimeout(legacyState.hrvState.timerId);
  legacyState.hrvState.timerId = null;
}

function resetHrvState() {
  clearHrvTimer();
  legacyState.hrvState.runToken += 1;
  legacyState.hrvState.phase = "idle";
  legacyState.hrvState.outcome = "success";
  legacyState.hrvState.backendScenario = "cuda-cpp-success";
  legacyState.hrvState.failureKind = null;
}

function startHrvTask(requestedOutcome = null) {
  const state = legacyState.hrvState;
  state.outcome = requestedOutcome || document.querySelector("#hrv-outcome")?.value || state.outcome || "success";
  clearHrvTimer();
  state.runToken += 1;
  const token = state.runToken;
  state.phase = "progress";
  state.failureKind = null;
  openHrvWorkbench("progress");
  state.timerId = window.setTimeout(() => {
    if (state.runToken !== token || state.phase !== "progress") return;
    state.timerId = null;
    if (state.outcome === "success") {
      state.phase = "result";
      state.failureKind = null;
    } else {
      state.phase = "failure";
      state.failureKind = state.outcome === "memory-failure" ? "memory" : "resource";
    }
    if (legacyState.currentModule === "ecg-hrv" && !moduleBackdrop.hidden) openHrvWorkbench(state.phase);
  }, 650);
}

const moduleNames = {
  filter: ["Filter", "Preprocess"],
  "preview-rejection": ["Preview and Rejection", "Preprocess"],
  "data-select": ["Data Select", "Preprocess"],
  "cropped-edf-export": ["Save EDF File", "Independent V1 export flow"],
  bandpower: ["Band Power", "Basical analysis"],
  psd: ["PSD", "Basical analysis"],
  "time-frequency": ["Time-Frequency", "Basical analysis"],
  activity: ["Activity / RMS", "Basical analysis"],
  emg: ["EMG Analysis", "Signal analysis"],
  ecg: ["ECG Analysis", "Signal analysis"],
  sleep: ["Sleep Analysis", "Preview and correction"],
  "epilepsy-threshold": ["Epilepsy", "Threshold analysis · preview and correction"],
  "epilepsy-ml": ["Epilepsy", "ML analysis · preview and correction"],
};

const channels = ["Fp1", "Fp2", "F3", "F4", "C3", "C4", "P3", "P4", "O1", "O2", "F7", "F8", "T3", "T4", "T5", "T6", "Fz", "Cz", "Pz"];

const dataProfiles = {
  "research-4eeg-acc": { label: "4 EEG + 3 ACC · daytime fixture", channels: ["EEG1", "EEG2", "EEG3", "EEG4", "ACC X", "ACC Y", "ACC Z"], branch: "general", samplingRate: 500, durationSeconds: 7200, recordingStart: "2026-07-29T09:00:00" },
  "sleep-overnight": { label: "2 EEG + EMG + 3 ACC · overnight fixture", channels: ["EEG1", "EEG2", "EMG", "ACC X", "ACC Y", "ACC Z"], branch: "general", samplingRate: 256, durationSeconds: 36000, recordingStart: "2026-07-29T22:00:00" },
  "qeeg-23": { label: "23 EEG · QEEG fixture", channels: [...channels, "A1", "A2", "T1", "T2"], branch: "qeeg", samplingRate: 500, durationSeconds: 1800, recordingStart: "2026-07-29T09:00:00" },
  unsupported: { label: "Unsupported channel layout", channels: ["Signal 1", "Signal 2"], branch: "unsupported", samplingRate: 250, durationSeconds: 600, recordingStart: "2026-07-29T09:00:00" },
};

function activeProfile() {
  return dataProfiles[legacyState.dataProfile];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function fixtureBadge(label = "SIMULATED DATA · NOT PATIENT DATA") {
  return `<span class="fixture-badge">${escapeHtml(label)}</span>`;
}

function waveformPath(seed, baseline, amplitude, points = 180) {
  const width = 900;
  return Array.from({ length: points }, (_, index) => {
    const x = (index / (points - 1)) * width;
    const slow = Math.sin((index + seed * 7) * 0.19) * amplitude;
    const fast = Math.sin((index + seed * 13) * 0.71) * amplitude * 0.28;
    const drift = Math.cos((index + seed) * 0.047) * amplitude * 0.18;
    const y = baseline + slow + fast + drift;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function simulatedSignalSvg(kind = "eeg", labels = ["EEG1", "EEG2", "EMG", "ACC"], variant = 0) {
  const palette = ["#62d7ff", "#8de1a8", "#ffd46a", "#ff9b91"];
  const traces = labels.map((label, index) => {
    const baseline = 46 + index * 52;
    const amplitude = /ECG/i.test(kind) ? 10 : /EMG/i.test(label) ? 13 : 8;
    const path = /ECG/i.test(kind)
      ? Array.from({ length: 180 }, (_, point) => {
          const x = (point / 179) * 900;
          const phase = (point + variant * 7) % 30;
          const spike = phase === 14 ? -30 - variant * 2 : phase === 15 ? 18 + variant * 2 : phase === 16 ? -8 : Math.sin((point + variant * 11) * 0.35) * (2 + variant * 0.4);
          return `${point ? "L" : "M"}${x.toFixed(1)},${(baseline + spike).toFixed(1)}`;
        }).join(" ")
      : waveformPath(index + 1 + variant * 3, baseline, amplitude);
    return `<text x="8" y="${baseline - 14}" fill="#9fb4c6" font-size="11">${escapeHtml(label)}</text><path d="${path}" fill="none" stroke="${palette[index % palette.length]}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  }).join("");
  return `<svg class="fixture-chart" viewBox="0 0 900 250" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(kind)} simulated waveform"><g class="fixture-grid"><path d="M0 50H900 M0 100H900 M0 150H900 M0 200H900 M180 0V250 M360 0V250 M540 0V250 M720 0V250"/></g>${traces}</svg>`;
}

function simulatedSignalCanvas(kind, light = false, labels = ["EEG1", "EEG2", "EMG", "ACC"]) {
  return `<div class="signal-canvas${light ? " light" : ""} fixture-surface" data-fixture="${escapeHtml(kind)}">${fixtureBadge()}${simulatedSignalSvg(kind, labels)}<div class="fixture-caption">Deterministic fixture for interaction review. No EDF/BDF samples or analysis worker are used.</div></div>`;
}

function simulatedPlotSvg(title, plotKind = null) {
  const normalized = title.toLowerCase();
  if (plotKind === "binary-stage") {
    return `<svg viewBox="0 0 900 190" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(title)} simulated Normal Seizure classifications"><path d="M20 145H130V35H245V145H470V35H590V145H880" fill="none" stroke="#2f86c7" stroke-width="3"/><text x="4" y="39" font-size="10" fill="#64717d">Seizure</text><text x="4" y="149" font-size="10" fill="#64717d">Normal</text></svg>`;
  }
  if (/(spectrogram|time-frequency|map)/.test(normalized)) {
    const cells = Array.from({ length: 96 }, (_, index) => {
      const x = (index % 16) * 56.25;
      const y = Math.floor(index / 16) * 32;
      const hue = 205 - ((index * 17) % 120);
      const lightness = 36 + ((index * 11) % 36);
      return `<rect x="${x}" y="${y}" width="57" height="33" fill="hsl(${hue} 72% ${lightness}%)"/>`;
    }).join("");
    return `<svg viewBox="0 0 900 192" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(title)} simulated heatmap">${cells}</svg>`;
  }
  if (/(power|ratio|frequency domain|total)/.test(normalized)) {
    const bars = [58, 96, 132, 84, 116, 66, 104].map((height, index) => `<rect x="${75 + index * 112}" y="${170 - height}" width="58" height="${height}" rx="2" fill="${["#3b82c4", "#56a574", "#d2a33d", "#8b79bd"][index % 4]}"/><text x="${104 + index * 112}" y="186" text-anchor="middle" font-size="10" fill="#64717d">${["Delta", "Theta", "Alpha", "Beta", "Gamma", "Other", "Total"][index]}</text>`).join("");
    return `<svg viewBox="0 0 900 200" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(title)} simulated bars"><path d="M48 15V170H880" fill="none" stroke="#cbd3da"/>${bars}</svg>`;
  }
  if (/(hypnogram|stage)/.test(normalized)) {
    return `<svg viewBox="0 0 900 190" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(title)} simulated stages"><path d="M20 35H130V92H245V145H350V92H470V35H590V145H710V92H880" fill="none" stroke="#2f86c7" stroke-width="3"/><text x="4" y="39" font-size="10" fill="#64717d">Wake</text><text x="4" y="96" font-size="10" fill="#64717d">NREM</text><text x="4" y="149" font-size="10" fill="#64717d">REM</text></svg>`;
  }
  return `<svg viewBox="0 0 900 190" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(title)} simulated trace"><path d="${waveformPath(title.length % 7 + 1, 94, 34)}" fill="none" stroke="#2685c5" stroke-width="2"/><path d="M0 95H900" stroke="#dbe1e6" stroke-dasharray="4 5"/></svg>`;
}

function simulatedPoincareSvg() {
  const points = [[112,142],[124,134],[138,126],[150,117],[164,111],[178,101],[190,94],[204,88],[218,79],[232,72],[246,67],[259,58],[274,52],[288,45],[302,38],[316,33],[330,27],[344,22],[132,148],[158,128],[184,109],[211,96],[238,77],[268,62],[296,49],[324,36]];
  const dots = points.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index % 5 === 0 ? 3.2 : 2.4}" fill="#2f86c7" fill-opacity="${index % 3 === 0 ? ".82" : ".58"}"/>`).join("");
  return `<svg viewBox="0 0 420 190" role="img" aria-label="Deterministic non-patient Poincare plot with RR(n) and RR(n+1) millisecond axes"><path d="M48 15V154H400M48 126H400M48 98H400M48 70H400M48 42H400M118 15V154M188 15V154M258 15V154M328 15V154" fill="none" stroke="#e2e7eb"/><path d="M48 154H400M48 15V154" fill="none" stroke="#88949e"/>${dots}<text x="224" y="184" text-anchor="middle" font-size="10" fill="#5f6c77">RR(n) (ms)</text><text x="13" y="86" text-anchor="middle" font-size="10" fill="#5f6c77" transform="rotate(-90 13 86)">RR(n+1) (ms)</text></svg>`;
}

function simulatedRrDistributionSvg() {
  const heights = [12, 20, 31, 48, 72, 96, 121, 137, 126, 102, 78, 56, 38, 25, 16, 9];
  const bars = heights.map((height, index) => `<rect x="${66 + index * 19}" y="${154 - height}" width="15" height="${height}" fill="#5aa6d6" fill-opacity=".8"/>`).join("");
  return `<svg viewBox="0 0 420 190" role="img" aria-label="Deterministic non-patient RR interval distribution histogram"><path d="M48 15V154H400M48 126H400M48 98H400M48 70H400M48 42H400" fill="none" stroke="#e2e7eb"/><path d="M48 154H400M48 15V154" fill="none" stroke="#88949e"/>${bars}<path d="M218 30V154" stroke="#29875b" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M227 38V154" stroke="#4e5963" stroke-width="1.5" stroke-dasharray="4 3"/><text x="48" y="168" text-anchor="middle" font-size="9" fill="#6a7680">40</text><text x="118" y="168" text-anchor="middle" font-size="9" fill="#6a7680">60</text><text x="188" y="168" text-anchor="middle" font-size="9" fill="#6a7680">80</text><text x="258" y="168" text-anchor="middle" font-size="9" fill="#6a7680">100</text><text x="328" y="168" text-anchor="middle" font-size="9" fill="#6a7680">120</text><text x="398" y="168" text-anchor="middle" font-size="9" fill="#6a7680">140</text><text x="224" y="187" text-anchor="middle" font-size="10" fill="#5f6c77">RR Interval (ms)</text><text x="13" y="86" text-anchor="middle" font-size="10" fill="#5f6c77" transform="rotate(-90 13 86)">Frequency</text><text x="292" y="28" font-size="9" fill="#29875b">Mean (fixture)</text><text x="292" y="40" font-size="9" fill="#4e5963">Median (fixture)</text></svg>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 2400);
}

function closeMenus() {
  document.querySelectorAll(".menu-popup").forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll(".menu-trigger").forEach((button) => button.setAttribute("aria-expanded", "false"));
}

function setStatus(message) {
  document.querySelector("#status-message").textContent = message;
}

function updateFileState() {
  const hasFile = Boolean(legacyState.file);
  const profile = activeProfile();
  document.querySelector("#welcome-view").hidden = hasFile;
  document.querySelector("#file-view").hidden = !hasFile;
  document.querySelectorAll("[data-needs-file]").forEach((control) => { control.disabled = !hasFile; });
  document.querySelectorAll('[data-action="filter"], [data-action="preview-rejection"], [data-action="data-select"], [data-action="bandpower"], [data-action="psd"], [data-action="time-frequency"], [data-action="activity"], [data-action="emg"], [data-action="ecg"], [data-action="sleep"], [data-action="epilepsy-threshold"], [data-action="epilepsy-ml"]').forEach((control) => {
    control.disabled = !hasFile || profile.branch !== "general";
  });
  document.querySelectorAll('[data-action="qeeg"]').forEach((control) => {
    control.disabled = !hasFile || profile.branch !== "qeeg";
  });
  document.querySelector('.menu-trigger[data-menu="preprocess"]').disabled = !hasFile || profile.branch !== "general";
  document.querySelector('.menu-trigger[data-menu="analysis"]').disabled = !hasFile || profile.branch === "unsupported";
  document.querySelector('[data-action="save-data"]').disabled = !hasFile || profile.branch === "qeeg";
  document.querySelector("#window-file").textContent = hasFile ? legacyState.file.name : "No file loaded";
  if (hasFile) {
    legacyState.samplingRate = profile.samplingRate;
    legacyState.durationSeconds = profile.durationSeconds;
    document.querySelector("#loaded-file-name").textContent = legacyState.file.name;
    const samples = legacyState.samplingRate * legacyState.durationSeconds;
    document.querySelector("#loaded-data-shape").textContent = `${profile.channels.length} x ${samples.toLocaleString()}`;
    const hours = String(Math.floor(profile.durationSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((profile.durationSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(profile.durationSeconds % 60).padStart(2, "0");
    document.querySelector("#loaded-duration").textContent = `${hours}:${minutes}:${seconds}`;
    document.querySelector("#loaded-data-size").textContent = `${Math.max(1, Math.round((legacyState.file.size || 52428800) / 1048576))} MB`;
    document.querySelector("#loaded-channel-count").textContent = String(profile.channels.length);
    document.querySelector("#loaded-channel-names").textContent = profile.channels.join(", ");
    document.querySelector("#loaded-sampling-rate").textContent = `${legacyState.samplingRate} Hz`;
    document.querySelector("#loaded-recording-start").textContent = `${profile.recordingStart.replace("T", " ")} (simulated fixture)`;
    document.querySelector("#history-filter").textContent = legacyState.processing.filter;
    document.querySelector("#history-crop").textContent = legacyState.processing.crop;
    document.querySelector("#history-rejection").textContent = legacyState.processing.rejection;
    setStatus(`Loaded: ${legacyState.file.name} · ${profile.label} · ${legacyState.fileType}`);
  } else {
    setStatus("Ready");
  }
}

function showMessage({ title = "Notice", text, kind = "info", choices = [{ id: "ok", label: "OK", primary: true }], onChoice = null }) {
  document.querySelector("#message-title").textContent = title;
  document.querySelector("#message-text").textContent = text;
  const icon = document.querySelector("#message-icon");
  icon.textContent = kind === "danger" ? "!" : kind === "warning" ? "!" : "i";
  icon.className = `message-icon${kind === "danger" ? " is-danger" : kind === "warning" ? " is-warning" : ""}`;
  const actions = document.querySelector("#message-actions");
  actions.replaceChildren(...choices.map((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `command${choice.primary ? " primary" : ""}`;
    button.dataset.messageChoice = choice.id;
    button.textContent = choice.label;
    return button;
  }));
  legacyState.pendingMessageAction = onChoice;
  messageBackdrop.hidden = false;
  document.querySelector(".message-window").focus();
}

function closeMessage(choice = "ok") {
  messageBackdrop.hidden = true;
  const callback = legacyState.pendingMessageAction;
  legacyState.pendingMessageAction = null;
  if (callback) callback(choice);
}

function openModule(name, html, size = "") {
  legacyState.currentModule = name;
  const [title, subtitle] = moduleNames[name] ?? [name, "QLanalyser PC"];
  moduleTitle.textContent = title;
  moduleSubtitle.textContent = subtitle;
  moduleBody.innerHTML = html;
  moduleWindow.className = `module-window${size ? ` is-${size}` : ""}`;
  moduleBackdrop.hidden = false;
  if (["bandpower", "psd", "time-frequency", "activity", "emg", "ecg", "sleep", "epilepsy-threshold", "epilepsy-ml"].includes(name)) legacyState.activeAnalysisModules.add(name);
  moduleWindow.focus();
}

function closeModule() {
  const closedModule = legacyState.currentModule;
  moduleBackdrop.hidden = true;
  moduleBody.replaceChildren();
  legacyState.currentModule = null;
  if (closedModule) legacyState.activeAnalysisModules.delete(closedModule);
}

function requestCloseModule() {
  const guarded = ["bandpower", "psd", "time-frequency", "activity", "emg", "ecg", "sleep", "epilepsy-threshold", "epilepsy-ml"];
  const module = legacyState.currentModule;
  if (module === "ecg-hrv") {
    resetHrvState();
    return openSignalWorkbench("ecg", "result");
  }
  if (!guarded.includes(module)) return closeModule();
  if (legacyState.closeWithoutAsk.has(module)) {
    resetAnalysisModule(module);
    return closeModule();
  }
  showMessage({
    title: "Close analysis",
    text: "Closing this window will restart the analysis the next time it is opened.",
    kind: "warning",
    choices: [{ id: "cancel", label: "Cancel", primary: true }, { id: "dont-ask", label: "Close and don't ask again" }, { id: "close", label: "Close" }],
    onChoice: (choice) => {
      if (choice === "dont-ask") legacyState.closeWithoutAsk.add(module);
      if (choice === "close" || choice === "dont-ask") {
        resetAnalysisModule(module);
        closeModule();
      }
    },
  });
}

function timeRangeIsValid() {
  const start = document.querySelector("#analysis-start-time")?.value;
  const end = document.querySelector("#analysis-end-time")?.value;
  if (!start || !end || start >= end) {
    showMessage({ title: "Time Range Error", text: "The end time needs to be later than the start time.", kind: "warning" });
    return false;
  }
  return true;
}

function frequencyBandsAreValid() {
  const lows = [...document.querySelectorAll('input[name="band-low"]')];
  const highs = [...document.querySelectorAll('input[name="band-high"]')];
  const ranges = lows.map((input, index) => ({ name: input.dataset.band, low: Number(input.value), high: Number(highs[index]?.value) }));
  if (ranges.some((range) => !Number.isFinite(range.low) || !Number.isFinite(range.high) || range.low < 0 || range.low >= range.high)) {
    showMessage({ title: "Frequency Error", text: "Each selected frequency band requires a non-negative low value below its high value.", kind: "warning" });
    return false;
  }
  const named = ranges.filter((range) => range.name !== "Other").sort((a, b) => a.low - b.low);
  if (named.some((range, index) => index > 0 && range.low < named[index - 1].high)) {
    showMessage({ title: "Frequency band overlap", text: "Named frequency bands cannot overlap. Other remains an independent custom range.", kind: "warning" });
    return false;
  }
  return true;
}

function renderFilterType() {
  const type = document.querySelector("#filter-type")?.value;
  const low = document.querySelector("#filter-low");
  const high = document.querySelector("#filter-high");
  const lowLabel = document.querySelector("#filter-low-label");
  const highLabel = document.querySelector("#filter-high-label");
  if (!type || !low || !high || !lowLabel || !highLabel) return;
  lowLabel.hidden = type === "Lowpass";
  highLabel.hidden = type === "Highpass";
  if (type === "Bandpass") { low.value = "1"; high.value = "30"; }
  if (type === "Notch") { low.value = "48"; high.value = "52"; }
  if (type === "Highpass") low.value = "1";
  if (type === "Lowpass") high.value = "30";
}

function requireFile(action) {
  if (legacyState.file) return true;
  showMessage({ title: "Error", text: "Please load data file first.", kind: "warning" });
  setStatus(`Blocked ${action}: no data file`);
  return false;
}

function renderWizard(title, subtitle, content, nextLabel = "Next →", nextAction = "wizard-next") {
  return `<div class="wizard">
    <div class="wizard-heading"><h2>${escapeHtml(title)}</h2><span>${escapeHtml(subtitle)}</span></div>
    <div class="wizard-content">${content}</div>
    <div class="wizard-actions"><button class="command" type="button" data-dialog-action="cancel">× Cancel</button><button class="command primary" type="button" data-dialog-action="${nextAction}">${escapeHtml(nextLabel)}</button></div>
  </div>`;
}

function openImportWizard() {
  if (legacyState.file) {
    showMessage({ title: "Notice", text: "Opening a new file will close all currently running analysis windows. Continue?", kind: "warning", choices: [{ id: "cancel", label: "Cancel", primary: true }, { id: "open", label: "Open" }], onChoice: (choice) => { if (choice === "open") renderImportWizard(); } });
    return;
  }
  renderImportWizard();
}

function renderImportWizard() {
  const profileOptions = Object.entries(dataProfiles).map(([value, profile]) => `<option value="${value}" ${value === legacyState.dataProfile ? "selected" : ""}>${profile.label}</option>`).join("");
  const remembered = readRememberedDirectory();
  const rememberedValue = remembered?.value || "Not set";
  const content = `<div class="wizard-card"><label for="import-path">Please choose the .edf file:</label><div class="path-row"><input id="import-path" type="text" readonly placeholder="No file selected"><button type="button" data-dialog-action="browse-edf" title="Browse">...</button></div><section class="directory-contract" data-directory-contract><strong>Remembered directory</strong><dl><div><dt>PC setting</dt><dd><code>QSettings(\"QUANLAN\", \"AR_analyser\") / lastOpenedPath</code></dd></div><div><dt>Browser fixture</dt><dd data-remembered-directory>${escapeHtml(rememberedValue)}</dd></div></dl><p>The PC supplies the saved directory to its file dialog and updates it after a successful selection. This browser stores only a <code>SIMULATED://</code> marker; it does not read a real local path and does not control the native file picker.</p></section><label for="import-profile">Simulated metadata scenario</label><select id="import-profile">${profileOptions}</select><label for="import-outcome">Simulated import outcome</label><select id="import-outcome"><option value="success">Successful header read</option><option value="read-error">Unreadable / damaged file</option><option value="high-sampling">Sampling rate above 1000 Hz</option></select><p class="boundary-note"><strong>Web prototype boundary</strong><span>The browser verifies extension and file size. The selected scenario supplies deterministic mock metadata or an explicit failure state; no samples, headers or annotations are read.</span></p></div>`;
  openModule("Data Import", renderWizard("Data Import", "Import .edf file", content), "compact");
  const pending = legacyState.pendingDroppedFile;
  const path = document.querySelector("#import-path");
  if (pending && path) path.value = pending.name;
}

function openConversionWizard() {
  const content = `<div class="wizard-card"><label for="conversion-path">Please choose the folder containing .eeg/ .acc/ .tri file:</label><div class="path-row"><input id="conversion-path" type="text" readonly placeholder="No folder selected"><button type="button" data-dialog-action="browse-folder">...</button></div><p class="boundary-note"><strong>Prototype boundary</strong><span>No source file is converted and no output is written.</span></p></div>`;
  openModule("Format Conversion", renderWizard("Format Conversion", "Convert .eeg/ .acc/ .tri file to .edf file", content, "Next →", "conversion-next"), "compact");
}

function channelCheckboxes(limit = channels.length) {
  return channels.slice(0, limit).map((channel, index) => `<label><input type="checkbox" ${index < Math.min(4, limit) ? "checked" : ""}>${channel}</label>`).join("");
}

function emptySignalCanvas(light = false, message = "No real signal is loaded into the HTML prototype") {
  return `<div class="signal-canvas${light ? " light" : ""}"><div class="signal-empty"><div><img src="assets/file.png" alt=""><strong>Signal preview boundary</strong><span>${escapeHtml(message)}</span></div></div></div>`;
}

function openFilter() {
  const activeChannels = activeProfile().channels;
  const signalOptions = activeChannels.map((channel) => `<label><input name="filter-channel" type="checkbox" checked>${escapeHtml(channel)}</label>`).join("");
  const html = `<div class="wizard"><div class="wizard-heading"><h2>Filter</h2><span>Butterworth filter</span></div><div class="wizard-content"><div class="filter-contract">
    <label>Type<select id="filter-type"><option>Highpass</option><option>Lowpass</option><option selected>Bandpass</option><option>Notch</option></select></label>
    <label>Model<select id="filter-model"><option selected>Butterworth</option></select></label>
    <label id="filter-low-label">Low frequency (Hz)<input id="filter-low" type="number" min="0.001" max="250" step="0.1" value="1"></label>
    <label id="filter-high-label">High frequency (Hz)<input id="filter-high" type="number" min="0.001" max="30000" step="0.001" value="30"></label>
    <label>Order<input id="filter-order" type="number" min="0" max="30" step="1" value="4"></label>
    <fieldset class="config-fieldset wide"><legend>Signals</legend><label class="check-all"><input id="filter-all" type="checkbox" checked>ALL</label><div class="channel-list">${signalOptions}</div></fieldset>
    <p class="boundary-note wide"><strong>Apply boundary</strong><span>Validation follows the PC control contract. No signal array is modified in this HTML prototype.</span></p>
  </div></div><div class="wizard-actions"><button class="command" type="button" data-dialog-action="cancel">Cancel</button><button class="command" type="button" data-dialog-action="filter-back">Back</button><button class="command primary" type="button" data-dialog-action="filter-apply">OK</button></div></div>`;
  openModule("filter", html, "medium");
}

function epochButtons(mode) {
  return Array.from({ length: 100 }, (_, index) => {
    const epoch = (legacyState.epochPage - 1) * 100 + index + 1;
    if (epoch > 1440) return "";
    const rejected = legacyState.rejectedEpochs.has(epoch);
    const selected = legacyState.selectedEpochs.has(epoch);
    return `<button type="button" data-epoch="${epoch}" title="Epoch ${epoch}: ${rejected ? "Reject" : "Remain"}" class="${epoch === legacyState.selectedEpoch ? "is-active" : ""}${rejected ? " is-danger" : ""}">${epoch}${selected && mode === "select" ? " ✓" : ""}</button>`;
  }).join("");
}

function openEpochTool(mode) {
  const title = "Preview and Rejection";
  const html = `<div class="stage-review">
    <div class="epoch-toolbar"><label>Epoch length: <select id="epoch-length"><option>1 s</option><option selected>5 s</option><option>10 s</option><option>30 s</option><option>60 s</option></select></label><label>EEG amplitude: <select id="epoch-eeg-amplitude"><option>500</option><option>1000</option><option>2000</option><option>4000</option><option selected>Auto</option></select></label><label>ACC amplitude: <select id="epoch-acc-amplitude"><option>500</option><option>1000</option><option>2000</option><option>4000</option><option selected>Auto</option></select></label><span class="spacer"></span><button type="button" data-dialog-action="epoch-first">First</button><button type="button" data-dialog-action="epoch-prev">&lt;</button><label>Page <input id="epoch-page" type="number" min="1" max="15" value="${legacyState.epochPage}"></label><button type="button" data-dialog-action="epoch-goto">Goto</button><button type="button" data-dialog-action="epoch-next">&gt;</button><button type="button" data-dialog-action="epoch-last">Last</button></div>
    ${simulatedSignalCanvas("preview-waveform", false, ["EEG1", "EEG2", "EEG3", "ACC magnitude"])}
    <label class="epoch-time-slider">Time position<input type="range" id="epoch-time-position" min="1" max="1440" value="${legacyState.selectedEpoch}"></label><div class="classification-bar"><strong>Epochs (100 / page)</strong><div class="epoch-grid">${epochButtons("reject")}</div><div class="review-actions"><button type="button" data-dialog-action="reject-epoch">Reject</button><button type="button" data-dialog-action="cancel-reject">Remain</button><button type="button" data-dialog-action="undo-rejection">Undo</button><button type="button" data-dialog-action="redo-rejection">Redo</button><button type="button" data-dialog-action="cancel-all-reject">Cancel all</button><button class="is-selected" type="button" data-dialog-action="finish-epochs">Apply Rejection</button></div></div>
  </div>`;
  openModule("preview-rejection", html);
}

function dataSelectDefaults() {
  const profile = activeProfile();
  const start = new Date(profile.recordingStart);
  const end = new Date(start.getTime() + profile.durationSeconds * 1000);
  const dateValue = (date) => date.toISOString().slice(0, 10);
  const timeValue = (date) => date.toTimeString().slice(0, 8);
  return {
    startDate: dateValue(start),
    startTime: timeValue(start),
    endDate: dateValue(end),
    endTime: timeValue(end),
  };
}

function readDataSelectDraft() {
  const draft = {
    startDate: document.querySelector("#crop-start-date")?.value || "",
    startTime: document.querySelector("#crop-start-time")?.value || "",
    endDate: document.querySelector("#crop-end-date")?.value || "",
    endTime: document.querySelector("#crop-end-time")?.value || "",
  };
  legacyState.dataSelectDraft = draft;
  return draft;
}

function validateDataSelectDraft(draft) {
  const profile = activeProfile();
  const sourceStart = new Date(profile.recordingStart);
  const sourceEnd = new Date(sourceStart.getTime() + profile.durationSeconds * 1000);
  const start = new Date(`${draft.startDate}T${draft.startTime}`);
  const end = new Date(`${draft.endDate}T${draft.endTime}`);
  if (!draft.startDate || !draft.endDate || !draft.startTime || !draft.endTime || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    showMessage({ title: "Format Error", text: "The end datetime needs to be later than the start datetime.", kind: "warning" });
    return null;
  }
  if (start < sourceStart || end > sourceEnd) {
    showMessage({ title: "Time Range Error", text: `Valid range: ${sourceStart.toISOString().replace("T", " ").slice(0, 19)} ~ ${sourceEnd.toISOString().replace("T", " ").slice(0, 19)}`, kind: "warning" });
    return null;
  }
  return { start, end };
}

function openDataSelect() {
  const profile = activeProfile();
  const sourceStart = new Date(profile.recordingStart);
  const sourceEnd = new Date(sourceStart.getTime() + profile.durationSeconds * 1000);
  const dateValue = (date) => date.toISOString().slice(0, 10);
  const timeValue = (date) => date.toTimeString().slice(0, 8);
  const draft = legacyState.dataSelectDraft || dataSelectDefaults();
  legacyState.dataSelectDraft = { ...draft };
  const dateOptionsFor = (selected) => [dateValue(sourceStart), dateValue(sourceEnd)]
    .filter((value, index, all) => all.indexOf(value) === index)
    .map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`).join("");
  const html = `<div class="wizard data-select-window"><div class="wizard-heading"><h2>Data Select</h2><span>Available range: <span class="range-endpoint">${dateValue(sourceStart)} ${timeValue(sourceStart)}</span> ~ <span class="range-endpoint">${dateValue(sourceEnd)} ${timeValue(sourceEnd)}</span></span></div><div class="wizard-content"><div class="time-range-grid">
    <strong>Start</strong><label>Date<select id="crop-start-date">${dateOptionsFor(draft.startDate)}</select></label><label>Time<input id="crop-start-time" type="time" step="1" value="${draft.startTime}"></label>
    <strong>End</strong><label>Date<select id="crop-end-date">${dateOptionsFor(draft.endDate)}</select></label><label>Time<input id="crop-end-time" type="time" step="1" value="${draft.endTime}"></label>
  </div><p class="boundary-note"><strong>Data crop boundary</strong><span>The selected range is recorded in prototype state. Cross-day ranges use full datetime validation. No EDF samples are cropped or written.</span></p></div><div class="wizard-actions"><button class="command" type="button" data-dialog-action="export-cropped-edf">Export cropped EDF</button><button class="command primary" type="button" data-dialog-action="apply-crop">Apply</button></div></div>`;
  openModule("data-select", html, "data-select");
}

function croppedEdfContractPreview() {
  const rows = [
    ["raw-copy", "raw_cropped.copy()", "Write from a copy of the cropped Raw object"],
    ["acc-scale", "ACC * 1e-6", "PC scaling contract before EDF write"],
    ["acc-dimension", "ACC dimension: mg", "ACC channel header unit"],
    ["non-acc-dimension", "Non-ACC dimension: uV", "Other channel header unit"],
    ["sample-rate", "sample_rate = int(sfreq)", "Integer sample rate per channel"],
    ["physical-range", "physical: -10000 .. 10000", "Physical min/max"],
    ["digital-range", "digital: -32768 .. 32767", "Digital min/max"],
  ];
  return `<section class="export-preview cropped-edf-contract" data-export-preview="cropped-edf"><strong>PC source EDF write contract</strong><div>${rows.map(([key, field, label]) => `<span data-edf-contract="${key}"><code>${escapeHtml(field)}</code><span>${escapeHtml(label)}</span></span>`).join("")}</div><p>Source preview from DataSelect.py:318-406 (update_cropped_data and save_to_edf). It describes the desktop writer; it is not browser execution evidence.</p></section>`;
}

function croppedEdfExportContent(context, failure = false) {
  return `<div class="save-dialog-grid cropped-edf-export-grid">
    <label>Filename<input id="edf-export-filename" value="${escapeHtml(context.fileName)}" autocomplete="off" placeholder="Enter a filename"></label>
    <label>Simulated outcome<select id="export-outcome"><option value="success" ${context.outcome === "success" ? "selected" : ""}>Success</option><option value="failure" ${context.outcome === "failure" ? "selected" : ""}>Failure</option></select></label>
    <label class="wide">PC dialog filter<input value="EDF Files (*.edf);;All Files (*)" readonly></label>
    <div class="wide">${croppedEdfContractPreview()}</div>
    ${failure ? '<div class="export-failure-inline wide" data-export-state="failure"><strong>Simulated export failed</strong><span>No file was written. Change the outcome and retry once to verify recovery.</span></div>' : ''}
    <p class="boundary-note wide"><strong>Browser boundary</strong><span>This independent V1 export flow is not connected to the current visible PC Apply button. The browser does not crop samples, does not apply the <span class="scientific-token" data-scientific-token="acc-scale">ACC 1e-6</span> scaling, does not encode EDF, and writes no file. Success produces only a SIMULATED:// marker.</span></p>
  </div>`;
}

function renderCroppedEdfExport(failure = false) {
  const context = legacyState.exportContext;
  if (!context || context.kind !== "cropped-edf") return;
  const action = failure ? "retry-cropped-edf-export" : "confirm-cropped-edf-export";
  const label = failure ? "Retry export" : "Save";
  openModule("cropped-edf-export", renderWizard("Save EDF File", "Independent V1 export flow", croppedEdfExportContent(context, failure), label, action), "export");
  moduleWindow.classList.add("is-cropped-edf-export");
  if (failure) moduleWindow.classList.add("is-cropped-edf-failure");
}

function openCroppedEdfExport() {
  const draft = readDataSelectDraft();
  if (!validateDataSelectDraft(draft)) return;
  legacyState.exportReturn = "data-select";
  legacyState.exportContext = {
    source: "data-select",
    kind: "cropped-edf",
    outcome: "success",
    fileName: "",
    range: { ...draft },
  };
  renderCroppedEdfExport(false);
}

function runCroppedEdfExport() {
  const context = legacyState.exportContext;
  if (!context || context.kind !== "cropped-edf") return;
  context.fileName = document.querySelector("#edf-export-filename")?.value.trim() || "";
  context.outcome = document.querySelector("#export-outcome")?.value || context.outcome;
  if (!context.fileName) return showMessage({ title: "Filename required", text: "Enter an EDF filename or cancel the independent export flow.", kind: "warning" });
  if (context.outcome === "failure") return renderCroppedEdfExport(true);

  const fileName = /\.edf$/i.test(context.fileName) ? context.fileName : `${context.fileName}.edf`;
  const marker = `SIMULATED://${fileName}`;
  legacyState.lastSimulatedExport = {
    source: "data-select",
    kind: "cropped-edf",
    path: marker,
    paths: [marker],
    fileName,
    format: ".edf",
    dpi: null,
    range: { ...context.range },
    fields: ["raw_cropped.copy()", "ACC * 1e-6 -> mg", "Non-ACC -> uV", "sample_rate = int(sfreq)", "physical -10000..10000", "digital -32768..32767"],
    wroteFile: false,
    encodedEdf: false,
    appliedAccScale: false,
  };
  legacyState.exportReturn = null;
  legacyState.exportContext = null;
  openDataSelect();
  showMessage({ title: "Simulated export complete", text: `${marker}\nNo file was written. The .edf suffix and source contract were recorded only for browser interaction review.` });
}

function basicConfigFields(kind) {
  if (kind === "bandpower") return `<fieldset class="config-fieldset"><legend>Channels</legend><div class="channel-list">${channelCheckboxes()}</div></fieldset><fieldset class="config-fieldset"><legend>Band width (Hz)</legend><div class="band-grid"><span>Delta</span><input value="1"><span>−</span><input value="4"><span>Theta</span><input value="4"><span>−</span><input value="8"><span>Alpha</span><input value="8"><span>−</span><input value="12"><span>Beta</span><input value="12"><span>−</span><input value="30"><span>Gamma</span><input value="30"><span>−</span><input value="100"></div></fieldset>`;
  if (kind === "psd") return `<fieldset class="config-fieldset"><legend>Channels</legend><div class="channel-list">${channelCheckboxes()}</div></fieldset><label class="wide">Frequency range (Hz)<div class="path-row"><input type="number" value="1" min="0"><input type="number" value="100" min="0"></div></label>`;
  if (kind === "time-frequency") return `<fieldset class="config-fieldset"><legend>Channels</legend><div class="channel-list">${channelCheckboxes(12)}</div></fieldset><fieldset class="config-fieldset"><legend>Raw Data</legend><div class="form-grid"><label>Amplitude unit<div class="inline-radios"><label><input type="radio" name="tf-unit" checked>μV</label><label><input type="radio" name="tf-unit">mV</label></div></label><label>Y axis limit ±<input type="number" min="1" value="100"></label></div></fieldset><fieldset class="config-fieldset wide"><legend>Time Frequency</legend><div class="form-grid"><label>Window size (s)<input type="number" min="0.1" step="0.1" value="2"></label><label>Frequency low/high<div class="path-row"><input type="number" value="1"><input type="number" value="100"></div></label><label>Height ratio H:W<div class="path-row"><input type="number" value="3"><input type="number" value="4"></div></label><label>Time interval (s)<input type="number" min="0.1" step="0.1" value="1"></label></div></fieldset>`;
  return `<fieldset class="config-fieldset"><legend>Channels</legend><div class="channel-list">${channelCheckboxes(12)}</div></fieldset><div class="form-grid"><label>Amplitude unit<div class="inline-radios"><label><input type="radio" name="rms-unit" checked>μV</label><label><input type="radio" name="rms-unit">mV</label></div></label><label>Y axis limit ±<input type="number" min="1" value="100"></label><label>Window size (s)<input type="number" min="0.1" step="0.1" value="2"></label><label>Time interval (s)<input type="number" min="0.1" step="0.1" value="1"></label></div>`;
}

function openBasicConfig(kind) {
  openBasicWorkbench(kind, "idle");
}

function basicWorkbenchParameters(kind) {
  const bands = `<div class="band-grid">${[["Delta",0.5,4],["Theta",4,8],["Alpha",8,12],["Beta",12,30],["Gamma",30,100],["Other",0.5,200]].map(([name, low, high]) => `<span>${name}</span><input name="band-low" data-band="${name}" value="${low}"><span>−</span><input name="band-high" data-band="${name}" value="${high}">`).join("")}</div>`;
  if (kind === "bandpower") return `<fieldset class="config-fieldset"><legend>Frequency bands</legend>${bands}<p class="micro-note">Named bands cannot overlap. Other is an independent custom range.</p></fieldset>`;
  if (kind === "psd") return `<fieldset class="config-fieldset"><legend>PSD</legend><label>Frequency range (Hz)<div class="path-row"><input id="basic-low" type="number" min="0.001" max="30000" step="0.001" value="1.000"><input id="basic-high" type="number" min="0.001" max="30000" step="0.001" value="40.000"></div></label></fieldset>`;
  if (kind === "time-frequency") return `<fieldset class="config-fieldset"><legend>Time-frequency</legend><label>Frequency range (Hz)<div class="path-row"><input id="basic-low" value="1"><input id="basic-high" value="40"></div></label><label>Window length (s)<input type="number" value="4"></label><label>Trend window (s)<input type="number" value="60"></label>${bands}<p class="micro-note">ERS/ERD trends are research summaries and are not diagnostic conclusions.</p></fieldset>`;
  return `<fieldset class="config-fieldset"><legend>Activity / ACC</legend><p class="micro-note">Select exactly three channels whose names contain ACC.</p><label><input name="activity-acc" type="checkbox" checked>ACC X</label><label><input name="activity-acc" type="checkbox" checked>ACC Y</label><label><input name="activity-acc" type="checkbox" checked>ACC Z</label></fieldset>`;
}

function openBasicWorkbench(kind, phase = "idle") {
  const [title] = moduleNames[kind];
  const profileChannels = activeProfile().channels;
  const stateBody = phase === "progress"
    ? `<div class="analysis-state"><div class="progress-spinner"></div><strong>Analysing...</strong><span>No scientific worker is invoked in this prototype.</span></div>`
    : phase === "result"
      ? `<div class="plot-stack">${kind === "bandpower" ? ["Channel absolute power","Mean absolute power","Channel relative power","Mean relative power","Channel band ratio","Mean band ratio","Channel total power","Mean total power"].map((label) => plotShell(label)).join("") : kind === "psd" ? `${plotShell("Raw waveform")}${plotShell("Power Spectral Density")}` : kind === "time-frequency" ? `${plotShell("Time-frequency map")}${plotShell("Band trend / ERS-ERD")}` : `${plotShell("ACC waveforms")}${plotShell("Total ACC")}<div class="canvas-toolbar"><button type="button" data-dialog-action="activity-zoom-in">Zoom in</button><button type="button" data-dialog-action="activity-zoom-out">Zoom out</button><button type="button" data-dialog-action="activity-enlarge">Enlarge view</button></div>`}</div>`
      : `<div class="analysis-state"><img src="assets/empty_task.png" alt=""><strong>请设置分析参数后点击 Analyse</strong><span>The result canvas remains empty until the analysis state is started.</span></div>`;
  const html = `<div class="analysis-layout specialized-workbench"><aside class="analysis-sidebar"><h2>${escapeHtml(title)}</h2><div class="control-stack"><fieldset class="config-fieldset"><legend>Channels</legend><label class="check-all"><input type="checkbox" checked>ALL</label><div class="channel-list">${profileChannels.map((channel, index)=>`<label><input name="basic-channel" type="checkbox" ${kind === "activity" ? (/ACC/.test(channel) ? "checked" : "") : index < Math.min(4, profileChannels.length) ? "checked" : ""}>${escapeHtml(channel)}</label>`).join("")}</div></fieldset>${dateTimeControls()}${basicWorkbenchParameters(kind)}<p class="boundary-note"><strong>Result boundary</strong><span>The PC empty, progress, result and export states are available without producing synthetic measurements.</span></p></div></aside><section class="analysis-canvas"><div class="canvas-toolbar"><strong>${escapeHtml(title)} Analysis</strong><div class="pager"><button>First</button><button>‹</button><span>Page 1 / 1</span><button>›</button><button>Last</button></div></div>${stateBody}<div class="analysis-footer"><span>${phase === "result" ? "Result layout only; no values are patient data." : "Configure channels, time range and method parameters."}</span><div><button class="command primary" data-dialog-action="run-basic-workbench" data-kind="${kind}">Analyse</button><button class="command" data-dialog-action="save-picture" ${phase === "result" ? "" : "disabled"}>Save Picture</button><button class="command" data-dialog-action="save-result-data" ${phase === "result" ? "" : "disabled"}>Save Data</button></div></div></section></div>`;
  openModule(kind, html);
}

function openBasicResult(kind) {
  openBasicWorkbench(kind, "result");
}

function signalAssignmentFields(kind) {
  if (kind === "ecg") return `<label>ECG:<select><option>Not assigned</option>${channels.map((channel) => `<option>${channel}</option>`).join("")}</select></label>`;
  return `<label>EEG:<select><option>Not assigned</option>${channels.map((channel) => `<option>${channel}</option>`).join("")}</select></label><label>EMG:<select><option>Not assigned</option>${channels.map((channel) => `<option>${channel}</option>`).join("")}</select></label><label>Motion:<select><option>Not assigned</option><option>ACC X</option><option>ACC Y</option><option>ACC Z</option></select></label>`;
}

function dateTimeControls() {
  return `<div class="time-range-mini"><label>Start date<select id="analysis-start-date"><option>2026-07-29</option></select></label><label>Start time<input id="analysis-start-time" type="time" step="1" value="09:00:00"></label><label>End date<select id="analysis-end-date"><option>2026-07-29</option></select></label><label>End time<input id="analysis-end-time" type="time" step="1" value="11:00:00"></label></div>`;
}

function plotShell(title, subtitle = "Deterministic fixture for interaction review; not a patient result.", plotKind = null) {
  return `<section class="plot-shell"><header><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></header><div class="plot-placeholder has-fixture" data-fixture="simulated-result">${fixtureBadge()}${simulatedPlotSvg(title, plotKind)}</div></section>`;
}

function simulatedSignalResult(kind) {
  const isEcg = kind === "ecg";
  const page = isEcg ? lifecycleState("ecg")?.page || 1 : lifecycleState("emg")?.page || 1;
  if (!isEcg) {
    const boundary = "Deterministic non-patient fixture. The PC worker band-pass filters the selected signal and computes an envelope; no EMG filtering or envelope algorithm was executed in this browser.";
    return `<section class="plot-shell" data-emg-view="raw" data-fixture="emg-result"><header><strong>Raw EMG Signal</strong><span>PC-visible output contract</span></header><div class="plot-placeholder has-fixture" data-fixture="simulated-result">${fixtureBadge()}${simulatedSignalSvg("Raw EMG Signal", ["Raw EMG"], page - 1)}</div><p class="fixture-caption">${boundary}</p></section><section class="plot-shell" data-emg-view="envelope"><header><strong>EMG Envelope</strong><span>PC-visible output contract</span></header><div class="plot-placeholder has-fixture" data-fixture="simulated-result">${fixtureBadge()}${simulatedSignalSvg("EMG Envelope", ["Envelope"], page - 1)}</div><p class="fixture-caption">${boundary}</p></section>`;
  }
  const ecgMetrics = page === 1
    ? [["heart_rate", "Average HR", "72 bpm"], ["rr_interval", "RR interval", "834 ms"], ["delta_rr", "DeltaRR", "28 ms"], ["r_peaks", "Detected peaks", "143"]]
    : [["heart_rate", "Average HR", "68 bpm"], ["rr_interval", "RR interval", "882 ms"], ["delta_rr", "DeltaRR", "34 ms"], ["r_peaks", "Detected peaks", "136"]];
  const metricCards = ecgMetrics.map(([metric, label, value]) => `<div data-metric="${escapeHtml(metric)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  return `<section class="plot-shell fixture-result-block" data-fixture="ecg-result" data-page-fixture="${page}"><header><strong>ECG Signal with R Peaks</strong><span>Deterministic fixture · not patient data</span></header><div class="fixture-result-content">${fixtureBadge()}${simulatedSignalSvg("ECG", ["ECG", "Heart rate"], page - 1)}<div class="fixture-metrics">${metricCards}</div><p class="fixture-caption">Values are deterministic demonstration fixtures. No physiological interpretation or diagnosis is produced.</p></div></section>`;
}

function hrvOutcomeControl() {
  const outcome = legacyState.hrvState.outcome || "success";
  return `<label class="hrv-outcome-control">Simulated HRV outcome<select id="hrv-outcome"><option value="success" ${outcome === "success" ? "selected" : ""}>Success</option><option value="memory-failure" ${outcome === "memory-failure" ? "selected" : ""}>Insufficient memory</option><option value="resource-failure" ${outcome === "resource-failure" ? "selected" : ""}>Nonlinear backend failure</option></select></label>`;
}

const hrvBackendScenarios = {
  "cuda-cpp-success": {
    label: "CUDA C++ selected",
    requested: "auto",
    actual: "cuda_cpp_fullscale",
    preflight: "passed",
    fallback: "none",
    attempts: [["cuda_cpp", "selected"], ["cuda_chunked", "not attempted"], ["rust", "not attempted"]],
  },
  "cuda-chunked-fallback": {
    label: "CUDA chunked fallback",
    requested: "auto",
    actual: "cuda_chunked",
    preflight: "cuda_cpp_preflight_vram_low",
    fallback: "cuda_cpp preflight skipped: cuda_cpp_preflight_vram_low",
    attempts: [["cuda_cpp", "preflight skipped"], ["cuda_chunked", "selected"], ["rust", "not attempted"]],
  },
  "rust-fallback": {
    label: "Rust CPU fallback",
    requested: "auto",
    actual: "rust",
    preflight: "cuda_cpp_preflight_scale_count_exceeded",
    fallback: "cuda_cpp preflight skipped; cuda_chunked worker failed; continued to Rust",
    attempts: [["cuda_cpp", "preflight skipped"], ["cuda_chunked", "failed"], ["rust", "selected"]],
  },
};

function hrvBackendScenarioControl() {
  const selected = legacyState.hrvState.backendScenario || "cuda-cpp-success";
  const options = Object.entries(hrvBackendScenarios).map(([value, scenario]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${scenario.label}</option>`).join("");
  return `<label class="hrv-backend-control">Simulated backend evidence<select id="hrv-backend-scenario">${options}</select></label>`;
}

function hrvBackendContract() {
  const scenarioKey = legacyState.hrvState.backendScenario || "cuda-cpp-success";
  const scenario = hrvBackendScenarios[scenarioKey] || hrvBackendScenarios["cuda-cpp-success"];
  const attempts = scenario.attempts.map(([backend, status]) => `<li data-hrv-backend-attempt="${backend}" data-status="${status.replaceAll(" ", "-")}"><code>${backend}</code><span>${status}</span></li>`).join("");
  return `<section class="source-contract-card hrv-backend-contract" data-hrv-backend-contract data-scenario="${scenarioKey}"><div class="hrv-contract-heading"><strong>Nonlinear backend trace</strong><span>Deterministic requirements evidence</span></div><dl class="hrv-backend-facts"><div><dt>Requested</dt><dd><code>requested_backend = ${scenario.requested}</code></dd></div><div><dt>Actual</dt><dd><code>actual_backend = ${scenario.actual}</code></dd></div><div><dt>Attempt order</dt><dd><code>cuda_cpp -&gt; cuda_chunked -&gt; rust</code></dd></div><div><dt>Preflight</dt><dd><code>${scenario.preflight}</code></dd></div><div class="wide"><dt>Fallback reason</dt><dd>${scenario.fallback}</dd></div></dl><ol class="hrv-backend-attempts" aria-label="Backend attempt record">${attempts}</ol><p data-hrv-consistency-contract><strong>Consistency contract:</strong> fallback keeps HRV output column names, units, and mathematical definitions unchanged. Poincare display sampling does not change numeric results.</p><p class="result-boundary"><strong>Simulation boundary:</strong> No CUDA C++, CUDA chunked, Rust, or HRV nonlinear algorithm was executed. This is deterministic non-patient requirements evidence, not a clinical result.</p><p class="hrv-source-citations"><code>ECG_HRV_Analysis.py:174-198</code> · <code>ECG_HRV_Analysis.py:295-365</code> · <code>ECG_HRV_Analysis.py:443-542</code> · <code>ECG_HRV_Analysis.py:545-573</code> · <code>AR_analyser.py:16-77</code></p></section>`;
}

function analysisOutcomeControl(kind) {
  const state = lifecycleState(kind);
  return `<label>Simulated analysis outcome<select id="analysis-outcome"><option value="success" ${state?.outcome === "success" ? "selected" : ""}>Success</option><option value="failure" ${state?.outcome === "failure" ? "selected" : ""}>Failure</option></select></label>`;
}

function analysisIdleState(message = "Configure the analysis parameters and click Analyse.") {
  return `<div class="analysis-state" data-analysis-state="idle"><img src="assets/empty_task.png" alt=""><strong>Ready to analyse</strong><span>${escapeHtml(message)}</span></div>`;
}

function analysisProgressState(kind, message) {
  return `<div class="analysis-state" data-analysis-state="progress"><div class="progress-spinner"></div><strong>${escapeHtml(message)}</strong><span>No algorithm or scientific worker is invoked in this prototype.</span><button class="command" type="button" data-dialog-action="cancel-analysis" data-kind="${kind}">Cancel analysis</button></div>`;
}

function analysisFailureState(kind) {
  return `<div class="analysis-state is-failure" data-analysis-state="failure"><div class="failure-mark">!</div><strong>Analysis failed</strong><span>No algorithm was run. This deterministic failure state verifies retry and cleanup behavior without producing a scientific result.</span><button class="command primary" type="button" data-dialog-action="retry-analysis" data-kind="${kind}">Retry analysis</button></div>`;
}

function modulePageControls(kind) {
  const state = lifecycleState(kind);
  return `<div class="pager"><button type="button" data-dialog-action="module-first-page" data-kind="${kind}">First</button><button type="button" data-dialog-action="module-prev-page" data-kind="${kind}">‹</button><span>Page ${state?.page || 1} / 2</span><button type="button" data-dialog-action="module-next-page" data-kind="${kind}">›</button><button type="button" data-dialog-action="module-last-page" data-kind="${kind}">Last</button></div>`;
}

function openSignalWorkbench(kind, phase = lifecycleState(kind)?.phase || "idle") {
  const state = activateLifecycleState(kind);
  state.phase = phase;
  legacyState.analysisPhases[kind] = phase;
  const isEcg = kind === "ecg";
  const title = isEcg ? "ECG Analysis" : "EMG Analysis";
  const selectedChannel = legacyState.selectedSignalChannels[kind];
  const currentPage = state.page;
  legacyState.specialPages[kind] = currentPage;
  const channelOptions = activeProfile().channels.map((channel) => `<option ${channel === selectedChannel ? "selected" : ""}>${escapeHtml(channel)}</option>`).join("");
  const body = phase === "progress"
    ? analysisProgressState(kind, "Analysing, please wait...")
    : phase === "failure"
      ? analysisFailureState(kind)
    : phase === "result"
      ? `<div class="plot-stack" data-analysis-state="result">${simulatedSignalResult(kind)}</div>`
      : analysisIdleState("Set a channel and analysis range before starting.");
  const ecgControls = isEcg
    ? `${hrvOutcomeControl()}<label>ECG amplitude<select><option>Auto</option><option>±100</option><option>±200</option><option>±500</option><option>±1000</option></select></label><label>Heart-rate amplitude<select><option>Auto</option><option>±100</option><option>±200</option><option>±500</option><option>±1000</option></select></label>`
    : '<label>Raw amplitude<select><option>Auto</option><option>±50</option><option>±100</option><option>±200</option><option>±500</option></select></label><label>Envelope amplitude<select><option>Auto</option><option>±200</option><option>±500</option><option>±1000</option><option>±2000</option></select></label>';
  const html = `<div class="analysis-layout specialized-workbench"><aside class="analysis-sidebar"><h2>Control Panel</h2><div class="control-stack"><label>Channel Select：<select id="special-channel"><option value="">Select channel</option>${channelOptions}</select></label>${dateTimeControls()}${analysisOutcomeControl(kind)}${ecgControls}<p class="boundary-note"><strong>Simulated result boundary</strong><span>Controls mirror the PC workflow. Completed views use deterministic demonstration fixtures and never claim a patient calculation.</span></p></div></aside><section class="analysis-canvas"><div class="canvas-toolbar"><strong>${title}</strong><div class="pager"><button type="button" data-dialog-action="special-first">First</button><button type="button" data-dialog-action="special-prev">‹</button><span>Page ${currentPage} / 2</span><button type="button" data-dialog-action="special-next">›</button><button type="button" data-dialog-action="special-last">Last</button></div></div>${body}<div class="analysis-footer"><span>${phase === "result" ? "Simulated fixture result; not patient data." : phase === "failure" ? "Failure is simulated; no result data exists." : "Set a channel and analysis range."}</span><div><button class="command primary" type="button" data-dialog-action="run-signal" data-kind="${kind}" ${phase === "progress" ? "disabled" : ""}>Analyse</button>${isEcg ? '<button class="command" type="button" data-dialog-action="average-hr" '+(phase === "result" ? "" : "disabled")+'>Average HR</button><button class="command" type="button" data-dialog-action="open-hrv" '+(phase === "result" ? "" : "disabled")+'>HRV ana</button>' : ""}<button class="command" type="button" data-dialog-action="save-picture" data-kind="${kind}" ${phase === "result" ? "" : "disabled"}>Save Pic</button><button class="command" type="button" data-dialog-action="save-result-data" data-kind="${kind}" ${phase === "result" ? "" : "disabled"}>Save Data</button></div></div></section></div>`;
  openModule(kind, html);
}

function openHrvWorkbench(phase = "progress") {
  const state = legacyState.hrvState;
  state.phase = phase;
  const failureKind = state.failureKind || (state.outcome === "memory-failure" ? "memory" : "resource");
  const body = phase === "progress"
    ? `<div class="analysis-state hrv-state" data-hrv-state="progress"><div class="progress-spinner"></div><strong>HRV analysis may take a long time</strong><span>No HRV algorithm or backend was executed in this browser prototype.</span></div>`
    : phase === "failure"
      ? failureKind === "memory"
        ? `<div class="analysis-state is-failure hrv-state" data-hrv-state="failure" data-failure-kind="memory"><div class="failure-mark">!</div><strong>Insufficient Memory</strong><span>The PC workflow closes HRV when the calculation cannot obtain enough memory. No HRV result was fabricated.</span><button class="command primary" type="button" data-dialog-action="retry-hrv">Retry HRV</button></div>`
        : `<div class="analysis-state is-failure hrv-state" data-hrv-state="failure" data-failure-kind="resource"><div class="failure-mark">!</div><strong>No HRV nonlinear backend succeeded</strong><span class="backend-chain">Requested <code>requested_backend = auto</code>. Attempted backend chain: <code>cuda_cpp</code> → <code>cuda_chunked</code> → <code>rust</code>. Terminal state: <code>actual_backend = none</code>. The prototype records this explicit resource failure and does not silently invent a fallback result.</span><button class="command primary" type="button" data-dialog-action="retry-hrv">Retry HRV</button></div>`
      : `<div class="hrv-result" data-hrv-state="result"><div class="hrv-result-grid"><section class="plot-shell hrv-result-panel" data-hrv-visible-panel="rr-distribution" data-fixture="hrv-rr-distribution"><header><strong>RR Interval Distribution</strong><span>PC visible completed view · deterministic fixture</span></header><div class="plot-placeholder has-fixture">${fixtureBadge()}${simulatedRrDistributionSvg()}</div></section><section class="plot-shell hrv-result-panel" data-fixture="hrv-poincare"><header><strong>Poincare display fixture</strong><span>Nonlinear export contract · deterministic fixture</span></header><div class="plot-placeholder has-fixture">${fixtureBadge()}${simulatedPoincareSvg()}</div><p class="fixture-caption">Display uses at most 2000 points; HRV metrics continue to use the full input. No numeric result is calculated here.</p></section></div>${hrvBackendContract()}<p class="boundary-note" data-hrv-boundary="time-domain"><strong>PC visibility boundary</strong><span><code>hrv_time</code> is retained for structured export; there is no independent time-domain result page in the verified PC flow.</span></p></div>`;
  const controls = `<div class="hrv-toolbar-controls">${hrvOutcomeControl()}${hrvBackendScenarioControl()}<button class="command" type="button" data-dialog-action="hrv-complete">Show completed UI state</button></div>`;
  const html = `<div class="analysis-canvas hrv-workbench"><div class="canvas-toolbar"><div class="hrv-heading"><strong>ECG HRV Analysis</strong><span>RR interval distribution</span></div>${controls}</div>${body}<div class="analysis-footer"><span>No HRV algorithm or backend was executed; every visible value is a deterministic fixture.</span><div><button class="command" type="button" data-dialog-action="save-picture" ${phase === "result" ? "" : "disabled"}>Save pic</button><button class="command" type="button" data-dialog-action="save-result-data" ${phase === "result" ? "" : "disabled"}>Save data</button></div></div></div>`;
  openModule("ecg-hrv", html);
}

const sleepFixtureStages = ["Wake", "Wake", "NREM", "NREM", "NREM", "REM", "Wake", "NREM", "NREM", "REM", "Wake", "NREM"];
const sleepStageCodes = { Wake: 1, NREM: 2, REM: 3 };

function sleepFixtureStage(epoch) {
  return sleepFixtureStages[(Math.max(1, epoch) - 1) % sleepFixtureStages.length];
}

function currentSleepStage(state, epoch = state.selectedEpoch) {
  return state.classificationByEpoch.get(epoch) ?? sleepFixtureStage(epoch);
}

function sleepFixtureCounts(state) {
  const counts = { Wake: 0, NREM: 0, REM: 0 };
  sleepFixtureStages.forEach((fixtureStage, index) => {
    const stage = state.classificationByEpoch.get(index + 1) ?? fixtureStage;
    counts[stage] += 1;
  });
  return counts;
}

function applySleepStage(after) {
  const state = activateLifecycleState("sleep");
  if (!state || state.phase !== "result" || !Object.hasOwn(sleepStageCodes, after)) return false;
  const before = currentSleepStage(state);
  if (before === after) return false;
  state.undoStack.push({ epoch: state.selectedEpoch, before, after });
  state.redoStack.length = 0;
  state.classificationByEpoch.set(state.selectedEpoch, after);
  openSleepWorkbench("result");
  return true;
}

function sleepSourceContract() {
  return `<section class="source-contract-card" data-sleep-contract><strong>PC automatic three-stage contract</strong><dl><div><dt>Model</dt><dd><code>2_LightGBM-1EEG</code></dd></div><div><dt>Epoch choices</dt><dd>4 seconds (default) · 10 seconds</dd></div><div><dt>Stage_Code</dt><dd>1 = Wake · 2 = NREM · 3 = REM</dd></div><div><dt>Count fields</dt><dd><code>Wake_Count</code> · <code>NREM_Count</code> · <code>REM_Count</code></dd></div></dl><p>Source: <code>QlassAnalysis.py:439-625</code>; shortcuts: lines 2100-2131.</p></section>`;
}

function sleepFixtureResult(state) {
  const counts = sleepFixtureCounts(state);
  const stage = currentSleepStage(state);
  return `<div class="analysis-result-evidence" data-analysis-state="result" data-sleep-result><section class="result-contract-strip"><div data-sleep-current-stage><span>Current Epoch ${state.selectedEpoch}</span><strong>${stage} · Stage_Code ${sleepStageCodes[stage]}</strong></div>${Object.entries(counts).map(([name, count]) => `<div data-stage-count="${name}"><span>${name}_Count</span><strong>${count}</strong></div>`).join("")}</section><div class="plot-stack five compact">${plotShell("Hypnogram", "Deterministic non-patient fixture · editable stage surface")}${plotShell("EEG", "Deterministic non-patient fixture")}${plotShell("EMG", "Deterministic non-patient fixture")}${plotShell("ACC", "Deterministic non-patient fixture")}${plotShell("Spectrogram", "Deterministic non-patient fixture")}</div><p class="result-boundary"><strong>Simulation boundary</strong> Deterministic non-patient fixture for requirements review. No sleep model was executed; no prediction is a PC result, and this view is not for clinical use.</p></div>`;
}

function mlEpilepsySourceContract() {
  return `<section class="source-contract-card" data-epilepsy-ml-contract><strong>PC ML screening contract</strong><dl><div><dt>3 seconds</dt><dd><code>model_n762_3s.sav</code><br><code>scaler_n762_3s.sav</code></dd></div><div><dt>5 seconds</dt><dd><code>model_n1814_5s.sav</code><br><code>scaler_n1814_5s.sav</code></dd></div><div><dt>Prerequisites</dt><dd>model + scaler + loaded signal data</dd></div><div><dt>Classification</dt><dd><code>predict_proba &gt;= 0.5</code><br>Stage_Code 0 = Normal · 1 = Seizure</dd></div><div><dt>Event rule</dt><dd>At least 2 consecutive Seizure epochs form one event.</dd></div></dl><p>Sources: <code>EpilepsyAnalysis_ML.py:289-475</code>; <code>EpilepsyAnalysis.py:81-335</code>.</p></section>`;
}

function mlEpilepsyFixtureResult() {
  return `<div class="analysis-result-evidence" data-analysis-state="result" data-epilepsy-ml-result><section class="result-contract-strip"><div><span>Fixture classifications</span><strong>Epoch 1: Normal (0) · Epochs 2-3: Seizure (1)</strong></div><div><span>Event #1</span><strong>Epochs 2-3 · 10 seconds</strong></div><div><span>Seizure Count</span><strong>1</strong></div><div><span>Seizure Frequency (Events/h)</span><strong>2.0</strong></div><div><span>UTC Time</span><strong>2026-07-29 09:00:00Z</strong></div></section><div class="plot-stack five compact">${plotShell("Normal / Seizure classification", "Stage_Code 0 / 1 · deterministic editing surface", "binary-stage")}${plotShell("EEG", "Deterministic non-patient fixture")}${plotShell("EMG Envelope", "Deterministic non-patient fixture")}${plotShell("ACC", "Deterministic non-patient fixture")}${plotShell("EEG Frequency", "Deterministic non-patient fixture")}</div><p class="result-boundary"><strong>Simulation boundary</strong> The event and 30-minute-window statistics are deterministic non-patient fixtures. No ML model or scaler was executed; no seizure was detected, and this view is not for clinical use.</p></div>`;
}

function openSleepWorkbench(phase = lifecycleState("sleep").phase) {
  const state = activateLifecycleState("sleep");
  state.phase = phase;
  legacyState.analysisPhases.sleep = phase;
  const epochLength = state.epochLength ?? 4;
  const body = phase === "progress"
    ? analysisProgressState("sleep", "Sleep analysis in progress...")
    : phase === "failure"
      ? analysisFailureState("sleep")
      : phase === "result"
        ? sleepFixtureResult(state)
        : analysisIdleState("Editing and export controls unlock only after the completed UI state.");
  const ready = phase === "result";
  const html = `<div class="analysis-layout specialized-workbench traceable-workbench"><aside class="analysis-sidebar"><h2>Control Panel</h2><div class="control-stack"><label>Model<select><option>2_LightGBM-1EEG</option></select></label><label>EEG<select><option>EEG3</option>${activeProfile().channels.map((c)=>`<option>${escapeHtml(c)}</option>`).join("")}</select></label><label>EMG<select><option>EEG1</option></select></label><label>ACC<select><option>ACC X</option></select></label>${dateTimeControls()}${analysisOutcomeControl("sleep")}<label>Epoch length<select id="sleep-epoch-length"><option value="4" ${epochLength === 4 ? "selected" : ""}>4</option><option value="10" ${epochLength === 10 ? "selected" : ""}>10</option></select></label><label>Current Epoch<input id="sleep-current-epoch" type="number" min="1" max="12" value="${state.selectedEpoch}" ${ready ? "" : "disabled"}></label><label>Number of Epochs to display<select><option>All</option><option>100</option><option>50</option><option>30</option><option>20</option><option>10</option><option>5</option><option>3</option></select></label>${sleepSourceContract()}</div></aside><section class="analysis-canvas"><div class="canvas-toolbar correction-tools" tabindex="-1"><button data-stage="Wake" ${ready ? "" : "disabled"}>Wake</button><button data-stage="NREM" ${ready ? "" : "disabled"}>NREM</button><button data-stage="REM" ${ready ? "" : "disabled"}>REM</button><button data-dialog-action="undo-correction" ${ready ? "" : "disabled"}>Undo</button><button data-dialog-action="redo-correction" ${ready ? "" : "disabled"}>Redo</button><button data-dialog-action="reset-correction" ${ready ? "" : "disabled"}>Reset</button><span>Shift+1 / Shift+2 / Shift+3</span>${modulePageControls("sleep")}</div>${body}<div class="analysis-footer"><span>Wake=1 · NREM=2 · REM=3. Fixture values are not model output.</span><div><button class="command primary" data-dialog-action="run-sleep" data-kind="sleep" ${phase === "progress" ? "disabled" : ""}>Analyse</button><button class="command" data-dialog-action="load-history">Load History</button><button class="command" data-dialog-action="save-picture" ${ready ? "" : "disabled"}>Save pic</button><button class="command" data-dialog-action="save-result-data" ${ready ? "" : "disabled"}>Save data</button><button class="command" data-dialog-action="statistical-data" ${ready ? "" : "disabled"}>Statistical data</button></div></div></section></div>`;
  openModule("sleep", html);
}

function openEpilepsyWorkbench(kind, phase = lifecycleState(kind).phase) {
  const state = activateLifecycleState(kind);
  state.phase = phase;
  legacyState.analysisPhases[kind] = phase;
  const title = kind === "epilepsy-ml" ? "ML Epilepsy Analysis" : "Threshold Epilepsy Analysis";
  const current = state.classificationByEpoch.get(state.selectedEpoch) ?? "Normal";
  const ready = phase === "result";
  const epochLength = state.epochLength ?? 5;
  const thresholdControls = kind === "epilepsy-threshold"
    ? `<label for="threshold-factor">STD threshold factor<input id="threshold-factor" type="number" min="1" max="4" step="0.1" value="${state.thresholdFactor.toFixed(1)}" aria-describedby="threshold-factor-boundary"></label><div class="boundary-note" id="threshold-factor-boundary"><strong>Parameter provenance</strong><span>PC source range 1.0-4.0, step 0.1, default 2.0. This browser stores a fixture value only; it does not execute RMS threshold detection.</span></div>`
    : "";
  const mlControls = kind === "epilepsy-ml" ? mlEpilepsySourceContract() : "";
  const thresholdFooter = kind === "epilepsy-threshold"
    ? ` Fixture STD factor ${state.thresholdFactor.toFixed(1)}; no RMS threshold algorithm was executed.`
    : "";
  const body = phase === "progress"
    ? analysisProgressState(kind, `${title} in progress...`)
    : phase === "failure"
      ? analysisFailureState(kind)
      : ready
        ? kind === "epilepsy-ml"
          ? mlEpilepsyFixtureResult()
          : `<div class="plot-stack five" data-analysis-state="result">${plotShell("Stage hypnogram", "Demonstration editing surface")}${plotShell("EEG")}${plotShell("EMG Envelope")}${plotShell("ACC")}${plotShell("EEG Frequency")}</div>`
        : analysisIdleState("Labels and exports unlock only in the completed UI state.");
  const html = `<div class="analysis-layout specialized-workbench ${kind === "epilepsy-ml" ? "traceable-workbench" : ""}"><aside class="analysis-sidebar"><h2>Control Panel</h2><div class="control-stack">${signalAssignmentFields("sleep")}${dateTimeControls()}${analysisOutcomeControl(kind)}${thresholdControls}<label>Epoch length<select id="epilepsy-epoch-length"><option value="3" ${epochLength === 3 ? "selected" : ""}>3</option><option value="5" ${epochLength === 5 ? "selected" : ""}>5</option></select></label><label>Number of Epochs to display<select id="epilepsy-display"><option>All</option><option>100</option><option>50</option><option>30</option><option>20</option><option>10</option><option>5</option><option>3</option></select></label><label>Epoch range<div class="path-row"><input id="range-start-epoch" type="number" min="1" max="1440" value="${state.epochAnchor}"><input id="turn-epoch" type="number" min="1" max="1440" value="${state.selectedEpoch}"></div></label><button data-dialog-action="select-epoch-range" ${ready ? "" : "disabled"}>Select range</button><span>Current Epoch: ${state.selectedEpoch}</span>${mlControls}</div></aside><section class="analysis-canvas"><div class="canvas-toolbar correction-tools"><button data-epilepsy-label="Seizure" class="${current === "Seizure" ? "is-active" : ""}" ${ready ? "" : "disabled"}>Seizure</button><button data-epilepsy-label="Normal" class="${current === "Normal" ? "is-active" : ""}" ${ready ? "" : "disabled"}>Normal</button><button data-dialog-action="undo-correction" ${ready ? "" : "disabled"}>Undo</button><button data-dialog-action="redo-correction" ${ready ? "" : "disabled"}>Redo</button><button data-dialog-action="reset-correction" ${ready ? "" : "disabled"}>Reset</button><label>Amplitude setting<select><option>EEG ±100</option><option>EEG ±200</option><option>EEG ±500</option><option>EEG ±1000</option><option>EEG ±2000</option><option>Auto</option></select></label>${modulePageControls(kind)}</div>${body}<div class="analysis-footer"><span>${title}: labels are prototype-only and are not clinical findings.${thresholdFooter}</span><div><button class="command primary" data-dialog-action="run-epilepsy" data-kind="${kind}" ${phase === "progress" ? "disabled" : ""}>Analyse</button><button class="command" data-dialog-action="load-history">Load History</button><button class="command" data-dialog-action="save-picture" ${ready ? "" : "disabled"}>Save pic</button><button class="command" data-dialog-action="save-result-data" ${ready ? "" : "disabled"}>Save data</button></div></div></section></div>`;
  openModule(kind, html);
}

function classOptions(kind) {
  if (kind === "sleep" || kind === "emg") return ["Wake", "NREM", "REM"];
  if (kind === "epilepsy-threshold" || kind === "epilepsy-ml") return ["False", "True"];
  return ["Suppression", "Burst", "Artifact"];
}

function openCorrection(kind) {
  const [title] = moduleNames[kind];
  const classes = classOptions(kind);
  const current = legacyState.classificationByEpoch.get(legacyState.selectedEpoch) ?? classes[0];
  const html = `<div class="stage-review"><div class="epoch-toolbar"><strong>${escapeHtml(title)} · preview and correction</strong><span class="spacer"></span>${[1,2,3,4,5].map((epoch) => `<button type="button" data-review-epoch="${epoch}" class="${epoch === legacyState.selectedEpoch ? "is-active" : ""}">Epoch${epoch}</button>`).join("")}</div>${emptySignalCanvas(false, "The review controls are interactive; waveform samples and model predictions are not fabricated.")}<div class="classification-bar"><strong>correction</strong>${classes.map((label) => `<button type="button" data-classification="${escapeHtml(label)}" class="${label === current ? "is-selected" : ""}">${escapeHtml(label)}</button>`).join("")}<div class="review-actions"><button type="button" data-dialog-action="reset-correction">Reset</button><button type="button" data-dialog-action="confirm-correction">Confirm</button><button type="button" data-dialog-action="export-figure">Save Figures(.svg/.png)</button><button type="button" data-dialog-action="export-data">Save Data(.csv)</button></div></div></div>`;
  openModule(kind, html);
}

function openEcgResult() {
  const html = `<div class="analysis-layout"><aside class="analysis-sidebar"><h2>ECG Analysis</h2><p>ECG / HRV result viewer</p><div class="control-stack"><button class="command is-active" type="button">ECG</button><button class="command" type="button">HRV Time</button><button class="command" type="button">HRV Frequency</button><button class="command" type="button">HRV Nonlinear</button><div class="boundary-note"><strong>Execution boundary</strong><span>GPU/Rust HRV workers are not invoked by this prototype.</span></div></div></aside><section class="analysis-canvas"><div class="canvas-toolbar"><strong>ECG and HRV output</strong><div><button type="button" data-dialog-action="analysis-back" data-kind="ecg">Configuration</button></div></div>${emptySignalCanvas(true, "ECG cleaning, peak detection, HRV measures, and nonlinear backends are not executed.")}<div class="analysis-footer"><span>No clinical diagnosis or cardiac interpretation is produced.</span><div><button class="command" type="button" data-dialog-action="export-figure">Save Figures</button><button class="command" type="button" data-dialog-action="export-data">Save Data</button></div></div></section></div>`;
  openModule("ecg", html);
}

function openAbout() {
  const content = `<div class="wizard-card"><img src="assets/qlanalyser-logo.png" alt="QLanalyser" style="width:72px;height:72px;object-fit:contain"><h2 style="margin:0">QLanalyser</h2><p style="margin:0;line-height:1.7">Company: Quanlan Technology<br>Copyright © 2024 All rights reserved.</p><p style="margin:0;color:#5d6873;line-height:1.7">QLanalyser is a professional tool for analyzing EEG/EMG/ECG signals.</p><p class="boundary-note"><strong>Research use</strong><span>This HTML is an interaction prototype and is not a diagnostic system.</span></p></div>`;
  openModule("About QLanalyser", renderWizard("About QLanalyser", "PC source information", content, "OK", "cancel"), "compact");
}

function openAuthorizationState() {
  const content = `<div class="authorization-panel"><div class="license-status"><span class="status-dot"></span><div><strong>Authorization state simulator</strong><p>No authorization result has been checked. This page only reproduces the PC gate states without reading or accepting a real key.</p></div></div><label>Machine code<input value="Unavailable in browser prototype" readonly></label><label>Registration code<input id="prototype-registration" type="password" autocomplete="off" placeholder="Not accepted by this prototype" disabled></label><div class="dialog-actions"><button class="command" data-dialog-action="startup-auth-failure">Show failure</button><button class="command" data-dialog-action="startup-auth-expired">Show expiry</button><button class="command primary" data-dialog-action="startup-auth-success">Show success</button></div><p class="boundary-note"><strong>Security boundary</strong><span>No machine identifier, license text or credential is read, copied, validated, stored or logged.</span></p></div>`;
  openModule("Authorization", renderWizard("QLanalyser Authorization", "Startup gate reference", content, "Close", "cancel"), "compact");
}

function openStartupStateSimulator() {
  const content = `<div class="startup-state-grid">
    <button type="button" data-dialog-action="startup-duplicate"><strong>Duplicate instance</strong><span>PC warns and exits the second process.</span></button>
    <button type="button" data-dialog-action="startup-auth-required"><strong>Authorization gate</strong><span>View success, failure and expiry states without a key.</span></button>
    <button type="button" data-dialog-action="startup-direct-qeeg"><strong>QEEG parameter launch</strong><span>Simulate the alternate command-line route.</span></button>
    <button type="button" data-dialog-action="startup-update-ready"><strong>Update ready</strong><span>View reminder and restart states without networking.</span></button>
  </div><section class="source-contract-card" data-single-instance-contract><strong>Single-instance source contract</strong><dl><div><dt>Mutex</dt><dd><code>QLANALYSER</code></dd></div><div><dt>Duplicate</dt><dd><code>GetLastError() == ERROR_ALREADY_EXISTS</code></dd></div><div><dt>Visible alert</dt><dd><code>Notice</code> / <code>The program is already running and will exit...</code></dd></div><div><dt>Termination</dt><dd>Exit code 0; no second main window is created.</dd></div><div><dt>Source</dt><dd><code>AR_analyser.py:110-120,202-210</code></dd></div></dl><p>This browser does not create a Windows mutex or terminate a process. The button records a simulated branch only.</p></section><p class="boundary-note"><strong>Simulation only</strong><span>These startup branches are independently reachable for requirements review. They do not start processes, contact a server or bypass authorization.</span></p>`;
  openModule("Startup states", renderWizard("Startup states", "AR_analyser.py launch branches", content, "Close", "cancel"), "compact");
}

function openUpdateDialog() {
  const content = `<div class="update-panel"><div><span>Current version</span><strong>2.0.5.1.beta</strong></div><div><span>Latest version</span><strong>Not queried</strong></div><section><h3>What's New</h3><p>Update metadata is not fetched by the offline interaction prototype.</p></section><div class="dialog-actions"><button class="command" data-dialog-action="remind-update">Remind Me Later</button><button class="command primary" data-dialog-action="update-now" disabled>Update Now</button></div></div>`;
  openModule("Updater", renderWizard("Software Update", "Desktop updater state", content, "Close", "cancel"), "compact");
}

function openProfileSwitcher() {
  const options = Object.entries(dataProfiles).map(([value, profile]) => `<option value="${value}" ${value === legacyState.dataProfile ? "selected" : ""}>${profile.label}</option>`).join("");
  const content = `<div class="wizard-card"><label>Channel gate branch<select id="profile-switcher">${options}</select></label><p class="boundary-note"><strong>Prototype-only state control</strong><span>The PC derives this branch from imported channel names. Because this HTML does not parse EDF/BDF samples, the reviewer selects the branch explicitly.</span></p></div>`;
  openModule("Prototype profile", renderWizard("Prototype data profile", "Channel-dependent menu gate", content, "Apply", "apply-profile"), "compact");
}

function exportDescriptor(source, kind) {
  const key = `${source}:${kind}`;
  const descriptors = {
    "ecg:picture": { preview: "ecg-picture", folder: "ECG_Analysis_pic", fields: [["ecg_heart_rate", "Heart-rate figure"], ["ecg_r_peaks", "ECG signals with R peaks"]] },
    "ecg:data": { preview: "ecg-data", folder: "ECG_Analysis_data", fields: [["heart_rate", "heart_rate"], ["r_peaks_times", "r_peaks_times"], ["rr_intervals", "rr_intervals"], ["DeltaRR", "DeltaRR"]] },
    "emg:picture": {
      preview: "emg-picture",
      folder: "EMG_Analysis_pic",
      formats: [".jpg", ".png", ".svg", ".tiff", ".eps"],
      dpi: [75, 100, 150, 200, 300, 500],
      fields: [["EMGEnvelope{YYYY-MM-DD-HHMMSS}", "EMG Envelope figure"], ["EMGSignal{YYYY-MM-DD-HHMMSS}", "Raw EMG Signal figure"]],
      outputNames: ["EMGEnvelope{YYYY-MM-DD-HHMMSS}", "EMGSignal{YYYY-MM-DD-HHMMSS}"],
    },
    "emg:data": {
      preview: "emg-data",
      folder: "EMG_Analysis_data",
      formats: [".csv", ".npy"],
      basename: "emg_data{YYYY-MM-DDHHMMSS}",
      fields: [["Time(s)", "Seconds from the selected range start"], ["EMG_Raw", "Raw EMG samples"], ["EMG_Filtered", "Filtered EMG samples"], ["EMG_Envelope", "EMG envelope samples"]],
      outputNames: ["emg_data{YYYY-MM-DDHHMMSS}"],
      showGenericDataControls: false,
    },
    "ecg-hrv:picture": { preview: "hrv-picture", folder: "ECG_HRV_pic", fields: [["hrv_frequency_fig", "HRV frequency figure"], ["hrv_nonlinear_fig", "HRV nonlinear figure"], ["rr_fig", "RR interval distribution"]] },
    "ecg-hrv:data": { preview: "hrv-data", folder: "ECG_HRV_data", fields: [["hrv_time", "Time-domain table"], ["HRV_MeanNN", "HRV_MeanNN · 834 ms"], ["HRV_SDNN", "HRV_SDNN · 42 ms"], ["HRV_RMSSD", "HRV_RMSSD · 36 ms"], ["hrv_frequency", "Frequency-domain table"], ["hrv_nonlinear", "Nonlinear table"]] },
  };
  return descriptors[key] || {
    preview: `${source || "analysis"}-${kind}`,
    folder: `${String(source || "Analysis").replace(/[^a-z0-9]+/gi, "_")}_${kind === "picture" ? "pic" : "data"}`,
    fields: kind === "picture" ? [["analysis_figure", "Current result figure"]] : [["analysis_data", "Current result data"]],
  };
}

function exportPreview(context) {
  return `<section class="export-preview" data-export-preview="${escapeHtml(context.descriptor.preview)}"><strong>PC source export set</strong><div>${context.descriptor.fields.map(([field, label]) => `<span data-export-field="${escapeHtml(field)}"><code>${escapeHtml(field)}</code><span data-export-label>${escapeHtml(label)}</span></span>`).join("")}</div><p>Deterministic field preview only. No computed array, figure, or patient record is present.</p></section>`;
}

function exportDialogContent(context, failure = false) {
  const isPicture = context.kind === "picture";
  const formats = context.descriptor.formats || (isPicture ? [".png", ".jpg", ".svg", ".tiff", ".eps"] : [".csv", ".npy", ".mat", ".cache", ".xlsx"]);
  const dpi = context.descriptor.dpi || [75, 100, 150, 200, 300, 500];
  const formatOptions = formats.map((format) => `<option value="${escapeHtml(format)}" ${context.format === format ? "selected" : ""}>${escapeHtml(format)}</option>`).join("");
  const dpiOptions = dpi.map((value) => `<option value="${value}" ${Number(context.dpi) === Number(value) ? "selected" : ""}>${value}</option>`).join("");
  const genericDataControls = !isPicture && context.descriptor.showGenericDataControls !== false
    ? '<label>Data scope<select id="save-data-scope"><option>Current</option><option>All</option></select></label><label>Signal source<select id="save-signal-source"><option>Analysed</option><option>Raw</option></select></label>'
    : "";
  const basename = context.descriptor.basename
    ? `<label class="wide" data-export-basename="${escapeHtml(context.descriptor.basename)}">Filename pattern<input value="${escapeHtml(context.descriptor.basename)}" readonly></label>`
    : "";
  return `<div class="save-dialog-grid">
    <label>Format<select id="save-format">${formatOptions}</select></label>
    ${isPicture ? `<label>DPI<select id="save-dpi">${dpiOptions}</select></label>` : genericDataControls}
    <label>Simulated outcome<select id="export-outcome"><option value="success" ${context.outcome === "success" ? "selected" : ""}>Success</option><option value="failure" ${context.outcome === "failure" ? "selected" : ""}>Failure</option></select></label>
    <label class="wide" data-export-folder="${escapeHtml(context.descriptor.folder)}">Target folder<input value="${escapeHtml(context.descriptor.folder)}" readonly></label>
    ${basename}
    <div class="wide">${exportPreview(context)}</div>
    ${failure ? '<div class="analysis-state is-failure wide export-failure" data-export-state="failure"><div class="failure-mark">!</div><strong>Simulated export failed</strong><span>No file was written. Change the outcome and retry to verify recovery.</span></div>' : ''}
    <p class="boundary-note wide"><strong>Export boundary</strong><span>The PC field set, folder name, cancel, failure, retry and completion states are represented. Every success path uses a SIMULATED:// marker and writes no file.</span></p>
  </div>`;
}

function renderExportDialog(failure = false) {
  const context = legacyState.exportContext;
  if (!context) return;
  const title = context.kind === "picture" ? "Save Picture" : "Save Data";
  const action = failure ? "retry-export" : "confirm-export";
  const label = failure ? "Retry export" : "Save";
  openModule("save-dialog", renderWizard(title, `${context.source} export options`, exportDialogContent(context, failure), label, action), "export");
}

function openSaveDialog(kind = "data") {
  const source = legacyState.currentModule;
  const descriptor = exportDescriptor(source, kind);
  const defaultFormats = descriptor.formats || (kind === "picture" ? [".png"] : [".csv"]);
  const defaultDpi = descriptor.dpi || [75];
  legacyState.exportReturn = source;
  legacyState.exportContext = {
    source,
    kind,
    outcome: "success",
    format: defaultFormats[0],
    dpi: kind === "picture" ? defaultDpi[0] : null,
    descriptor,
  };
  renderExportDialog(false);
}

function restoreExportSource(source) {
  if (source === "data-select") return openDataSelect();
  if (["ecg", "emg"].includes(source)) return openSignalWorkbench(source, "result");
  if (["bandpower", "psd", "time-frequency", "activity"].includes(source)) return openBasicWorkbench(source, "result");
  if (source === "sleep") return openSleepWorkbench("result");
  if (["epilepsy-threshold", "epilepsy-ml"].includes(source)) return openEpilepsyWorkbench(source, "result");
  if (source === "ecg-hrv") return openHrvWorkbench("result");
  closeModule();
}

function runSimulatedExport() {
  const context = legacyState.exportContext;
  if (!context) return;
  context.outcome = document.querySelector("#export-outcome")?.value || context.outcome;
  context.format = document.querySelector("#save-format")?.value || context.format;
  const selectedDpi = document.querySelector("#save-dpi")?.value;
  context.dpi = selectedDpi == null ? null : Number(selectedDpi);
  if (context.outcome === "failure") return renderExportDialog(true);

  const format = context.format || (context.kind === "picture" ? ".png" : ".csv");
  const outputNames = context.descriptor.outputNames || [context.descriptor.preview];
  const paths = outputNames.map((name) => `SIMULATED://${context.descriptor.folder}/${name}${format}`);
  const path = paths[0];
  const source = context.source;
  legacyState.lastSimulatedExport = {
    source,
    kind: context.kind,
    path,
    paths,
    format,
    dpi: context.dpi,
    fields: context.descriptor.fields.map(([field]) => field),
  };
  legacyState.exportReturn = null;
  legacyState.exportContext = null;
  restoreExportSource(source);
  showMessage({ title: "Simulated export complete", text: `${paths.join("\n")}\nNo file was written. These markers only close the browser interaction flow.` });
}

function restoreAfterExportCancel() {
  const target = legacyState.exportReturn;
  legacyState.exportReturn = null;
  legacyState.exportContext = null;
  restoreExportSource(target);
}

function handleAction(action) {
  closeMenus();
  if (action === "open-edf") return openImportWizard();
  if (action === "open-conversion") return openConversionWizard();
  if (action === "about") return openAbout();
  if (action === "startup-states") return openStartupStateSimulator();
  if (action === "authorization") return openAuthorizationState();
  if (action === "update") return openUpdateDialog();
  if (action === "prototype-profile") return openProfileSwitcher();
  if (action === "recommend") return showMessage({ title: "Recommended system", text: "Recommended resolution: 1920×1080.\nUse a desktop browser for the closest PC-layout comparison." });
  if (action === "support") return showMessage({ title: "Support", text: "The PC application opens the Quanlan support site. This prototype does not navigate away automatically." });
  if (action === "open-log") return showMessage({ title: "Open the log", text: "Runtime log access is intentionally unavailable in the browser prototype." });
  if (action === "exit-app") return showMessage({ title: "Exit QLanalyser", text: "Close the current analysis session and exit?", kind: "warning", choices: [{ id: "cancel", label: "Cancel", primary: true }, { id: "exit", label: "Exit" }], onChoice: (choice) => { if (choice === "exit") setStatus("Exit confirmed in prototype state; browser tab remains open"); } });
  if (action === "save-data") {
    if (!requireFile(action)) return;
    return showMessage({ title: "Save data", text: "The PC save-to-EDF path is represented, but this prototype does not write a data file." });
  }
  if (action === "close-file") {
    if (!requireFile(action)) return;
    const running = [...legacyState.activeAnalysisModules];
    return showMessage({ title: "Close file", text: running.length ? `Close ${running.join(", ")} and then clear the current file context? Cancelling leaves every state unchanged.` : "Close the current data file and clear the current preprocessing state?", kind: "warning", choices: [{ id: "no", label: "No", primary: true }, { id: "yes", label: "Yes" }], onChoice: (choice) => {
      if (choice !== "yes") return;
      resetAllFileScopedState();
      if (!moduleBackdrop.hidden) closeModule();
      legacyState.file = null;
      legacyState.fileType = null;
      legacyState.pendingDroppedFile = null;
      legacyState.exportReturn = null;
      updateFileState();
      showToast("Current file context cleared");
    }});
  }
  if (action === "qeeg") {
    if (!requireFile(action)) return;
    window.location.href = "qeeg.html";
    return;
  }
  if (!requireFile(action)) return;
  if (action === "filter") return openFilter();
  if (action === "preview-rejection") return openEpochTool("reject");
  if (action === "data-select") return openDataSelect();
  if (["bandpower", "psd", "time-frequency", "activity"].includes(action)) return openBasicConfig(action);
  if (["emg", "ecg"].includes(action)) return openSignalWorkbench(action);
  if (action === "sleep") return openSleepWorkbench();
  if (["epilepsy-threshold", "epilepsy-ml"].includes(action)) return openEpilepsyWorkbench(action);
}

function handleDialogAction(action, control) {
  if (action === "cancel") return ["save-dialog", "cropped-edf-export"].includes(legacyState.currentModule) ? restoreAfterExportCancel() : requestCloseModule();
  if (action === "cancel-analysis") return cancelAnalysisTask(control.dataset.kind || legacyState.currentModule);
  if (action === "retry-analysis") return startAnalysisTask(control.dataset.kind || legacyState.currentModule);
  if (["module-first-page", "module-prev-page", "module-next-page", "module-last-page"].includes(action)) {
    const kind = control.dataset.kind || legacyState.currentModule;
    const state = activateLifecycleState(kind);
    if (!state) return;
    state.page = action === "module-first-page" ? 1 : action === "module-last-page" ? 2 : action === "module-prev-page" ? (state.page === 1 ? 2 : 1) : (state.page === 2 ? 1 : 2);
    return renderLifecycleModule(kind);
  }
  if (action === "browse-edf") return fileInput.click();
  if (action === "browse-folder") return folderInput.click();
  if (action === "wizard-next") {
    const path = document.querySelector("#import-path");
    const selected = fileInput.files[0] || legacyState.pendingDroppedFile;
    if (!selected) return showToast("Please choose an EDF or BDF file first");
    if (!/\.(edf|bdf)$/i.test(selected.name)) return showMessage({ title: "File Error", text: "Only EDF and BDF files are accepted.", kind: "warning" });
    const profileSelect = document.querySelector("#import-profile");
    const candidateProfile = profileSelect?.value || "research-4eeg-acc";
    const simulatedOutcome = document.querySelector("#import-outcome")?.value || "success";
    const sizeLimitMb = candidateProfile === "qeeg-23" ? 1024 : 800;
    if (selected.size > sizeLimitMb * 1048576) return showMessage({ title: "File Too Large", text: `The selected file exceeds the ${sizeLimitMb} MB limit for this channel branch.`, kind: "warning" });
    if (simulatedOutcome === "read-error") {
      legacyState.lastImportEvidence = { status: "rejected-read-error", executedMne: false, readSamples: false, rawCreated: false, rawProcessedCreated: false };
      return showMessage({ title: "File Read Error", text: "Simulated failure: the EDF/BDF header could not be read. The current file context remains unchanged.", kind: "danger" });
    }
    if (simulatedOutcome === "high-sampling") {
      legacyState.lastImportEvidence = { status: "rejected-high-sampling", samplingRate: 2048, executedMne: false, readSamples: false, rawCreated: false, rawProcessedCreated: false, copiedAnnotations: false };
      return showMessage({ title: "Unsupported Sampling Rate", text: "Simulated failure: the file reports 2048 Hz, above the PC limit of 1000 Hz. As in the PC rejection branch, raw and raw_processed remain cleared; no file context was created.", kind: "warning" });
    }
    moduleBody.innerHTML = `<div class="analysis-state loading-state"><div class="progress-spinner"></div><strong>One moment please</strong><span>Loading, please keep this window open...</span></div>`;
    window.setTimeout(() => finishPrototypeImport(selected, path, candidateProfile), 450);
    return;
  }
  if (action === "apply-profile") {
    legacyState.dataProfile = document.querySelector("#profile-switcher")?.value || "research-4eeg-acc";
    closeModule();
    updateFileState();
    return showToast(`Channel gate switched to ${activeProfile().label}`);
  }
  if (action === "remind-update") return closeModule();
  if (action === "update-now") return showToast("Updater is unavailable in the offline prototype");
  if (action === "startup-duplicate") {
    legacyState.startupEvidence.duplicateInstance = { mutexName: "QLANALYSER", predicate: "ERROR_ALREADY_EXISTS", exitCode: 0, createdSecondMainWindow: false, executedMutex: false, provenance: "browser simulation" };
    return showMessage({ title: "Notice", text: "The program is already running and will exit...", kind: "warning" });
  }
  if (action === "startup-auth-required") return openAuthorizationState();
  if (action === "startup-auth-failure") return showMessage({ title: "Authorization failed", text: "Simulated gate failure. The PC would stop before showing the main workspace.", kind: "danger" });
  if (action === "startup-auth-expired") return showMessage({ title: "Authorization expired", text: "Simulated expiry state. Analysis actions remain unavailable until a valid authorization is provided in the PC application.", kind: "warning" });
  if (action === "startup-auth-success") { closeModule(); return showToast("Simulated authorization success; no key was checked"); }
  if (action === "startup-direct-qeeg") return showMessage({ title: "QEEG parameter launch", text: "The PC can route command-line identity and EDF arguments directly to QEEG. This browser only records that launch branch; it does not consume identity arguments." });
  if (action === "startup-update-ready") return openUpdateDialog();
  if (action === "apply-crop") {
    const draft = readDataSelectDraft();
    if (!validateDataSelectDraft(draft)) return;
    legacyState.processing.crop = `${draft.startDate} ${draft.startTime} ~ ${draft.endDate} ${draft.endTime}`;
    closeModule();
    updateFileState();
    return showMessage({ title: "Data Cropped", text: "Data has been successfully cropped in prototype state. No source samples were changed." });
  }
  if (action === "export-cropped-edf") return openCroppedEdfExport();
  if (action === "confirm-cropped-edf-export" || action === "retry-cropped-edf-export") return runCroppedEdfExport();
  if (action === "confirm-export") {
    return runSimulatedExport();
  }
  if (action === "retry-export") return runSimulatedExport();
  if (action === "run-signal") {
    const kind = control.dataset.kind;
    const selectedChannel = document.querySelector("#special-channel")?.value;
    if (!selectedChannel) return showMessage({ title: "No Channel Selected", text: "Please select at least one channel!", kind: "warning" });
    if (!timeRangeIsValid()) return;
    legacyState.selectedSignalChannels[kind] = selectedChannel;
    return startAnalysisTask(kind);
  }
  if (action === "run-basic-workbench") {
    const kind = control.dataset.kind;
    const selectedChannels = document.querySelectorAll('input[name="basic-channel"]:checked').length;
    if (!selectedChannels) return showMessage({ title: "No Channel Selected", text: "Please select at least one channel!", kind: "warning" });
    if (!timeRangeIsValid()) return;
    if (kind === "activity") {
      const accCount = [...document.querySelectorAll('input[name="basic-channel"]:checked')].filter((input) => /ACC/.test(input.parentElement.textContent)).length;
      if (accCount !== 3) return showMessage({ title: "ACC Channel Error", text: "Activity analysis requires exactly three ACC channels.", kind: "warning" });
    }
    const lowInput = document.querySelector("#basic-low");
    const highInput = document.querySelector("#basic-high");
    if (lowInput && highInput && Number(lowInput.value) >= Number(highInput.value)) return showMessage({ title: "Frequency Error", text: "Low frequency must be lower than high frequency.", kind: "warning" });
    if (["bandpower", "time-frequency"].includes(kind) && !frequencyBandsAreValid()) return;
    openBasicWorkbench(kind, "progress");
    window.setTimeout(() => openBasicWorkbench(kind, "result"), 500);
    return;
  }
  if (action === "average-hr") return showMessage({ title: "Average HR · simulated", text: "72 bpm (deterministic demonstration value; not calculated from patient ECG)." });
  if (action === "open-hrv") {
    return startHrvTask(document.querySelector("#hrv-outcome")?.value);
  }
  if (action === "retry-hrv") return startHrvTask(document.querySelector("#hrv-outcome")?.value);
  if (action === "hrv-complete") {
    clearHrvTimer();
    legacyState.hrvState.phase = "result";
    legacyState.hrvState.failureKind = null;
    return openHrvWorkbench("result");
  }
  if (action === "run-sleep") {
    if (!timeRangeIsValid()) return;
    return startAnalysisTask("sleep");
  }
  if (action === "run-epilepsy") {
    const kind = control.dataset.kind || legacyState.currentModule;
    if (!timeRangeIsValid()) return;
    if (kind === "epilepsy-threshold") {
      const input = document.querySelector("#threshold-factor");
      const factor = Number(input?.value);
      const followsStep = Number.isInteger(Math.round(factor * 10)) && Math.abs(factor * 10 - Math.round(factor * 10)) < 1e-9;
      if (!Number.isFinite(factor) || factor < 1 || factor > 4 || !followsStep) {
        input?.focus();
        return showMessage({ title: "Threshold Factor Error", text: "Enter an STD threshold factor from 1.0 to 4.0 in 0.1 steps.", kind: "warning" });
      }
      lifecycleState(kind).thresholdFactor = factor;
    }
    return startAnalysisTask(kind);
  }
  if (action === "load-history") return showMessage({ title: "Load History", text: "The PC accepts a .cache history file. Browser persistence is not connected in this prototype." });
  if (action === "statistical-data") return showMessage({ title: "Sleep statistics · simulated", text: "Wake 18.4% · NREM 63.1% · REM 18.5% · Total fixture window 120 min. Demonstration values only; no model was executed." });
  if (action === "turn-epoch") {
    const value = Number(document.querySelector("#turn-epoch")?.value);
    if (!Number.isInteger(value) || value < 1 || value > 1440) return showMessage({ title: "Epoch Error", text: "Please enter an epoch number from 1 to 1440.", kind: "warning" });
    const state = activateLifecycleState(legacyState.currentModule);
    state.selectedEpoch = value;
    legacyState.selectedEpoch = value;
    return openEpilepsyWorkbench(legacyState.currentModule);
  }
  if (action === "select-epoch-range") {
    const start = Number(document.querySelector("#range-start-epoch")?.value);
    const end = Number(document.querySelector("#turn-epoch")?.value);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 1440 || start > end) return showMessage({ title: "Epoch Range Error", text: "Enter a valid epoch range from 1 to 1440.", kind: "warning" });
    const state = activateLifecycleState(legacyState.currentModule);
    state.selectedEpochs.clear();
    for (let epoch = start; epoch <= end; epoch += 1) state.selectedEpochs.add(epoch);
    state.epochAnchor = start;
    state.selectedEpoch = end;
    legacyState.epochAnchor = start;
    legacyState.selectedEpoch = end;
    showToast(`${state.selectedEpochs.size} epochs selected for batch correction`);
    return openEpilepsyWorkbench(legacyState.currentModule, "result");
  }
  if (action === "save-picture") return openSaveDialog("picture");
  if (action === "save-result-data") return openSaveDialog("data");
  if (action === "undo-rejection") {
    const epoch = legacyState.rejectionUndoStack.pop();
    if (epoch == null) return showToast("Nothing to undo");
    legacyState.rejectedEpochs.delete(epoch);
    legacyState.rejectionRedoStack.push(epoch);
    return openEpochTool("reject");
  }
  if (action === "redo-rejection") {
    const epoch = legacyState.rejectionRedoStack.pop();
    if (epoch == null) return showToast("Nothing to redo");
    legacyState.rejectedEpochs.add(epoch);
    legacyState.rejectionUndoStack.push(epoch);
    return openEpochTool("reject");
  }
  if (action === "epoch-first") { legacyState.epochPage = 1; return openEpochTool("reject"); }
  if (action === "epoch-last") { legacyState.epochPage = 15; return openEpochTool("reject"); }
  if (action === "conversion-next") {
    if (!folderInput.files.length) return showToast("Please choose a source folder first");
    const extensions = [...folderInput.files].map((file) => file.name.toLowerCase().split(".").pop());
    const hasEeg = extensions.includes("eeg");
    const hasAcc = extensions.includes("acc");
    const hasTri = extensions.includes("tri");
    if (!hasEeg || !hasAcc || !hasTri) return showMessage({ title: "Format Conversion", text: "The selected folder must contain matching .eeg, .acc and .tri files.", kind: "warning" });
    moduleBody.innerHTML = `<div class="analysis-state"><div class="progress-spinner"></div><strong>Converter backend unavailable</strong><span>Source files passed the UI validation, but the completed state remains locked until a backend reports success. No output is written.</span><button class="command" data-dialog-action="conversion-abort">Close</button></div>`;
    return;
  }
  if (action === "conversion-abort") {
    closeModule();
    return showMessage({ title: "Format Conversion", text: "Conversion aborted. No output file was written." });
  }
  if (action === "conversion-open-folder") return showMessage({ title: "Open folder", text: "No output folder exists because conversion was not executed." });
  if (action === "conversion-import") {
    closeModule();
    return showMessage({ title: "Format Conversion", text: "No converted EDF exists because file conversion is outside the HTML prototype boundary." });
  }
  if (action === "filter-back") return showToast("Back retains the current prototype values");
  if (action === "filter-apply") {
    const type = document.querySelector("#filter-type")?.value;
    const low = Number(document.querySelector("#filter-low")?.value);
    const high = Number(document.querySelector("#filter-high")?.value);
    const order = Number(document.querySelector("#filter-order")?.value);
    const cutoff = type === "Highpass" ? low : high;
    if (!Number.isFinite(cutoff) || cutoff <= 0 || (["Bandpass", "Notch"].includes(type) && (!Number.isFinite(low) || low <= 0 || high <= low))) return showToast("Enter a valid positive cutoff or low/high frequency range");
    const selectedSignals = document.querySelectorAll('input[name="filter-channel"]:checked').length;
    if (!selectedSignals) return showMessage({ title: "No Channel Selected", text: "Please select at least one channel!", kind: "warning" });
    const orderValid = ["Highpass", "Lowpass"].includes(type) ? Number.isInteger(order) && order >= 1 && order <= 12 : type === "Notch" ? Number.isInteger(order) && order >= 2 && order <= 8 && order % 2 === 0 : Number.isInteger(order) && order >= 2 && order <= 12 && order % 2 === 0;
    if (!orderValid) return showMessage({ title: "Filter Order Error", text: type === "Notch" ? "Notch order must be an even integer from 2 to 8." : ["Highpass", "Lowpass"].includes(type) ? "Highpass/Lowpass order must be an integer from 1 to 12." : "Bandpass order must be an even integer from 2 to 12.", kind: "warning" });
    if (cutoff >= legacyState.samplingRate / 2 || (["Bandpass", "Notch"].includes(type) && high >= legacyState.samplingRate / 2)) return showMessage({ title: "Frequency Error", text: `Frequency must be below Nyquist (${legacyState.samplingRate / 2} Hz).`, kind: "warning" });
    const range = type === "Highpass" ? `${low} Hz` : type === "Lowpass" ? `${high} Hz` : `${low}-${high} Hz`;
    legacyState.processing.filter = `${type} ${range}, Butterworth order ${order}`;
    closeModule();
    updateFileState();
    return showToast("Filter configuration recorded; no signal samples were modified");
  }
  if (action === "epoch-prev" || action === "epoch-next") {
    const next = legacyState.epochPage + (action === "epoch-prev" ? -1 : 1);
    legacyState.epochPage = next < 1 ? 15 : next > 15 ? 1 : next;
    return openEpochTool(legacyState.currentModule === "data-select" ? "select" : "reject");
  }
  if (action === "epoch-goto") {
    const page = Number(document.querySelector("#epoch-page")?.value);
    if (!Number.isInteger(page) || page < 1 || page > 15) return showMessage({ title: "Page Error", text: "Enter a page from 1 to 15.", kind: "warning" });
    legacyState.epochPage = page;
    return openEpochTool("reject");
  }
  if (["special-first", "special-prev", "special-next", "special-last"].includes(action)) {
    const kind = legacyState.currentModule;
    const state = activateLifecycleState(kind);
    const current = state.page;
    state.page = action === "special-first" ? 1 : action === "special-last" ? 2 : action === "special-prev" ? (current === 1 ? 2 : 1) : (current === 2 ? 1 : 2);
    legacyState.specialPages[kind] = state.page;
    return openSignalWorkbench(kind, "result");
  }
  if (action === "reject-epoch") {
    if (!legacyState.rejectedEpochs.has(legacyState.selectedEpoch)) legacyState.rejectionUndoStack.push(legacyState.selectedEpoch);
    legacyState.rejectedEpochs.add(legacyState.selectedEpoch);
    legacyState.rejectionRedoStack.length = 0;
    return openEpochTool("reject");
  }
  if (action === "cancel-reject") {
    legacyState.rejectedEpochs.delete(legacyState.selectedEpoch);
    return openEpochTool("reject");
  }
  if (action === "cancel-all-reject") {
    legacyState.rejectedEpochs.clear();
    return openEpochTool("reject");
  }
  if (action === "range-select") {
    legacyState.selectedEpochs.add(legacyState.selectedEpoch);
    return openEpochTool("select");
  }
  if (action === "reset-selection") {
    legacyState.selectedEpochs.clear();
    return openEpochTool("select");
  }
  if (action === "confirm-epochs") return showToast("Epoch changes confirmed in the current prototype state");
  if (action === "finish-epochs") {
    legacyState.processing.rejection = `${legacyState.rejectedEpochs.size} epoch(s) rejected`;
    closeModule();
    updateFileState();
    return showToast("Preprocessing selection retained in memory only");
  }
  if (action === "run-basic") return openBasicResult(control.dataset.kind);
  if (action === "analysis-back") {
    const kind = control.dataset.kind;
    return kind === "ecg" ? openSignalWorkbench(kind) : openBasicConfig(kind);
  }
  if (action === "reset-correction") {
    legacyState.classificationByEpoch.clear();
    legacyState.correctionUndoStack.length = 0;
    legacyState.correctionRedoStack.length = 0;
    if (legacyState.currentModule === "sleep") return openSleepWorkbench("result");
    if (["epilepsy-threshold", "epilepsy-ml"].includes(legacyState.currentModule)) return openEpilepsyWorkbench(legacyState.currentModule, "result");
    return openCorrection(legacyState.currentModule);
  }
  if (action === "undo-correction") {
    const edit = legacyState.correctionUndoStack.pop();
    if (!edit) return showToast("Nothing to undo");
    legacyState.classificationByEpoch.set(edit.epoch, edit.before);
    legacyState.correctionRedoStack.push(edit);
    if (legacyState.currentModule === "sleep") return openSleepWorkbench("result");
    return openEpilepsyWorkbench(legacyState.currentModule, "result");
  }
  if (action === "redo-correction") {
    const edit = legacyState.correctionRedoStack.pop();
    if (!edit) return showToast("Nothing to redo");
    legacyState.classificationByEpoch.set(edit.epoch, edit.after);
    legacyState.correctionUndoStack.push(edit);
    if (legacyState.currentModule === "sleep") return openSleepWorkbench("result");
    return openEpilepsyWorkbench(legacyState.currentModule, "result");
  }
  if (action === "confirm-correction") return showToast("Correction state confirmed in memory; no source data was changed");
  if (action === "export-figure" || action === "export-data") return openSaveDialog(action === "export-figure" ? "picture" : "data");
}

function finishPrototypeImport(selected, path, candidateProfile) {
  if (legacyState.currentModule !== "Data Import") return;
  resetAllFileScopedState();
  legacyState.dataProfile = candidateProfile;
  legacyState.file = selected;
  legacyState.fileType = selected.name.toLowerCase().endsWith(".bdf") ? "BDF" : "EDF";
  legacyState.pendingDroppedFile = null;
  const rememberedDirectory = rememberFixtureDirectory();
  legacyState.lastImportEvidence = {
    status: "fixture-loaded",
    fileType: legacyState.fileType,
    readerContract: legacyState.fileType === "BDF" ? "read_raw_bdf(..., preload=True)" : "read_raw_edf(..., preload=True)",
    executedMne: false,
    readSamples: false,
    convertedUnits: false,
    copiedAnnotations: false,
    rawCreated: false,
    rawProcessedCreated: false,
    rememberedDirectory,
  };
  if (path) path.value = selected.name;
  closeModule();
  updateFileState();
  showToast("File context loaded for UI demonstration; samples were not read");
}

document.querySelectorAll(".menu-trigger").forEach((trigger) => trigger.addEventListener("click", (event) => {
  event.stopPropagation();
  const menu = trigger.nextElementSibling;
  const shouldOpen = menu.hidden;
  closeMenus();
  menu.hidden = !shouldOpen;
  trigger.setAttribute("aria-expanded", String(shouldOpen));
}));

document.addEventListener("click", (event) => {
  const actionControl = event.target.closest("[data-action]");
  if (actionControl) handleAction(actionControl.dataset.action);
  if (!event.target.closest(".menu-root")) closeMenus();
});

document.querySelector("#drop-zone").addEventListener("click", openImportWizard);
document.querySelector("#drop-zone").addEventListener("dragover", (event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); });
document.querySelector("#drop-zone").addEventListener("dragleave", (event) => event.currentTarget.classList.remove("is-dragging"));
document.querySelector("#drop-zone").addEventListener("drop", (event) => {
  event.preventDefault();
  event.currentTarget.classList.remove("is-dragging");
  const files = [...event.dataTransfer.files];
  if (!files.length || files.some((item) => !/\.(edf|bdf)$/i.test(item.name))) return showMessage({ title: "File Error", text: "Every dropped item must be an EDF or BDF file.", kind: "warning" });
  legacyState.pendingDroppedFile = files[0];
  openImportWizard();
});

fileInput.addEventListener("change", () => {
  const selected = fileInput.files[0];
  const path = document.querySelector("#import-path");
  if (selected && path) path.value = selected.name;
});
folderInput.addEventListener("change", () => {
  const selected = folderInput.files[0];
  const path = document.querySelector("#conversion-path");
  if (selected && path) path.value = selected.webkitRelativePath?.split("/")[0] || "Selected folder";
});

moduleBody.addEventListener("click", (event) => {
  const epoch = event.target.closest("[data-epoch]");
  if (epoch) {
    legacyState.selectedEpoch = Number(epoch.dataset.epoch);
    return openEpochTool(legacyState.currentModule === "data-select" ? "select" : "reject");
  }
  const reviewEpoch = event.target.closest("[data-review-epoch]");
  if (reviewEpoch) {
    legacyState.selectedEpoch = Number(reviewEpoch.dataset.reviewEpoch);
    return openCorrection(legacyState.currentModule);
  }
  const classification = event.target.closest("[data-classification]");
  if (classification) {
    legacyState.classificationByEpoch.set(legacyState.selectedEpoch, classification.dataset.classification);
    return openCorrection(legacyState.currentModule);
  }
  const stage = event.target.closest("[data-stage]");
  if (stage) {
    applySleepStage(stage.dataset.stage);
    return;
  }
  const epilepsyLabel = event.target.closest("[data-epilepsy-label]");
  if (epilepsyLabel) {
    const state = activateLifecycleState(legacyState.currentModule);
    const after = epilepsyLabel.dataset.epilepsyLabel;
    const epochs = state.selectedEpochs.size ? [...state.selectedEpochs] : [state.selectedEpoch];
    const edits = epochs.map((epoch) => ({ epoch, before: state.classificationByEpoch.get(epoch) ?? "Normal", after }));
    state.undoStack.push(...edits);
    state.redoStack.length = 0;
    epochs.forEach((epoch) => state.classificationByEpoch.set(epoch, after));
    state.selectedEpochs.clear();
    return openEpilepsyWorkbench(legacyState.currentModule, "result");
  }
  const control = event.target.closest("[data-dialog-action]");
  if (control) handleDialogAction(control.dataset.dialogAction, control);
});

document.querySelector("#module-close").addEventListener("click", requestCloseModule);
document.querySelector("#message-actions").addEventListener("click", (event) => {
  const choice = event.target.closest("[data-message-choice]");
  if (choice) closeMessage(choice.dataset.messageChoice);
});

document.addEventListener("keydown", (event) => {
  const editableTarget = event.target instanceof HTMLElement && (event.target.matches("input, textarea, select") || event.target.isContentEditable);
  const sleepShortcutStage = event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
    ? ({ "1": "Wake", "2": "NREM", "3": "REM" })[event.key]
    : null;
  if (sleepShortcutStage && !editableTarget && legacyState.currentModule === "sleep" && lifecycleState("sleep")?.phase === "result") {
    event.preventDefault();
    applySleepStage(sleepShortcutStage);
    return;
  }
  if (event.key === "Escape") {
    if (!messageBackdrop.hidden) closeMessage("cancel");
    else if (!moduleBackdrop.hidden) requestCloseModule();
    else closeMenus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
    event.preventDefault();
    openImportWizard();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    handleAction("save-data");
  }
  if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) event.preventDefault();
});

document.addEventListener("wheel", (event) => {
  if (event.ctrlKey || event.metaKey) event.preventDefault();
}, { passive: false });

moduleBody.addEventListener("change", (event) => {
  if (event.target.id === "filter-type") renderFilterType();
  if (event.target.id === "analysis-outcome") {
    const state = lifecycleState(legacyState.currentModule);
    if (state) state.outcome = event.target.value;
  }
  if (event.target.id === "sleep-epoch-length") lifecycleState("sleep").epochLength = Number(event.target.value);
  if (event.target.id === "epilepsy-epoch-length") lifecycleState(legacyState.currentModule).epochLength = Number(event.target.value);
  if (event.target.id === "sleep-current-epoch") {
    const value = Number(event.target.value);
    if (!Number.isInteger(value) || value < 1 || value > 12) {
      return showMessage({ title: "Epoch Error", text: "Please enter a sleep fixture epoch from 1 to 12.", kind: "warning" });
    }
    const state = activateLifecycleState("sleep");
    state.selectedEpoch = value;
    legacyState.selectedEpoch = value;
    return openSleepWorkbench("result");
  }
  if (event.target.id === "hrv-outcome") legacyState.hrvState.outcome = event.target.value;
  if (event.target.id === "hrv-backend-scenario") {
    legacyState.hrvState.backendScenario = event.target.value;
    if (legacyState.currentModule === "ecg-hrv" && legacyState.hrvState.phase === "result") return openHrvWorkbench("result");
  }
  if (event.target.id === "export-outcome" && legacyState.exportContext) legacyState.exportContext.outcome = event.target.value;
  if (event.target.id === "filter-all") {
    moduleBody.querySelectorAll('input[name="filter-channel"]').forEach((input) => { input.checked = event.target.checked; });
  }
  if (event.target.id === "epilepsy-display" && event.target.value === "All") {
    showMessage({ title: "Performance notice", text: "Zooming with the scroll wheel may cause lag when displaying all epochs." });
  }
  if (event.target.id === "epoch-time-position") {
    legacyState.selectedEpoch = Number(event.target.value);
    legacyState.epochPage = Math.ceil(legacyState.selectedEpoch / 100);
    openEpochTool("reject");
  }
});

updateFileState();
