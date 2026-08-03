(function () {
  const HISTORY_PERIODS = ["daily", "weekly", "monthly"];
  let selectedHistoryPeriod = "daily";

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function startOfLocalDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function formatLongDate(date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatShortMonthDay(date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatPeriodRange(start, end) {
    const sameYear = start.getFullYear() === end.getFullYear();
    if (sameYear) {
      return `${formatShortMonthDay(start)} – ${formatLongDate(end)}`;
    }
    return `${formatLongDate(start)} – ${formatLongDate(end)}`;
  }

  function buildMonthWeekDateRanges(monthStart, monthEnd) {
    const ranges = [];
    let cursor = monthStart;
    let weekNum = 1;
    while (cursor <= monthEnd) {
      const weekEnd = addDays(cursor, 6);
      const actualEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
      ranges.push({
        label: `Week ${weekNum}`,
        date: `${formatShortMonthDay(cursor)} – ${formatShortMonthDay(actualEnd)}`
      });
      cursor = addDays(actualEnd, 1);
      weekNum += 1;
    }
    return ranges;
  }

  function getSampleHistory() {
    const today = startOfLocalDay(new Date());
    const todayLong = formatLongDate(today);
    const weekStart = addDays(today, -6);
    const weekRange = formatPeriodRange(weekStart, today);
    const monthStart = addDays(today, -29);
    const monthRange = formatPeriodRange(monthStart, today);
    const monthWeekRanges = buildMonthWeekDateRanges(monthStart, today);

    const weeklyFleetMetrics = [
      { cpu: 40.2, memory: 56.8, uptime: 99.93, spend: 578, alerts: 2 },
      { cpu: 41.5, memory: 57.1, uptime: 99.9, spend: 592, alerts: 3 },
      { cpu: 43.8, memory: 59.4, uptime: 99.88, spend: 601, alerts: 4 },
      { cpu: 44.6, memory: 60.2, uptime: 99.87, spend: 615, alerts: 5 },
      { cpu: 39.6, memory: 55.2, uptime: 99.99, spend: 589, alerts: 1 },
      { cpu: 41.8, memory: 57.4, uptime: 99.94, spend: 598, alerts: 5 },
      { cpu: 44.2, memory: 61.1, uptime: 99.97, spend: 612, alerts: 3 }
    ];

    const monthlyFleetMetrics = [
      { cpu: 40.8, memory: 56.2, uptime: 99.9, spend: 4120, alerts: 12 },
      { cpu: 41.9, memory: 57.8, uptime: 99.89, spend: 4285, alerts: 15 },
      { cpu: 42.5, memory: 58.4, uptime: 99.92, spend: 4398, alerts: 11 },
      { cpu: 43.1, memory: 59.1, uptime: 99.91, spend: 4512, alerts: 14 },
      { cpu: 42.0, memory: 58.5, uptime: 99.95, spend: 1705, alerts: 6 }
    ];

    return {
    daily: {
      periodBadge: `Daily · ${todayLong}`,
      title: "Daily History Report",
      narrative:
        `Today (${todayLong}): fleet averaged 44.2% CPU and 61.1% memory with 99.97% uptime and $612 estimated spend across 4 instances.`,
      summaryLabels: {
        cpu: "Today's Avg CPU",
        memory: "Today's Avg Memory",
        uptime: "Today's Uptime",
        spend: "Today's Spend"
      },
      summary: { avgCpu: "44.2%", avgMemory: "61.1%", uptime: "99.97%", spend: "$612" },
      fleetTitle: "Hourly Breakdown",
      fleetColumns: ["Time Window", "CPU", "Memory", "Uptime", "Spend", "Alerts"],
      fleetRows: [
        { label: "00:00 – 06:00", cpu: 32.4, memory: 48.2, uptime: 99.99, spend: 142, alerts: 0 },
        { label: "06:00 – 12:00", cpu: 41.8, memory: 56.7, uptime: 99.98, spend: 168, alerts: 1 },
        { label: "12:00 – 18:00", cpu: 52.3, memory: 68.4, uptime: 99.95, spend: 198, alerts: 2 },
        { label: "18:00 – 24:00", cpu: 44.1, memory: 59.3, uptime: 99.96, spend: 80, alerts: 0 }
      ],
      instanceTitle: "Instance Snapshots (Today)",
      instanceColumns: ["Instance", "CPU", "Memory", "Storage", "Network", "Peak CPU", "Status"],
      instanceRows: [
        { id: "ap-sg-01", region: "Singapore", cpu: 38.5, memory: 52.1, storage: 47.3, network: 148, extra: "72.4%", status: "ok" },
        { id: "us-va-02", region: "Virginia", cpu: 46.2, memory: 64.8, storage: 56.1, network: 132, extra: "81.3%", status: "warn" },
        { id: "eu-fr-03", region: "Frankfurt", cpu: 33.7, memory: 45.9, storage: 39.8, network: 118, extra: "58.2%", status: "ok" },
        { id: "au-sy-04", region: "Sydney", cpu: 54.1, memory: 71.2, storage: 65.4, network: 156, extra: "88.7%", status: "critical" }
      ],
      eventsTitle: "Today's Events",
      events: [
        { date: todayLong, time: "08:42", instance: "us-va-02", type: "warning", message: "Memory usage spiked to 78% during nightly batch export." },
        { date: todayLong, time: "06:15", instance: "au-sy-04", type: "critical", message: "CPU exceeded threshold (88.7%) — autoscale policy triggered." },
        { date: todayLong, time: "02:30", instance: "ap-sg-01", type: "info", message: "Nightly backup completed successfully across all volumes." }
      ]
    },
    weekly: {
      periodBadge: `Weekly · ${weekRange}`,
      title: "Weekly History Report",
      narrative:
        `Last 7 days (${weekRange}): fleet averaged 42.1% CPU and 58.9% memory with 99.91% uptime and $4,124 total spend.`,
      summaryLabels: {
        cpu: "7-Day Avg CPU",
        memory: "7-Day Avg Memory",
        uptime: "7-Day Uptime",
        spend: "7-Day Spend"
      },
      summary: { avgCpu: "42.1%", avgMemory: "58.9%", uptime: "99.91%", spend: "$4,124" },
      fleetTitle: "Daily Breakdown",
      fleetColumns: ["Day", "Date", "CPU", "Memory", "Uptime", "Spend", "Alerts"],
      fleetRows: weeklyFleetMetrics.map((metrics, index) => {
        const day = addDays(weekStart, index);
        return {
          label: DAY_NAMES[day.getDay()],
          date: formatShortMonthDay(day),
          ...metrics
        };
      }),
      instanceTitle: "Instance Snapshots (This Week)",
      instanceColumns: ["Instance", "CPU", "Memory", "Storage", "Network", "Incidents", "Status"],
      instanceRows: [
        { id: "ap-sg-01", region: "Singapore", cpu: 37.2, memory: 51.4, storage: 46.8, network: 142, extra: "1", status: "ok" },
        { id: "us-va-02", region: "Virginia", cpu: 45.1, memory: 63.5, storage: 55.4, network: 128, extra: "3", status: "warn" },
        { id: "eu-fr-03", region: "Frankfurt", cpu: 34.8, memory: 46.2, storage: 40.1, network: 115, extra: "0", status: "ok" },
        { id: "au-sy-04", region: "Sydney", cpu: 52.6, memory: 69.8, storage: 64.2, network: 152, extra: "4", status: "critical" }
      ],
      eventsTitle: "This Week's Events",
      events: [
        { date: formatLongDate(today), time: "08:42", instance: "us-va-02", type: "warning", message: "Memory usage spiked to 78% during nightly batch export." },
        { date: formatLongDate(addDays(today, -1)), time: "22:08", instance: "ap-sg-01", type: "info", message: "Scheduled maintenance window completed with no downtime." },
        { date: formatLongDate(addDays(today, -1)), time: "14:33", instance: "eu-fr-03", type: "info", message: "Cold storage tier migration finished — 12% cost reduction projected." },
        { date: formatLongDate(addDays(today, -2)), time: "11:20", instance: "us-va-02", type: "warning", message: "Network traffic peaked at 298 Mbps during marketing campaign launch." },
        { date: formatLongDate(addDays(today, -3)), time: "03:45", instance: "au-sy-04", type: "critical", message: "Error budget dropped below 15% after latency SLO breach." },
        { date: formatLongDate(addDays(today, -5)), time: "16:02", instance: "ap-sg-01", type: "info", message: "Rightsizing recommendation applied — instance class downgraded." }
      ]
    },
    monthly: {
      periodBadge: `Monthly · ${monthRange}`,
      title: "Monthly History Report",
      narrative:
        `Last 30 days (${monthRange}): fleet averaged 42.3% CPU and 58.7% memory with 99.912% uptime and $18,420 total spend.`,
      summaryLabels: {
        cpu: "30-Day Avg CPU",
        memory: "30-Day Avg Memory",
        uptime: "30-Day Uptime",
        spend: "30-Day Spend"
      },
      summary: { avgCpu: "42.3%", avgMemory: "58.7%", uptime: "99.912%", spend: "$18,420" },
      fleetTitle: "Weekly Rollup",
      fleetColumns: ["Week", "Date Range", "CPU", "Memory", "Uptime", "Spend", "Alerts"],
      fleetRows: monthWeekRanges.map((range, index) => ({
        ...range,
        ...(monthlyFleetMetrics[index] || monthlyFleetMetrics[monthlyFleetMetrics.length - 1])
      })),
      instanceTitle: "Instance Snapshots (This Month)",
      instanceColumns: ["Instance", "CPU", "Memory", "Storage", "Network", "SLO Status", "Status"],
      instanceRows: [
        { id: "ap-sg-01", region: "Singapore", cpu: 38.1, memory: 51.8, storage: 47.0, network: 145, extra: "Met", status: "ok", sloClass: "ok" },
        { id: "us-va-02", region: "Virginia", cpu: 44.8, memory: 62.9, storage: 55.8, network: 130, extra: "At Risk", status: "warn", sloClass: "warn" },
        { id: "eu-fr-03", region: "Frankfurt", cpu: 35.2, memory: 46.5, storage: 39.5, network: 116, extra: "Met", status: "ok", sloClass: "ok" },
        { id: "au-sy-04", region: "Sydney", cpu: 51.4, memory: 68.6, storage: 63.8, network: 154, extra: "Breached", status: "critical", sloClass: "critical" }
      ],
      eventsTitle: "This Month's Events",
      events: [
        { date: formatLongDate(today), time: "08:42", instance: "us-va-02", type: "warning", message: "Memory usage spiked to 78% during nightly batch export." },
        { date: formatLongDate(addDays(today, -3)), time: "03:45", instance: "au-sy-04", type: "critical", message: "Error budget dropped below 15% after latency SLO breach." },
        { date: formatLongDate(addDays(today, -15)), time: "09:15", instance: "us-va-02", type: "warning", message: "Sustained high network utilization during regional failover test." },
        { date: formatLongDate(addDays(today, -21)), time: "17:40", instance: "eu-fr-03", type: "info", message: "Reserved instance commitment renewed for 12-month term." },
        { date: formatLongDate(addDays(today, -28)), time: "01:12", instance: "ap-sg-01", type: "critical", message: "Storage threshold exceeded — volume expansion completed automatically." }
      ]
    }
  };
  }

  function renderHistoryFleetRows(report) {
    return report.fleetRows
      .map((row) => {
        const dateCell = row.date ? `<td>${row.date}</td>` : "";
        return `
        <tr>
          <td>${row.label}</td>
          ${dateCell}
          <td>${row.cpu.toFixed(1)}%</td>
          <td>${row.memory.toFixed(1)}%</td>
          <td>${row.uptime.toFixed(2)}%</td>
          <td>$${row.spend.toLocaleString()}</td>
          <td>${row.alerts}</td>
        </tr>
      `;
      })
      .join("");
  }

  function renderHistoryInstanceRows(report) {
    return report.instanceRows
      .map((row) => {
        const extraContent = row.sloClass
          ? `<span class="status ${row.sloClass}">${row.extra}</span>`
          : row.extra;
        return `
        <tr>
          <td>${row.id} (${row.region})</td>
          <td>${row.cpu.toFixed(1)}%</td>
          <td>${row.memory.toFixed(1)}%</td>
          <td>${row.storage.toFixed(1)}%</td>
          <td>${row.network.toFixed(1)} Mbps</td>
          <td>${extraContent}</td>
          <td><span class="status ${row.status}">${row.status.toUpperCase()}</span></td>
        </tr>
      `;
      })
      .join("");
  }

  function renderHistoryEventItems(report) {
    return report.events
      .map(
        (event) =>
          `<li class="event-${event.type}"><strong>${event.date} ${event.time}</strong> · ${event.instance} — ${event.message}</li>`
      )
      .join("");
  }

  function renderHistoryTableHeadHtml(columns) {
    return `<tr>${columns.map((col) => `<th>${col}</th>`).join("")}</tr>`;
  }

  function buildHistoryReportHtml(report) {
    return `
    <div class="history-report-view" data-history-view="${report.period}">
      <section class="card narrative-card">
        <h2>${report.title}</h2>
        <p>${report.narrative}</p>
      </section>

      <section class="summary-grid">
        <article class="card"><h2>${report.summaryLabels.cpu}</h2><p class="value">${report.summary.avgCpu}</p></article>
        <article class="card"><h2>${report.summaryLabels.memory}</h2><p class="value">${report.summary.avgMemory}</p></article>
        <article class="card"><h2>${report.summaryLabels.uptime}</h2><p class="value">${report.summary.uptime}</p></article>
        <article class="card"><h2>${report.summaryLabels.spend}</h2><p class="value">${report.summary.spend}</p></article>
      </section>

      <section class="history-grid">
        <article class="card">
          <h2>${report.fleetTitle}</h2>
          <table>
            <thead>${renderHistoryTableHeadHtml(report.fleetColumns)}</thead>
            <tbody>${renderHistoryFleetRows(report)}</tbody>
          </table>
        </article>
        <article class="card">
          <h2>${report.instanceTitle}</h2>
          <table>
            <thead>${renderHistoryTableHeadHtml(report.instanceColumns)}</thead>
            <tbody>${renderHistoryInstanceRows(report)}</tbody>
          </table>
        </article>
      </section>

      <section class="card">
        <h2>${report.eventsTitle}</h2>
        <ul class="history-event-list">${renderHistoryEventItems(report)}</ul>
      </section>
    </div>
  `;
  }

  function switchHistoryReport(period) {
    if (!HISTORY_PERIODS.includes(period)) {
      period = "daily";
    }

    selectedHistoryPeriod = period;

    const container = document.getElementById("historyReportContainer");
    const report = getSampleHistory()[period];
    if (!container || !report) {
      return;
    }

    const select = document.getElementById("historyReportSelect");
    if (select && select.value !== period) {
      select.value = period;
    }

    const badge = document.getElementById("historyPeriodBadge");
    if (badge) {
      badge.textContent = report.periodBadge;
    }

    container.innerHTML = buildHistoryReportHtml({ ...report, period });
  }

  let initialized = false;

  function initHistoryReports() {
    const select = document.getElementById("historyReportSelect");
    if (!select) {
      return;
    }

    if (!initialized) {
      select.addEventListener("change", (event) => {
        switchHistoryReport(event.target.value);
      });

      document.querySelector(".tab-nav")?.addEventListener("click", (event) => {
        const button = event.target.closest(".tab-btn");
        if (button?.dataset.tabTarget === "history") {
          switchHistoryReport(select.value || selectedHistoryPeriod);
        }
      });

      initialized = true;
    }

    switchHistoryReport(select.value || "daily");
  }

  window.CloudPulseHistory = { switchHistoryReport, init: initHistoryReports };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHistoryReports);
  } else {
    initHistoryReports();
  }
})();
