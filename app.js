// Chart defaults
Chart.defaults.color = "#cbd5e1";
Chart.defaults.font.family = "Poppins, system-ui, sans-serif";
Chart.defaults.font.size = 12;

// Toast helper
const toastContainer = document.createElement("div");
toastContainer.id = "toast-container";
document.body.appendChild(toastContainer);

function showToast(message, type = "info", ttl = 2500) {
  const el = document.createElement("div");
  el.className = "toast " + (type === "success" ? "success" : type === "warn" ? "warn" : "");
  el.textContent = message;
  toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));

  const hideDelay = Math.max(500, ttl - 300);
  setTimeout(() => {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 300);
  }, hideDelay);
}

// SweetAlert helper
function showSwal(title, text, icon = "success") {
  if (typeof Swal === "undefined") return showToast(text || title, icon === "success" ? "success" : "warn");
  Swal.fire({
    title,
    text,
    icon,
    confirmButtonColor: "#22c55e",
    background: "rgba(4,7,15,0.95)",
    color: "#e5e7eb"
  });
}

// ============== WAKTU & STATUS ==============
function formatTime(date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

const startTime = new Date();
let timingTimer;

function refreshTiming() {
  const now = new Date();
  const diffH = Math.floor((now - startTime) / (1000 * 60 * 60));
  document.getElementById("uptime-label").textContent = "Berjalan " + diffH + " jam";
  document.getElementById("last-check").textContent = formatTime(now);
}

function startTiming() {
  refreshTiming();
  timingTimer = setInterval(refreshTiming, 60000);
}

// ============== DATA SIMULASI ==============
let totalEggs = 0;
let fertilEggs = 0;
let infertilEggs = 0;
let lastMinuteCounts = [];
let eggsThisMinute = 0;
let scanIntervalMs = 2500;
let probHasEgg = 0.7;
let probFertil = 0.65;
let simInterval;
let throughputInterval;

const responseLabels = [];
const responseSeries = [];
const hourlyBuckets = {};

// ============== KPI ==============
function updateKPI() {
  const totalSpan = document.getElementById("total-eggs");
  const fertilSpan = document.getElementById("fertil-eggs");
  const infertilSpan = document.getElementById("infertil-eggs");
  const fertilP = document.getElementById("fertil-percent");
  const infertilP = document.getElementById("infertil-percent");
  const scanSpeed = document.getElementById("scan-speed");

  totalSpan.textContent = totalEggs;
  fertilSpan.textContent = fertilEggs;
  infertilSpan.textContent = infertilEggs;

  const percentFertil = totalEggs === 0 ? 0 : Math.round((fertilEggs / totalEggs) * 100);
  const percentInfertil = totalEggs === 0 ? 0 : Math.round((infertilEggs / totalEggs) * 100);

  fertilP.textContent = percentFertil + "%";
  infertilP.textContent = percentInfertil + "%";

  const sumLast = lastMinuteCounts.reduce((a, b) => a + b, 0);
  const avg = lastMinuteCounts.length > 0 ? sumLast / lastMinuteCounts.length : 0;
  scanSpeed.textContent = avg.toFixed(1) + " / menit";
}

// ============== GRAFIK: DOUGHNUT ==============
const eggCtx = document.getElementById("eggChart").getContext("2d");

const eggChart = new Chart(eggCtx, {
  type: "doughnut",
  data: {
    labels: ["Fertil", "Infertil"],
    datasets: [
      {
        data: [0, 0],
        backgroundColor: ["#41c8ff", "#f87171"],
        borderWidth: 0,
        hoverOffset: 4
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(8, 12, 22, 0.85)",
        borderColor: "rgba(120, 144, 180, 0.5)",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.raw || 0;
            const total = fertilEggs + infertilEggs || 1;
            const percent = Math.round((value / total) * 100);
            return label + ": " + value + " telur (" + percent + "%)";
          }
        }
      }
    },
    cutout: "68%",
    layout: {
      padding: 8
    }
  }
});

function updateEggChart() {
  eggChart.data.datasets[0].data = [fertilEggs, infertilEggs];
  eggChart.update();
}

// ============== GRAFIK: LINE (RESPON WAKTU) ==============
const responseCtx = document.getElementById("responseChart").getContext("2d");

const responseChart = new Chart(responseCtx, {
  type: "line",
  data: {
    labels: responseLabels,
    datasets: [
      {
        label: "Response (ms)",
        data: responseSeries,
        borderColor: "#41c8ff",
        backgroundColor: "rgba(65, 200, 255, 0.12)",
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(8, 12, 22, 0.85)",
        borderColor: "rgba(120, 144, 180, 0.5)",
        borderWidth: 1,
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(148, 163, 184, 0.15)" },
        ticks: { maxTicksLimit: 6 }
      },
      y: {
        beginAtZero: true,
        suggestedMax: 300,
        grid: { color: "rgba(148, 163, 184, 0.15)" }
      }
    }
  }
});

function pushResponse(ms) {
  const label = formatTime(new Date());
  responseLabels.push(label);
  responseSeries.push(ms);
  if (responseLabels.length > 12) {
    responseLabels.shift();
    responseSeries.shift();
  }
  responseChart.update();
}

// ============== GRAFIK: BAR (OUTPUT PER JAM) ==============
const batchCtx = document.getElementById("batchChart").getContext("2d");

const batchChart = new Chart(batchCtx, {
  type: "bar",
  data: {
    labels: [],
    datasets: [
      {
        label: "Fertil",
        data: [],
        backgroundColor: "rgba(65, 200, 255, 0.65)",
        borderRadius: 10,
        maxBarThickness: 32,
        borderSkipped: false
      },
      {
        label: "Infertil",
        data: [],
        backgroundColor: "rgba(248, 113, 113, 0.65)",
        borderRadius: 10,
        maxBarThickness: 32,
        borderSkipped: false
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: "rgba(8, 12, 22, 0.85)",
        borderColor: "rgba(120, 144, 180, 0.5)",
        borderWidth: 1,
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(148, 163, 184, 0.12)" }
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.12)" }
      }
    }
  }
});

function updateBatchChart() {
  const labels = Object.keys(hourlyBuckets).slice(-6);
  const fertilData = labels.map((l) => hourlyBuckets[l].fertil || 0);
  const infertilData = labels.map((l) => hourlyBuckets[l].infertil || 0);
  batchChart.data.labels = labels;
  batchChart.data.datasets[0].data = fertilData;
  batchChart.data.datasets[1].data = infertilData;
  batchChart.update();
}

function bumpHourly(isFertil) {
  const hourKey = new Date().getHours().toString().padStart(2, "0") + ":00";
  if (!hourlyBuckets[hourKey]) {
    hourlyBuckets[hourKey] = { fertil: 0, infertil: 0 };
  }
  if (isFertil) {
    hourlyBuckets[hourKey].fertil += 1;
  } else {
    hourlyBuckets[hourKey].infertil += 1;
  }
  updateBatchChart();
}

// ============== GRAFIK: STATISTIK (HISTORIS & LINE COMPARE) ==============
const historyCtx = document.getElementById("historyChart")?.getContext("2d");
const lineCompareCtx = document.getElementById("lineCompareChart")?.getContext("2d");

const historyData = {
  labels: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
  totals: [320, 340, 310, 360, 400, 380, 390]
};

const lineCompareData = {
  labels: ["M1", "M2", "M3", "M4"],
  line1: [2300, 2450, 2380, 2520],
  line2: [2100, 2320, 2290, 2400]
};

let historyChart;
let lineCompareChart;
let logHistory = [];

function initStatsCharts() {
  if (historyCtx) {
    historyChart = new Chart(historyCtx, {
      type: "line",
      data: {
        labels: historyData.labels,
        datasets: [
          {
            label: "Total Telur",
            data: historyData.totals,
            borderColor: "#41c8ff",
            backgroundColor: "rgba(65, 200, 255, 0.14)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { color: "rgba(148, 163, 184, 0.15)" } },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148, 163, 184, 0.15)" }
          }
        }
      }
    });
  }

  if (lineCompareCtx) {
    lineCompareChart = new Chart(lineCompareCtx, {
      type: "line",
      data: {
        labels: lineCompareData.labels,
        datasets: [
          {
            label: "Line 1",
            data: lineCompareData.line1,
            borderColor: "#3ce780",
            backgroundColor: "rgba(60, 231, 128, 0.14)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: "Line 2",
            data: lineCompareData.line2,
            borderColor: "#41c8ff",
            backgroundColor: "rgba(65, 200, 255, 0.12)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { usePointStyle: true, pointStyle: "circle", padding: 14 }
          }
        },
        scales: {
          x: { grid: { color: "rgba(148, 163, 184, 0.15)" } },
          y: {
            beginAtZero: false,
            grid: { color: "rgba(148, 163, 184, 0.15)" }
          }
        }
      }
    });
  }
}

function populatePerfTable() {
  if (!perfTableBody) return;
  const rows = [
    { week: "M1", total: 2400, fertil: 1560, infertil: 840, ratio: "65%", down: "0.4%" },
    { week: "M2", total: 2580, fertil: 1700, infertil: 880, ratio: "66%", down: "0.6%" },
    { week: "M3", total: 2490, fertil: 1620, infertil: 870, ratio: "65%", down: "0.5%" },
    { week: "M4", total: 2620, fertil: 1710, infertil: 910, ratio: "65%", down: "0.3%" }
  ];
  perfTableBody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.week}</td>
      <td>${r.total}</td>
      <td>${r.fertil}</td>
      <td>${r.infertil}</td>
      <td>${r.ratio}</td>
      <td>${r.down}</td>
    `;
    perfTableBody.appendChild(tr);
  });
}

// ============== AKUN & AKSES ==============
let accounts = [
  { name: "Aminaja", role: "Operator", status: "Aktif" },
  { name: "John Doe", role: "Supervisor", status: "Aktif" },
  { name: "Admin", role: "Administrator", status: "Aktif" }
];
let editingAccount = -1;

function renderAccounts() {
  if (!accountTableBody) return;
  accountTableBody.innerHTML = "";
  accounts.forEach((acc, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${acc.name}</td>
      <td>${acc.role}</td>
      <td><span class="chip ${acc.status === "Aktif" ? "green" : "gray"}">${acc.status}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-ghost accent" data-edit="${idx}">Edit</button>
        </div>
      </td>
    `;
    accountTableBody.appendChild(tr);
  });
}

function openAccountModal(mode = "add", idx = -1) {
  editingAccount = idx;
  accountTitle.textContent = mode === "edit" ? "Edit Akun" : "Tambah Akun";
  if (mode === "edit" && accounts[idx]) {
    accountName.value = accounts[idx].name;
    accountRole.value = accounts[idx].role;
    accountStatus.value = accounts[idx].status;
  } else {
    accountName.value = "";
    accountRole.value = "";
    accountStatus.value = "Aktif";
  }
  accountModal.classList.add("open");
}

function closeAccountModal() {
  accountModal.classList.remove("open");
  editingAccount = -1;
}

// ============== LOG HISTORY TABLE ==============
function renderLogHistoryTable() {
  if (!logHistoryBody) return;
  logHistoryBody.innerHTML = "";
  if (logHistory.length === 0) {
    logHistoryBody.innerHTML = `<tr><td colspan="5" class="table-empty">Belum ada data log.</td></tr>`;
  } else {
    logHistory
      .slice()
      .reverse()
      .forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.time}</td>
          <td>${item.id}</td>
          <td>${item.classification}</td>
          <td>${item.target}</td>
          <td>${item.total}</td>
        `;
        logHistoryBody.appendChild(tr);
      });
  }
  if (logCount) logCount.textContent = logHistory.length;
  if (logTotalEggs) logTotalEggs.textContent = totalEggs;
}

function exportLogFile(ext = "csv") {
  const rows = [["waktu", "id", "klasifikasi", "target", "total"]];
  logHistory.forEach((item) => {
    rows.push([item.time, item.id, item.classification, item.target, item.total]);
  });
  const data = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `candling-log.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  openActionModal({
    title: ext === "csv" ? "CSV Diunduh" : "Excel Diunduh",
    message: "Riwayat log telah diekspor."
  });
}

// ============== SERVO & SENSOR UI ==============
function updateServoUI(servoId, angle, actionText) {
  const angleEl = document.getElementById(servoId + "-angle");
  const statusEl = document.getElementById(servoId + "-status");
  const lastEl = document.getElementById(servoId + "-last");
  const barEl = document.getElementById(servoId + "-bar");

  angleEl.textContent = angle.toFixed(0);
  statusEl.textContent = "Aktif";
  lastEl.textContent = "Terakhir menjalankan " + actionText + " pada " + formatTime(new Date());
  barEl.style.width = Math.min(100, Math.max(10, (angle / 180) * 100)) + "%";

  setTimeout(() => {
    statusEl.textContent = "Idle";
  }, 1800);
}

function updateSensorUI(isDetected, distanceCm) {
  const led = document.getElementById("sensor-led");
  const text = document.getElementById("sensor-status-text");
  const detail = document.getElementById("sensor-detail");
  const dist = document.getElementById("sensor-distance");
  const lastScan = document.getElementById("sensor-last-scan");

  dist.textContent = isDetected ? distanceCm.toFixed(1) + " cm" : "-";
  lastScan.textContent = formatTime(new Date());

  if (isDetected) {
    led.classList.add("active");
    text.textContent = "Telur terdeteksi di posisi candling";
    detail.textContent =
      "Sensor inframerah mengindikasikan adanya objek telur pada jalur inspeksi.";
  } else {
    led.classList.remove("active");
    text.textContent = "Menunggu telur...";
    detail.textContent =
      "Tidak ada telur di posisi candling. Conveyor siap menerima telur berikutnya.";
  }
}

// ============== LOG ==============
const logBody = document.getElementById("log-body");

function addLogRow(classification, targetTray) {
  if (logBody.querySelector(".log-empty")) {
    logBody.innerHTML = "";
  }

  const row = document.createElement("div");
  row.className = "log-row";

  const now = new Date();

  const colTime = document.createElement("span");
  colTime.textContent = formatTime(now);

  const colId = document.createElement("span");
  colId.textContent = "#EGG-" + String(totalEggs).padStart(3, "0");

  const colClass = document.createElement("span");
  const tagClass = document.createElement("span");
  tagClass.className = "log-tag " + (classification === "Fertil" ? "fertil" : "infertil");
  tagClass.textContent = classification;
  colClass.appendChild(tagClass);

  const colTarget = document.createElement("span");
  const tagTarget = document.createElement("span");
  tagTarget.className = "log-tag scan";
  tagTarget.textContent = targetTray;
  colTarget.appendChild(tagTarget);

  row.appendChild(colTime);
  row.appendChild(colId);
  row.appendChild(colClass);
  row.appendChild(colTarget);

  logBody.prepend(row);

  const rows = logBody.querySelectorAll(".log-row");
  if (rows.length > 20) {
    logBody.removeChild(rows[rows.length - 1]);
  }

  // Simpan ke riwayat penuh
  logHistory.push({
    time: formatTime(now),
    id: colId.textContent,
    classification,
    target: targetTray,
    total: totalEggs
  });
  if (logHistory.length > 200) logHistory.shift();
  renderLogHistoryTable();
}

// ============== SIMULASI DATA IOT ==============
function tickSimulation() {
  const hasEgg = Math.random() < probHasEgg;
  const distance = hasEgg ? 4 + Math.random() * 3 : 8 + Math.random() * 5;
  updateSensorUI(hasEgg, distance);

  if (hasEgg) {
    totalEggs += 1;
    eggsThisMinute += 1;

    const responseMs = 120 + Math.random() * 140;
    const isFertil = Math.random() < probFertil;
    let servoAngle;
    let trayLabel;

    if (isFertil) {
      fertilEggs += 1;
      servoAngle = 45 + Math.random() * 25;
      trayLabel = "Tray Fertil (Servo 1)";
      updateServoUI("servo1", servoAngle, "pengiriman telur fertil");
      addLogRow("Fertil", trayLabel);
    } else {
      infertilEggs += 1;
      servoAngle = 135 + Math.random() * 25;
      trayLabel = "Tray Infertil (Servo 2)";
      updateServoUI("servo2", servoAngle, "pengiriman telur infertil");
      addLogRow("Infertil", trayLabel);
    }

    bumpHourly(isFertil);
    pushResponse(responseMs);
    updateKPI();
    updateEggChart();
    document.getElementById("last-check").textContent = formatTime(new Date());
  }
}

function startSimulation() {
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(tickSimulation, scanIntervalMs);
  if (throughputInterval) clearInterval(throughputInterval);
  throughputInterval = setInterval(() => {
    lastMinuteCounts.push(eggsThisMinute);
    if (lastMinuteCounts.length > 10) lastMinuteCounts.shift();
    eggsThisMinute = 0;
    updateKPI();
  }, 60000);
}

function stopSimulation() {
  clearInterval(simInterval);
  clearInterval(throughputInterval);
}

// ============== NAV SIDEBAR ==============
const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".page-section");

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    navItems.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.getAttribute("data-target");
    sections.forEach((sec) => {
      sec.classList.toggle("active", sec.id === target);
    });

    // Auto-close sidebar on mobile after selecting menu
    document.body.classList.remove("sidebar-open");
    sidebarToggle?.classList.remove("active");
    sidebarToggle?.classList.remove("moved");
  });
});

// ============== TOP ACTIONS HANDLERS ==============
const btnTest = document.getElementById("btn-test");
const btnPause = document.getElementById("btn-pause");
const btnExport = document.getElementById("btn-export");
const btnCsv = document.getElementById("btn-csv");
const btnConfig = document.getElementById("btn-config");
const menuToggle = document.getElementById("menu-toggle");
const topbarActions = document.getElementById("topbar-actions");
const sidebarToggle = document.getElementById("sidebar-toggle");
const perfTableBody = document.getElementById("perf-table-body");
const accountTableBody = document.getElementById("account-table-body");
const addAccountBtn = document.getElementById("add-account-btn");
const accountModal = document.getElementById("account-modal");
const accountBackdrop = document.getElementById("account-backdrop");
const accountTitle = document.getElementById("account-title");
const accountName = document.getElementById("account-name");
const accountRole = document.getElementById("account-role");
const accountStatus = document.getElementById("account-status");
const accountCancel = document.getElementById("account-cancel");
const accountSave = document.getElementById("account-save");
const servo1AngleDisplay = document.getElementById("servo1-angle-display");
const servo2AngleDisplay = document.getElementById("servo2-angle-display");
const servo1Slider = document.getElementById("servo1-slider");
const servo2Slider = document.getElementById("servo2-slider");
const servo1Apply = document.getElementById("servo1-apply");
const servo2Apply = document.getElementById("servo2-apply");
const servo1Calib = document.getElementById("servo1-calib");
const servo2Calib = document.getElementById("servo2-calib");
const servo1Auto = document.getElementById("servo1-auto");
const servo2Auto = document.getElementById("servo2-auto");
const systemAuto = document.getElementById("system-auto");
const systemStart = document.getElementById("system-start");
const systemStop = document.getElementById("system-stop");
const logHistoryBody = document.getElementById("log-history-body");
const logCount = document.getElementById("log-count");
const btnLogCsv = document.getElementById("btn-log-csv");
const btnLogXls = document.getElementById("btn-log-xls");
const logTotalEggs = document.getElementById("log-total-eggs");

menuToggle?.addEventListener("click", () => {
  topbarActions.classList.toggle("open");
});

btnTest?.addEventListener("click", () => {
  openActionModal({
    title: "Notifikasi Uji",
    message: "Notifikasi uji terkirim (simulasi)."
  });
});

let paused = false;
btnPause?.addEventListener("click", () => {
  paused = !paused;
  if (paused) {
    stopSimulation();
    btnPause.textContent = "Resume";
    showSwal("Simulasi Dijeda", "Pemrosesan candling sementara dihentikan.", "warning");
  } else {
    startSimulation();
    btnPause.textContent = "Pause";
    showSwal("Simulasi Dilanjutkan", "Pemrosesan candling kembali berjalan.", "success");
  }
});

// Sidebar toggle (mobile)
sidebarToggle?.addEventListener("click", () => {
  const open = document.body.classList.toggle("sidebar-open");
  sidebarToggle.classList.toggle("active", open);
  sidebarToggle.classList.toggle("moved", open);
});

// Account handlers
addAccountBtn?.addEventListener("click", () => openAccountModal("add"));
accountBackdrop?.addEventListener("click", closeAccountModal);
accountCancel?.addEventListener("click", closeAccountModal);
accountSave?.addEventListener("click", () => {
  const name = accountName.value.trim();
  const role = accountRole.value.trim();
  const status = accountStatus.value;
  if (!name || !role) {
    showSwal("Tidak boleh kosong", "Nama dan peran wajib diisi.", "warning");
    return;
  }

  if (editingAccount >= 0) {
    accounts[editingAccount] = { name, role, status };
  } else {
    accounts.push({ name, role, status });
  }
  renderAccounts();
  closeAccountModal();
  showSwal(
    "Akun Disimpan",
    editingAccount >= 0 ? "Data akun berhasil diperbarui." : "Akun baru berhasil ditambahkan.",
    "success"
  );
});

accountTableBody?.addEventListener("click", (e) => {
  const target = e.target;
  const idx = target?.getAttribute?.("data-edit");
  if (idx !== null && idx !== undefined) {
    openAccountModal("edit", Number(idx));
  }
});

btnLogCsv?.addEventListener("click", () => exportLogFile("csv"));
btnLogXls?.addEventListener("click", () => exportLogFile("xls"));

function exportJson() {
  const payload = {
    timestamp: new Date().toISOString(),
    totalEggs,
    fertilEggs,
    infertilEggs,
    probHasEgg,
    probFertil,
    scanIntervalMs,
    logs: Array.from(document.querySelectorAll(".log-row")).map((row) =>
      Array.from(row.children).map((c) => c.textContent.trim())
    )
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "candling-export.json";
  a.click();
  URL.revokeObjectURL(url);
  openActionModal({
    title: "Export JSON",
    message: "Snapshot data candling berhasil diekspor."
  });
}

function exportCsv() {
  const rows = [["waktu", "id", "klasifikasi", "target"]];
  document.querySelectorAll(".log-row").forEach((row) => {
    rows.push(Array.from(row.children).map((c) => c.textContent.trim()));
  });
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "candling-log.csv";
  a.click();
  URL.revokeObjectURL(url);
  openActionModal({
    title: "CSV Diunduh",
    message: "Log proses candling berhasil diunduh."
  });
}
btnExport?.addEventListener("click", exportJson);
btnCsv?.addEventListener("click", exportCsv);

// Modal konfigurasi
const modal = document.getElementById("config-modal");
const modalBackdrop = document.getElementById("config-backdrop");
const modalClose = document.getElementById("config-close");
const modalCancel = document.getElementById("config-cancel");
const modalSave = document.getElementById("config-save");
const inputInterval = document.getElementById("input-interval");
const inputProb = document.getElementById("input-prob");
const inputFertil = document.getElementById("input-fertil");

function openConfig() {
  inputInterval.value = scanIntervalMs;
  inputProb.value = probHasEgg;
  inputFertil.value = probFertil;
  modal.classList.add("open");
}

function closeConfig() {
  modal.classList.remove("open");
}

btnConfig?.addEventListener("click", openConfig);
modalBackdrop?.addEventListener("click", closeConfig);
modalClose?.addEventListener("click", closeConfig);
modalCancel?.addEventListener("click", closeConfig);

modalSave?.addEventListener("click", () => {
  const newInterval = Number(inputInterval.value) || scanIntervalMs;
  const newProb = Math.min(1, Math.max(0, Number(inputProb.value)));
  const newFertil = Math.min(1, Math.max(0, Number(inputFertil.value)));
  scanIntervalMs = Math.max(500, newInterval);
  probHasEgg = newProb || probHasEgg;
  probFertil = newFertil || probFertil;
  startSimulation();
  showToast("Konfigurasi disimpan", "success");
  closeConfig();
});

// Modal aksi generik
const actionModal = document.getElementById("action-modal");
const actionBackdrop = document.getElementById("action-backdrop");
const actionTitle = document.getElementById("action-title");
const actionMessage = document.getElementById("action-message");
let actionTimer;

function closeActionModal() {
  actionModal.classList.add("closing");
  setTimeout(() => {
    actionModal.classList.remove("open", "closing");
  }, 220);
  if (actionTimer) clearTimeout(actionTimer);
}

function openActionModal({ title, message, duration = 2200 }) {
  actionModal.classList.remove("closing");
  actionTitle.textContent = title;
  actionMessage.textContent = message;
  actionModal.classList.add("open");
  if (actionTimer) clearTimeout(actionTimer);
  actionTimer = setTimeout(closeActionModal, duration);
}

actionBackdrop?.addEventListener("click", closeActionModal);

// Servo manual handlers
function applyServo(id, angle) {
  updateServoUI(id, angle, "setpoint manual");
  showSwal("Setpoint Servo " + (id === "servo1" ? "1" : "2"), "Sudut diset ke " + angle.toFixed(0) + "°", "success");
}

servo1Apply?.addEventListener("click", () => applyServo("servo1", Number(servo1Slider.value)));
servo2Apply?.addEventListener("click", () => applyServo("servo2", Number(servo2Slider.value)));

servo1Calib?.addEventListener("click", () => {
  updateServoUI("servo1", 90, "kalibrasi");
  showSwal("Kalibrasi Servo 1", "Servo 1 dikalibrasi ke 90°", "success");
});

servo2Calib?.addEventListener("click", () => {
  updateServoUI("servo2", 90, "kalibrasi");
  showSwal("Kalibrasi Servo 2", "Servo 2 dikalibrasi ke 90°", "success");
});

servo1Slider?.addEventListener("input", (e) => {
  if (servo1AngleDisplay) servo1AngleDisplay.textContent = Number(e.target.value).toFixed(0);
});

servo2Slider?.addEventListener("input", (e) => {
  if (servo2AngleDisplay) servo2AngleDisplay.textContent = Number(e.target.value).toFixed(0);
});

systemStart?.addEventListener("click", () =>
  showSwal("Start Sistem", "Mode operasional dimulai.", "success")
);

systemStop?.addEventListener("click", () =>
  showSwal("Stop Sistem", "Mode operasional dihentikan.", "warning")
);

servo1Auto?.addEventListener("change", () => {
  showSwal(
    "Servo 1 " + (servo1Auto.checked ? "Auto" : "Manual"),
    "Servo 1 masuk mode " + (servo1Auto.checked ? "otomatis" : "manual") + ".",
    "success"
  );
});

servo2Auto?.addEventListener("change", () => {
  showSwal(
    "Servo 2 " + (servo2Auto.checked ? "Auto" : "Manual"),
    "Servo 2 masuk mode " + (servo2Auto.checked ? "otomatis" : "manual") + ".",
    "success"
  );
});

systemAuto?.addEventListener("change", () => {
  showSwal("Mode Sistem", "Sistem " + (systemAuto.checked ? "otomatis" : "manual") + ".", "success");
});

// Kick things off
startTiming();
startSimulation();
initStatsCharts();
populatePerfTable();
renderAccounts();
renderLogHistoryTable();
