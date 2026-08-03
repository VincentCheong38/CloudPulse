const instances = [
  { id: "ap-sg-01", region: "Singapore", cpu: 35, memory: 50, storage: 45, network: 140 },
  { id: "us-va-02", region: "Virginia", cpu: 48, memory: 62, storage: 55, network: 120 },
  { id: "eu-fr-03", region: "Frankfurt", cpu: 30, memory: 42, storage: 38, network: 110 },
  { id: "au-sy-04", region: "Sydney", cpu: 56, memory: 70, storage: 64, network: 150 }
];

const metrics = ["cpu", "memory", "storage", "network"];
const thresholds = { cpu: 85, memory: 90, storage: 92, network: 280 };
let historyLength = 30;
let streamEnabled = true;
let selectedInstance = "all";
const history = {};
const alerts = [];
const incidents = [];
let uptimeScore = 99.95;
const derivedSeries = {};
let latestSnapshot = {};

const selectEl = document.getElementById("instanceFilter");
const rangeEl = document.getElementById("timeRange");
const toggleButton = document.getElementById("toggleStream");
const downloadButton = document.getElementById("downloadReport");
const lastUpdatedEl = document.getElementById("lastUpdated");
const alertList = document.getElementById("alertList");
const tableBody = document.getElementById("instanceTableBody");
const forecastList = document.getElementById("forecastList");
const incidentTimeline = document.getElementById("incidentTimeline");
const uptimeValue = document.getElementById("uptimeValue");
const budgetValue = document.getElementById("budgetValue");
const costValue = document.getElementById("costValue");
const optimizationHint = document.getElementById("optimizationHint");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

const thresholdInputs = {
  cpu: document.getElementById("cpuThreshold"),
  memory: document.getElementById("memoryThreshold"),
  storage: document.getElementById("storageThreshold"),
  network: document.getElementById("networkThreshold")
};

const valueEls = {
  cpu: document.getElementById("cpuValue"),
  memory: document.getElementById("memoryValue"),
  storage: document.getElementById("storageValue"),
  network: document.getElementById("networkValue"),
  requestRate: document.getElementById("requestRateValue"),
  errorRate: document.getElementById("errorRateValue"),
  latency: document.getElementById("latencyValue"),
  iops: document.getElementById("iopsValue"),
  queueDepth: document.getElementById("queueDepthValue"),
  throughput: document.getElementById("throughputValue"),
  packetLoss: document.getElementById("packetLossValue"),
  sessions: document.getElementById("sessionValue"),
  monthlySpend: document.getElementById("monthlySpendValue"),
  idleCost: document.getElementById("idleCostValue"),
  efficiencyScore: document.getElementById("efficiencyScoreValue"),
  savings: document.getElementById("savingsValue"),
  uptimeCard: document.getElementById("uptimeCardValue"),
  budgetCard: document.getElementById("budgetCardValue"),
  estimatedCostCard: document.getElementById("estimatedCostCardValue")
};

const chartConfig = {
  cpu: { max: 100, color: "#f97316", label: "CPU" },
  memory: { max: 100, color: "#22d3ee", label: "Memory" },
  storage: { max: 100, color: "#a78bfa", label: "Storage" },
  network: { max: 320, color: "#4ade80", label: "Network" },
  requestRate: { max: 1200, color: "#96a9ff", label: "Req Rate" },
  errorRate: { max: 10, color: "#ff9bb1", label: "Error Rate" },
  latency: { max: 450, color: "#fbbf24", label: "Latency" },
  iops: { max: 5000, color: "#7dd3fc", label: "IOPS" },
  queueDepth: { max: 45, color: "#f472b6", label: "Queue" },
  throughput: { max: 240, color: "#34d399", label: "Throughput" },
  packetLoss: { max: 6, color: "#fb7185", label: "Packet Loss" },
  sessions: { max: 5000, color: "#60a5fa", label: "Sessions" },
  uptime: { max: 100, color: "#22c55e", label: "Uptime" },
  budget: { max: 100, color: "#38bdf8", label: "Budget" },
  estimatedCost: { max: 9000, color: "#f59e0b", label: "Est Cost" },
  monthlySpend: { max: 9000, color: "#eab308", label: "Spend" },
  idleCost: { max: 2200, color: "#fb7185", label: "Idle Cost" },
  efficiencyScore: { max: 100, color: "#10b981", label: "Efficiency" },
  savings: { max: 1500, color: "#818cf8", label: "Savings" }
};

function randomDelta(scale) {
  return (Math.random() - 0.5) * scale;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function initHistory() {
  metrics.forEach((metric) => {
    history[metric] = [];
    for (let i = 0; i < historyLength; i += 1) {
      const average = getAggregateMetric(metric);
      history[metric].push(average);
    }
  });

  Object.keys(chartConfig).forEach((metric) => {
    derivedSeries[metric] = [];
  });
}

function getAggregateMetric(metric) {
  const total = instances.reduce((sum, instance) => sum + instance[metric], 0);
  return total / instances.length;
}

function getCurrentMetrics() {
  if (selectedInstance === "all") {
    return {
      cpu: getAggregateMetric("cpu"),
      memory: getAggregateMetric("memory"),
      storage: getAggregateMetric("storage"),
      network: getAggregateMetric("network")
    };
  }
  const instance = instances.find((item) => item.id === selectedInstance);
  return { ...instance };
}

function updateInstances() {
  instances.forEach((instance) => {
    instance.cpu = clamp(instance.cpu + randomDelta(16), 10, 100);
    instance.memory = clamp(instance.memory + randomDelta(12), 15, 100);
    instance.storage = clamp(instance.storage + randomDelta(5), 20, 100);
    instance.network = clamp(instance.network + randomDelta(40), 40, 320);
  });
}

function getStatus(instance) {
  if (
    instance.cpu > thresholds.cpu ||
    instance.memory > thresholds.memory ||
    instance.storage > thresholds.storage ||
    instance.network > thresholds.network
  ) {
    return "critical";
  }
  if (
    instance.cpu > thresholds.cpu - 10 ||
    instance.memory > thresholds.memory - 10 ||
    instance.storage > thresholds.storage - 10 ||
    instance.network > thresholds.network - 40
  ) {
    return "warn";
  }
  return "ok";
}

function renderInstanceTable() {
  tableBody.innerHTML = "";
  instances.forEach((instance) => {
    const status = getStatus(instance);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${instance.id} (${instance.region})</td>
      <td><span class="status ${status}">${status.toUpperCase()}</span></td>
      <td>${instance.cpu.toFixed(1)}%</td>
      <td>${instance.memory.toFixed(1)}%</td>
      <td>${instance.storage.toFixed(1)}%</td>
      <td>${instance.network.toFixed(1)} Mbps</td>
    `;
    tableBody.appendChild(row);
  });
}

function addAlert(message, type = "critical") {
  alerts.unshift({
    message,
    type,
    timestamp: new Date()
  });
  if (alerts.length > 25) {
    alerts.pop();
  }
  if (type === "critical") {
    incidents.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (incidents.length > 20) {
      incidents.pop();
    }
  }
}

function evaluateAlerts() {
  let criticalCount = 0;
  instances.forEach((instance) => {
    metrics.forEach((metric) => {
      if (instance[metric] > thresholds[metric]) {
        criticalCount += 1;
        addAlert(`${instance.id}: ${metric.toUpperCase()} exceeded threshold (${instance[metric].toFixed(1)}).`);
      }
    });
  });
  uptimeScore = clamp(uptimeScore - criticalCount * 0.002, 97.5, 99.99);
}

function renderAlerts() {
  alertList.innerHTML = "";
  if (!alerts.length) {
    const item = document.createElement("li");
    item.className = "info";
    item.textContent = "No active alerts. Monitoring all instances.";
    alertList.appendChild(item);
    return;
  }

  alerts.forEach((alert) => {
    const item = document.createElement("li");
    item.className = alert.type === "info" ? "info" : "";
    item.textContent = `[${alert.timestamp.toLocaleTimeString()}] ${alert.message}`;
    alertList.appendChild(item);
  });
}

function renderIncidents() {
  incidentTimeline.innerHTML = "";
  if (!incidents.length) {
    const item = document.createElement("li");
    item.textContent = "No critical incidents in current session.";
    incidentTimeline.appendChild(item);
    return;
  }
  incidents.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    incidentTimeline.appendChild(item);
  });
}

function updateValueCards() {
  const current = getCurrentMetrics();
  const requestRate = clamp(current.network * 2.8 + (100 - current.cpu), 80, 1200);
  const errorRate = clamp((current.cpu + current.memory) / 130 + Math.random() * 0.7, 0.1, 8);
  const latency = clamp(40 + current.cpu * 1.9 + current.memory * 1.2 + Math.random() * 12, 30, 420);
  const iops = clamp(300 + current.storage * 28 + Math.random() * 90, 200, 4800);
  const queueDepth = clamp((current.cpu + current.memory) / 11 + Math.random() * 2.5, 1, 40);
  const throughput = clamp(current.network * 0.52 + Math.random() * 8, 12, 220);
  const packetLoss = clamp((current.network > 250 ? 1.2 : 0.3) + Math.random() * 0.7, 0.05, 4.2);
  const sessions = Math.round(clamp(requestRate * 3.4 + Math.random() * 120, 120, 4500));
  const monthlySpend = clamp(1600 + current.cpu * 7 + current.memory * 5 + current.network * 3, 1400, 8200);
  const idleCost = clamp(monthlySpend * (current.cpu < 45 ? 0.22 : 0.1), 90, 1900);
  const efficiencyScore = clamp(100 - (current.cpu + current.memory + current.storage) / 4 - packetLoss * 4, 38, 96);
  const savings = clamp(idleCost * (efficiencyScore < 70 ? 0.45 : 0.25), 30, 1200);
  const budgetRemaining = clamp((99.99 - (100 - uptimeScore)) * 10, 8, 100);
  const estimatedCost = 1200 + current.cpu * 4 + current.memory * 3;

  latestSnapshot = {
    cpu: current.cpu,
    memory: current.memory,
    storage: current.storage,
    network: current.network,
    requestRate,
    errorRate,
    latency,
    iops,
    queueDepth,
    throughput,
    packetLoss,
    sessions,
    uptime: uptimeScore,
    budget: budgetRemaining,
    estimatedCost,
    monthlySpend,
    idleCost,
    efficiencyScore,
    savings
  };

  valueEls.cpu.textContent = `${current.cpu.toFixed(1)}%`;
  valueEls.memory.textContent = `${current.memory.toFixed(1)}%`;
  valueEls.storage.textContent = `${current.storage.toFixed(1)}%`;
  valueEls.network.textContent = `${current.network.toFixed(1)} Mbps`;
  valueEls.requestRate.textContent = `${requestRate.toFixed(0)} req/s`;
  valueEls.errorRate.textContent = `${errorRate.toFixed(2)}%`;
  valueEls.latency.textContent = `${latency.toFixed(0)} ms`;
  valueEls.iops.textContent = `${iops.toFixed(0)}`;
  valueEls.queueDepth.textContent = `${queueDepth.toFixed(1)}`;
  valueEls.throughput.textContent = `${throughput.toFixed(1)} MB/s`;
  valueEls.packetLoss.textContent = `${packetLoss.toFixed(2)}%`;
  valueEls.sessions.textContent = `${sessions}`;
  valueEls.monthlySpend.textContent = `$${monthlySpend.toFixed(0)}`;
  valueEls.idleCost.textContent = `$${idleCost.toFixed(0)}`;
  valueEls.efficiencyScore.textContent = `${efficiencyScore.toFixed(0)}/100`;
  valueEls.savings.textContent = `$${savings.toFixed(0)}`;
  valueEls.uptimeCard.textContent = `${uptimeScore.toFixed(3)}%`;
  valueEls.budgetCard.textContent = `${budgetRemaining.toFixed(1)}%`;
  valueEls.estimatedCostCard.textContent = `$${estimatedCost.toFixed(0)}`;
}

function updateHistory() {
  const current = getCurrentMetrics();
  metrics.forEach((metric) => {
    history[metric].push(current[metric]);
    if (history[metric].length > historyLength) {
      history[metric].shift();
    }
  });
}

function calculateForecast(series, points = 5) {
  const n = series.length;
  if (n < 2) {
    return Array.from({ length: points }, () => series[0] || 0);
  }
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i + 1;
    const y = series[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return Array.from({ length: points }, (_, index) => intercept + slope * (n + index + 1));
}

function renderForecast() {
  forecastList.innerHTML = "";
  const current = getCurrentMetrics();
  const forecast = {
    cpu: calculateForecast(history.cpu),
    memory: calculateForecast(history.memory),
    storage: calculateForecast(history.storage),
    network: calculateForecast(history.network)
  };
  for (let i = 0; i < 5; i += 1) {
    const item = document.createElement("li");
    item.textContent = `T+${i + 1}: CPU ${forecast.cpu[i].toFixed(1)}%, MEM ${forecast.memory[i].toFixed(1)}%, STO ${forecast.storage[i].toFixed(1)}%, NET ${forecast.network[i].toFixed(1)} Mbps`;
    forecastList.appendChild(item);
  }
  const avgCpu = current.cpu;
  const avgMem = current.memory;
  const estimatedCost = 1200 + avgCpu * 4 + avgMem * 3;
  const budgetRemaining = clamp((99.99 - (100 - uptimeScore)) * 10, 8, 100);
  costValue.textContent = `$${estimatedCost.toFixed(0)}`;
  uptimeValue.textContent = `${uptimeScore.toFixed(3)}%`;
  budgetValue.textContent = `${budgetRemaining.toFixed(1)}%`;

  if (avgCpu < 45 && avgMem < 55) {
    optimizationHint.textContent = "Rightsize idle instances for lower costs.";
  } else if (avgCpu > 80 || avgMem > 85) {
    optimizationHint.textContent = "Scale out compute group to prevent saturation.";
  } else {
    optimizationHint.textContent = "Current utilization is healthy.";
  }
}

function updateDerivedSeries() {
  Object.keys(chartConfig).forEach((metric) => {
    if (typeof latestSnapshot[metric] !== "number") {
      return;
    }
    derivedSeries[metric].push(latestSnapshot[metric]);
    if (derivedSeries[metric].length > historyLength) {
      derivedSeries[metric].shift();
    }
  });
}

function drawChart(ctx, series, maxValue, color) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((point, index) => {
    const x = (index / (series.length - 1)) * width;
    const y = height - (point / maxValue) * (height - 8) - 4;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function drawCombinedChart(canvasId, metricKeys) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#2a3d61";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  metricKeys.forEach((metric, idx) => {
    const cfg = chartConfig[metric];
    const series = metric in history ? history[metric] : derivedSeries[metric];
    if (!cfg || !series || series.length < 2) {
      return;
    }
    drawChart(ctx, series, cfg.max, cfg.color);
    const lx = 10 + idx * 92;
    const ly = 16;
    ctx.fillStyle = cfg.color;
    ctx.fillRect(lx, ly - 8, 10, 3);
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText(cfg.label, lx + 14, ly);
  });
}

function drawMiniMetricChart(canvasId, metric) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    return;
  }
  const cfg = chartConfig[metric];
  const series = metric in history ? history[metric] : derivedSeries[metric];
  if (!cfg || !series || series.length < 2) {
    return;
  }
  const ctx = canvas.getContext("2d");
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#243a5e";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  drawChart(ctx, series, cfg.max, cfg.color);
}

function renderCharts() {
  drawMiniMetricChart("cpuUsageMiniChart", "cpu");
  drawMiniMetricChart("memoryUsageMiniChart", "memory");
  drawMiniMetricChart("storageUsageMiniChart", "storage");
  drawMiniMetricChart("networkUsageMiniChart", "network");
  drawMiniMetricChart("requestRateMiniChart", "requestRate");
  drawMiniMetricChart("errorRateMiniChart", "errorRate");
  drawMiniMetricChart("latencyMiniChart", "latency");
  drawMiniMetricChart("iopsMiniChart", "iops");
  drawMiniMetricChart("queueDepthMiniChart", "queueDepth");
  drawMiniMetricChart("throughputMiniChart", "throughput");
  drawMiniMetricChart("packetLossMiniChart", "packetLoss");
  drawMiniMetricChart("sessionsMiniChart", "sessions");
  drawMiniMetricChart("uptimeMiniChart", "uptime");
  drawMiniMetricChart("budgetMiniChart", "budget");
  drawMiniMetricChart("estimatedCostMiniChart", "estimatedCost");
  drawMiniMetricChart("monthlySpendMiniChart", "monthlySpend");
  drawMiniMetricChart("idleCostMiniChart", "idleCost");
  drawMiniMetricChart("efficiencyScoreMiniChart", "efficiencyScore");
  drawMiniMetricChart("savingsMiniChart", "savings");
}

function tick() {
  if (!streamEnabled) {
    return;
  }
  updateInstances();
  evaluateAlerts();
  updateHistory();
  updateValueCards();
  updateDerivedSeries();
  renderInstanceTable();
  renderAlerts();
  renderIncidents();
  renderCharts();
  renderForecast();
  lastUpdatedEl.textContent = `Last update: ${new Date().toLocaleTimeString()}`;
}

function generateReport() {
  const snapshot = getCurrentMetrics();
  const lines = [
    "CloudPulse Performance Report",
    `Generated: ${new Date().toISOString()}`,
    `Scope: ${selectedInstance === "all" ? "All Instances" : selectedInstance}`,
    "",
    "Current Metrics:",
    `- CPU Usage: ${snapshot.cpu.toFixed(1)}%`,
    `- Memory Usage: ${snapshot.memory.toFixed(1)}%`,
    `- Storage Usage: ${snapshot.storage.toFixed(1)}%`,
    `- Network Traffic: ${snapshot.network.toFixed(1)} Mbps`,
    "",
    "Instance Status Overview:"
  ];

  instances.forEach((instance) => {
    lines.push(
      `- ${instance.id} (${instance.region}) | ${getStatus(instance).toUpperCase()} | CPU ${instance.cpu.toFixed(1)}% | Memory ${instance.memory.toFixed(1)}% | Storage ${instance.storage.toFixed(1)}% | Network ${instance.network.toFixed(1)} Mbps`
    );
  });

  lines.push("", "Recent Alerts:");
  if (alerts.length === 0) {
    lines.push("- No alerts in current session.");
  } else {
    alerts.slice(0, 10).forEach((alert) => lines.push(`- [${alert.timestamp.toISOString()}] ${alert.message}`));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cloudpulse-report-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function setupControls() {
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Instances";
  selectEl.appendChild(allOption);

  instances.forEach((instance) => {
    const option = document.createElement("option");
    option.value = instance.id;
    option.textContent = `${instance.id} (${instance.region})`;
    selectEl.appendChild(option);
  });

  selectEl.addEventListener("change", (event) => {
    selectedInstance = event.target.value;
    addAlert(`View changed to ${selectedInstance === "all" ? "All Instances" : selectedInstance}.`, "info");
    updateHistory();
    updateValueCards();
    updateDerivedSeries();
    renderCharts();
    renderAlerts();
    renderForecast();
  });

  rangeEl.addEventListener("change", (event) => {
    historyLength = Number(event.target.value);
    initHistory();
    updateHistory();
    updateValueCards();
    updateDerivedSeries();
    renderCharts();
    renderForecast();
    addAlert(`Time range updated to last ${historyLength} secs.`, "info");
    renderAlerts();
  });

  toggleButton.addEventListener("click", () => {
    streamEnabled = !streamEnabled;
    toggleButton.textContent = streamEnabled ? "Pause Stream" : "Resume Stream";
    addAlert(streamEnabled ? "Live stream resumed." : "Live stream paused.", "info");
    renderAlerts();
  });

  metrics.forEach((metric) => {
    thresholdInputs[metric].addEventListener("input", (event) => {
      thresholds[metric] = Number(event.target.value);
      addAlert(`${metric.toUpperCase()} threshold set to ${thresholds[metric]}.`, "info");
      renderAlerts();
    });
  });

  downloadButton.addEventListener("click", generateReport);

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tabTarget;
      tabButtons.forEach((item) => item.classList.remove("active"));
      tabPanels.forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      const panel = document.querySelector(`[data-tab-panel="${target}"]`);
      if (panel) {
        panel.classList.add("active");
      }
    });
  });

}

setupControls();
initHistory();
updateValueCards();
updateDerivedSeries();
renderInstanceTable();
renderAlerts();
renderIncidents();
renderCharts();
renderForecast();
tick();
setInterval(tick, 1000);
