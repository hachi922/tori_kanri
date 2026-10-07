'use strict';

const GIST_ID = '676bedbd56ebc8f68d06abc674fb7c8b';
const GIST_FILE = 'pet_data.json';

const PASTEL_COLORS = [
  { name: 'ラベンダー',   main: '#7F77DD', light: '#EEEDFE', dark: '#3C3489' },
  { name: 'ミント',       main: '#5DCAA5', light: '#E1F5EE', dark: '#085041' },
  { name: 'スカイ',       main: '#85B7EB', light: '#E6F1FB', dark: '#0C447C' },
  { name: 'コーラル',     main: '#F0997B', light: '#FAECE7', dark: '#712B13' },
  { name: 'ローズ',       main: '#ED93B1', light: '#FBEAF0', dark: '#72243E' },
  { name: 'ピーチ',       main: '#FAC775', light: '#FAEEDA', dark: '#633806' },
  { name: 'ライム',       main: '#97C459', light: '#EAF3DE', dark: '#27500A' },
  { name: 'ベビーブルー', main: '#B5D4F4', light: '#E6F1FB', dark: '#185FA5' },
  { name: 'サーモン',     main: '#F5C4B3', light: '#FAECE7', dark: '#993C1D' },
  { name: 'ライラック',   main: '#AFA9EC', light: '#EEEDFE', dark: '#534AB7' },
  { name: 'アクア',       main: '#9FE1CB', light: '#E1F5EE', dark: '#0F6E56' },
  { name: 'バター',       main: '#EF9F27', light: '#FAEEDA', dark: '#854F0B' },
];

let weightData  = [];
let vetData     = [];
let goalWeights = [null, null, null];
let charts      = [null, null, null];
let currentColorIdx = 0;
let collapsedYears  = new Set();
let pendingDelete   = null;

// ── PAT helpers ───────────────────────────────────────────
function getPAT() {
  return localStorage.getItem('github_pat') || '';
}

function savePAT(pat) {
  if (pat) {
    localStorage.setItem('github_pat', pat);
  } else {
    localStorage.removeItem('github_pat');
  }
}

// ── Date helpers ──────────────────────────────────────────
function todayJST() {
  var now = new Date();
  var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  var y = jst.getUTCFullYear();
  var m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  var d = String(jst.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function normalizeISO(val) {
  if (!val || val === '') return '';
  if (val instanceof Date) {
    var jst = new Date(val.getTime() + 9 * 60 * 60 * 1000);
    var y = jst.getUTCFullYear();
    var m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    var d = String(jst.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  var s = String(val).trim();
  var p = s.replace(/\//g, '-').split('-');
  if (p.length === 3) {
    var y2 = p[0].length === 4 ? p[0] : '20' + p[0];
    return y2 + '-' + p[1].padStart(2, '0') + '-' + p[2].slice(0, 2).padStart(2, '0');
  }
  return s.slice(0, 10);
}

function toDisplay(iso) {
  var s = normalizeISO(iso) || String(iso);
  var p = s.split('-');
  if (p.length < 3) return s;
  return p[0].slice(2) + '/' + p[1] + '/' + p[2];
}

function toISO(disp) {
  var p = disp.replace(/-/g, '/').split('/');
  if (p.length !== 3) return null;
  var y = p[0], m = p[1], d = p[2];
  if (y.length === 2) y = '20' + y;
  if (y.length !== 4) return null;
  var iso = y + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
  return isNaN(Date.parse(iso)) ? null : iso;
}

// ── Dialog ────────────────────────────────────────────────
function askDelete(type, idx, msg) {
  pendingDelete = { type: type, idx: idx };
  document.getElementById('dialogMsg').textContent = msg;
  document.getElementById('dialogOverlay').classList.add('show');
}

function closeDialog() {
  pendingDelete = null;
  document.getElementById('dialogOverlay').classList.remove('show');
}

function confirmDelete() {
  if (!pendingDelete) return;
  var type = pendingDelete.type;
  var idx  = pendingDelete.idx;
  closeDialog();
  if (type === 'row') {
    weightData.splice(idx, 1);
    renderTable();
    if (charts[0]) refreshCharts();
    saveAll();
  } else if (type === 'vet') {
    vetData.splice(idx, 1);
    renderVet();
    saveAll();
  }
}

// ── Gist API ─────────────────────────────────────────────
async function apiLoad() {
  // RawURLから直接取得（高速・認証不要）
  var rawUrl = 'https://gist.githubusercontent.com/hachi922/' + GIST_ID + '/raw/' + GIST_FILE;
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, 15000);
  try {
    var res = await fetch(rawUrl + '?t=' + Date.now(), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('load failed');
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function apiSave(data) {
  var pat = getPAT();
  if (!pat) {
    showToast('PATが未設定です。設定タブで入力してください');
    return;
  }
  var body = { files: {} };
  body.files[GIST_FILE] = { content: JSON.stringify(data, null, 2) };
  var res = await fetch('https://api.github.com/gists/' + GIST_ID, {
    method: 'PATCH',
    headers: {
      'Authorization': 'token ' + pat,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    var err = await res.json().catch(function() { return {}; });
    throw new Error(err.message || 'save failed');
  }
}

function buildSavePayload() {
  return {
    weightData: weightData,
    vetData: vetData,
    config: {
      names: [0, 1, 2].map(function(i) { return getBirdName(i); }),
      goalWeights: goalWeights,
      themeIdx: currentColorIdx,
    },
  };
}

async function saveAll() {
  try {
    await apiSave(buildSavePayload());
  } catch (e) {
    showToast('保存に失敗しました：' + e.message);
  }
}

// ── Init ─────────────────────────────────────────────────
async function init() {
  showLoading(true);
  buildColorGrid();
  renderPATStatus();

  try {
    var d = await apiLoad();
    if (d.weightData) weightData = d.weightData;
    if (d.vetData)    vetData    = d.vetData;
    if (d.config) {
      if (d.config.names) {
        d.config.names.forEach(function(n, i) {
          var el = document.getElementById('name' + i);
          if (el) el.value = n || '';
        });
      }
      if (d.config.goalWeights) goalWeights = d.config.goalWeights;
      if (typeof d.config.themeIdx === 'number') applyTheme(d.config.themeIdx);
    }
  } catch (e) {
    showToast('データの読み込みに失敗しました');
  }

  showLoading(false);
  buildChartCards();
  renderTable();
  renderVet();
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// ── PAT設定UI ─────────────────────────────────────────────
function renderPATStatus() {
  var el = document.getElementById('patStatus');
  if (!el) return;
  var pat = getPAT();
  el.textContent = pat ? '設定済み (' + pat.slice(0, 8) + '...)' : '未設定';
  el.style.color = pat ? 'var(--accent)' : '#E24B4A';
}

function savePATFromInput() {
  var inp = document.getElementById('patInput');
  if (!inp) return;
  var val = inp.value.trim();
  if (!val.startsWith('ghp_') && val !== '') {
    showToast('PATは ghp_ で始まる文字列です');
    return;
  }
  savePAT(val);
  inp.value = '';
  renderPATStatus();
  showToast(val ? 'PAT を保存しました' : 'PAT を削除しました');
}

function clearPAT() {
  savePAT('');
  renderPATStatus();
  showToast('PAT を削除しました');
}

// ── Theme ─────────────────────────────────────────────────
function applyTheme(idx) {
  currentColorIdx = idx;
  var c = PASTEL_COLORS[idx];
  document.documentElement.style.setProperty('--accent', c.main);
  document.documentElement.style.setProperty('--accent-light', c.light);
  document.documentElement.style.setProperty('--accent-text', c.dark);
  document.getElementById('colorLabel').textContent = '現在：' + c.name;
  document.querySelectorAll('.color-swatch').forEach(function(s, i) {
    s.classList.toggle('selected', i === idx);
  });
  if (charts[0]) refreshCharts();
}

function buildColorGrid() {
  var grid = document.getElementById('colorGrid');
  PASTEL_COLORS.forEach(function(c, i) {
    var btn = document.createElement('button');
    btn.className = 'color-swatch' + (i === 0 ? ' selected' : '');
    btn.style.background = c.main;
    btn.title = c.name;
    btn.setAttribute('aria-label', c.name);
    btn.onclick = function() { applyTheme(i); saveAll(); };
    grid.appendChild(btn);
  });
}

// ── Helpers ──────────────────────────────────────────────
function getBirdName(i) {
  var el = document.getElementById('name' + i);
  return el ? (el.value || ('鳥' + (i + 1))) : ('鳥' + (i + 1));
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2200);
}

function downloadBlob(content, filename, type) {
  var blob = new Blob([content], { type: type });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Weight table ─────────────────────────────────────────
function onNameInput() {
  buildChartCards();
  if (charts[0]) refreshCharts();
  renderTable();
  saveAll();
}

function updateHeaders() {
  buildChartCards();
  if (charts[0]) refreshCharts();
  renderTable();
}

function toggleYear(year) {
  var currentYear = String(new Date().getFullYear());
  var defaultOpen = (year === currentYear);
  var manualOpen  = collapsedYears.has('open:' + year);
  var manualClose = collapsedYears.has('close:' + year);
  var nowOpen = manualOpen ? true : manualClose ? false : defaultOpen;
  collapsedYears.delete('open:' + year);
  collapsedYears.delete('close:' + year);
  if (nowOpen) {
    collapsedYears.add('close:' + year);
  } else {
    collapsedYears.add('open:' + year);
  }
  renderTable();
}

function renderTable() {
  var wrap = document.getElementById('weightGroups');
  wrap.innerHTML = '';

  var byYear = {};
  weightData.forEach(function(row, ri) {
    var y = normalizeISO(row.date).slice(0, 4);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push({ row: row, ri: ri });
  });

  var years = Object.keys(byYear).sort(function(a, b) { return b - a; });
  var currentYear = String(new Date().getFullYear());

  years.forEach(function(year) {
    var rows = byYear[year].sort(function(a, b) {
      return normalizeISO(b.row.date).localeCompare(normalizeISO(a.row.date));
    });

    var manualOpen  = collapsedYears.has('open:' + year);
    var manualClose = collapsedYears.has('close:' + year);
    var isOpen = manualOpen ? true : manualClose ? false : (year === currentYear);

    var group = document.createElement('div');
    group.className = 'year-group';

    var hdr = document.createElement('div');
    hdr.className = 'year-header';
    hdr.onclick = function() { toggleYear(year); };
    hdr.innerHTML =
      '<span class="year-label">' + year + '年</span>' +
      '<span style="display:flex;align-items:center;gap:8px">' +
        '<span class="year-meta">' + rows.length + '件</span>' +
        '<i class="ti ti-chevron-down year-chevron' + (isOpen ? ' open' : '') + '"></i>' +
      '</span>';
    group.appendChild(hdr);

    var body = document.createElement('div');
    body.className = 'year-body' + (isOpen ? '' : ' collapsed');
    body.style.maxHeight = isOpen ? '9999px' : '0px';

    var names = [0, 1, 2].map(function(i) { return getBirdName(i); });
    var tbl = document.createElement('table');
    tbl.innerHTML =
      '<colgroup><col style="width:54px"><col><col><col><col style="width:22px"></colgroup>' +
      '<thead><tr>' +
        '<th>日付</th>' +
        '<th>' + names[0] + '<br><span class="unit">(g)</span></th>' +
        '<th>' + names[1] + '<br><span class="unit">(g)</span></th>' +
        '<th>' + names[2] + '<br><span class="unit">(g)</span></th>' +
        '<th></th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    rows.forEach(function(item) {
      var row = item.row;
      var ri  = item.ri;
      var disp = toDisplay(row.date);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
          '<span class="date-display" id="dd-' + ri + '" onclick="startEditDate(' + ri + ')">' + disp + '</span>' +
          '<input class="date-edit" id="de-' + ri + '" type="text" value="' + disp + '" placeholder="yy/mm/dd"' +
            ' onblur="commitDate(' + ri + ')" onkeydown="if(event.key===\'Enter\')this.blur()">' +
        '</td>' +
        '<td><input type="number" step="0.1" value="' + (row.w[0] || '') + '" placeholder="-" onchange="setWeight(' + ri + ',0,this.value)"></td>' +
        '<td><input type="number" step="0.1" value="' + (row.w[1] || '') + '" placeholder="-" onchange="setWeight(' + ri + ',1,this.value)"></td>' +
        '<td><input type="number" step="0.1" value="' + (row.w[2] || '') + '" placeholder="-" onchange="setWeight(' + ri + ',2,this.value)"></td>' +
        '<td><button class="del-btn" onclick="askDelete(\'row\',' + ri + ',\'' + disp + ' のデータを削除します\')" aria-label="削除"><i class="ti ti-trash"></i></button></td>';
      tbody.appendChild(tr);
    });

    tbl.appendChild(tbody);
    body.appendChild(tbl);
    group.appendChild(body);
    wrap.appendChild(group);
  });
}

function startEditDate(ri) {
  var dd = document.getElementById('dd-' + ri);
  if (dd) dd.classList.add('hidden');
  var inp = document.getElementById('de-' + ri);
  if (!inp) return;
  inp.classList.add('active');
  inp.focus();
  inp.select();
}

function commitDate(ri) {
  var inp = document.getElementById('de-' + ri);
  if (!inp) return;
  var iso  = toISO(inp.value.trim());
  var warn = document.getElementById('dupWarning');
  if (!iso) {
    inp.value = toDisplay(weightData[ri].date);
  } else if (weightData.some(function(r, i) { return i !== ri && normalizeISO(r.date) === iso; })) {
    warn.style.display = 'block';
    inp.value = toDisplay(weightData[ri].date);
  } else {
    warn.style.display = 'none';
    weightData[ri].date = iso;
    saveAll();
  }
  inp.classList.remove('active');
  renderTable();
}

function setWeight(idx, bird, val) {
  weightData[idx].w[bird] = parseFloat(val) || 0;
  if (charts[0]) refreshCharts();
  saveAll();
}

function addRow() {
  var today = todayJST();
  var warn  = document.getElementById('dupWarning');
  if (weightData.some(function(r) { return normalizeISO(r.date) === today; })) {
    warn.style.display = 'block';
    return;
  }
  warn.style.display = 'none';
  weightData.unshift({ date: today, w: [null, null, null] });
  collapsedYears.delete('close:' + today.slice(0, 4));
  renderTable();
  saveAll();
}

// ── Charts ───────────────────────────────────────────────
function getChartData(bi) {
  var s = weightData
    .filter(function(r) { return r.w[bi] != null && r.w[bi] !== 0; })
    .sort(function(a, b) { return normalizeISO(a.date).localeCompare(normalizeISO(b.date)); });
  return {
    labels: s.map(function(r) { return normalizeISO(r.date).slice(5).replace('-', '/'); }),
    data:   s.map(function(r) { return parseFloat(parseFloat(r.w[bi]).toFixed(1)); }),
  };
}

function buildChartCards() {
  var wrap = document.getElementById('chartsWrap');
  wrap.innerHTML = '';
  for (var i = 0; i < 3; i++) {
    var gv   = goalWeights[i] || '';
    var name = getBirdName(i);
    var card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML =
      '<div class="chart-header">' +
        '<div class="chart-title">' + name + ' 体重推移</div>' +
        '<div class="goal-row">' +
          '<span class="goal-label">目標</span>' +
          '<input class="goal-input" type="number" step="0.1" value="' + gv + '" placeholder="--" id="goal' + i + '" onchange="setGoal(' + i + ',this.value)">' +
          '<span class="goal-unit">g</span>' +
        '</div>' +
      '</div>' +
      '<div class="legend-row">' +
        '<span class="legend-item"><span class="legend-dot" style="background:' + PASTEL_COLORS[currentColorIdx].main + '"></span>実測</span>' +
        '<span class="legend-item"><span class="legend-dash"></span>目標</span>' +
      '</div>' +
      '<div class="chart-wrap"><canvas id="c' + i + '" role="img" aria-label="' + name + 'の体重グラフ"></canvas></div>';
    wrap.appendChild(card);
  }
}

function setGoal(bi, val) {
  goalWeights[bi] = parseFloat(val) || null;
  refreshCharts();
  saveAll();
}

function buildChart(id, bi) {
  var cd   = getChartData(bi);
  var col  = PASTEL_COLORS[currentColorIdx].main;
  var goal = goalWeights[bi];
  var ctx  = document.getElementById(id);
  if (!ctx) return null;

  var datasets = [{
    label: '実測',
    data: cd.data,
    borderColor: col,
    backgroundColor: col + '28',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: true,
    tension: 0,
  }];

  if (goal != null && !isNaN(goal) && cd.labels.length > 0) {
    datasets.push({
      label: '目標',
      data: cd.labels.map(function() { return goal; }),
      borderColor: '#E24B4A',
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
      tension: 0,
    });
  }

  var allVals = cd.data.concat(goal != null ? [goal] : []).filter(function(v) { return v != null; });
  var minV = allVals.length ? Math.min.apply(null, allVals) : 0;
  var maxV = allVals.length ? Math.max.apply(null, allVals) : 50;
  var pad  = Math.max((maxV - minV) * 0.3, 1);

  return new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels: cd.labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { font: { size: 10 }, maxRotation: 45, color: '#888780' },
          grid: { display: false },
        },
        y: {
          min: parseFloat((minV - pad).toFixed(1)),
          max: parseFloat((maxV + pad).toFixed(1)),
          ticks: { font: { size: 10 }, color: '#888780', callback: function(v) { return parseFloat(v.toFixed(1)); } },
          grid: { color: 'rgba(136,135,128,0.15)' },
        },
      },
    },
  });
}

function refreshCharts() {
  for (var i = 0; i < 3; i++) {
    if (charts[i]) { charts[i].destroy(); charts[i] = null; }
    charts[i] = buildChart('c' + i, i);
  }
}

// ── Vet records ──────────────────────────────────────────
function renderVet() {
  var list   = document.getElementById('vetList');
  var sorted = vetData.slice().sort(function(a, b) {
    return normalizeISO(b.date).localeCompare(normalizeISO(a.date));
  });
  list.innerHTML = sorted.length === 0
    ? '<p style="font-size:13px;color:var(--text-secondary)">まだ記録がありません</p>' : '';
  sorted.forEach(function(v) {
    var ri       = vetData.indexOf(v);
    var safeDate = normalizeISO(v.date).replace(/-/g, '/');
    var card     = document.createElement('div');
    card.className = 'vet-card';
    card.innerHTML =
      '<div class="vet-card-header">' +
        '<span class="vet-date"><i class="ti ti-calendar" style="font-size:13px"></i> ' + safeDate + '</span>' +
        '<span style="display:flex;align-items:center;gap:8px">' +
          '<span class="vet-cost">¥' + v.cost.toLocaleString() + '</span>' +
          '<button class="vet-del" onclick="askDelete(\'vet\',' + ri + ',\'' + safeDate + ' の通院記録を削除します\')" aria-label="削除"><i class="ti ti-x"></i></button>' +
        '</span>' +
      '</div>' +
      '<div class="vet-notes">' + v.notes.replace(/\n/g, '<br>') + '</div>';
    list.appendChild(card);
  });
}

function addVet() {
  var d = document.getElementById('vetDate').value;
  var c = parseInt(document.getElementById('vetCost').value) || 0;
  var n = document.getElementById('vetNotes').value.trim();
  if (!d) { showToast('日付を入力してください'); return; }
  vetData.push({ date: d, cost: c, notes: n });
  document.getElementById('vetDate').value  = '';
  document.getElementById('vetCost').value  = '';
  document.getElementById('vetNotes').value = '';
  renderVet();
  saveAll();
  showToast('保存しました');
}

// ── Tab switching ─────────────────────────────────────────
function switchTab(n) {
  document.querySelectorAll('.btab').forEach(function(t, i) { t.classList.toggle('active', i === n); });
  document.querySelectorAll('.panel').forEach(function(p, i) { p.classList.toggle('active', i === n); });
  if (n === 1) setTimeout(refreshCharts, 60);
}

// ── CSV Export ───────────────────────────────────────────
function exportCSV() {
  var names = [0, 1, 2].map(function(i) { return getBirdName(i); });
  var BOM   = '﻿';
  var csv   = BOM + '【体重記録】\n';
  csv += '日付,' + names[0] + '(g),' + names[1] + '(g),' + names[2] + '(g)\n';
  weightData.slice().sort(function(a, b) {
    return normalizeISO(b.date).localeCompare(normalizeISO(a.date));
  }).forEach(function(r) {
    csv += normalizeISO(r.date) + ',' + [0, 1, 2].map(function(i) {
      return r.w[i] != null && r.w[i] !== 0 ? parseFloat(r.w[i].toFixed(1)) : '';
    }).join(',') + '\n';
  });
  csv += '\n【目標体重】\n';
  csv += names.map(function(n) { return n + '目標(g)'; }).join(',') + '\n';
  csv += goalWeights.map(function(g) { return g != null ? parseFloat(g.toFixed(1)) : ''; }).join(',') + '\n';
  csv += '\n【通院記録】\n日付,費用(円),治療・検査内容\n';
  vetData.slice().sort(function(a, b) {
    return normalizeISO(b.date).localeCompare(normalizeISO(a.date));
  }).forEach(function(v) {
    csv += normalizeISO(v.date) + ',' + v.cost + ',"' + v.notes.replace(/"/g, '""') + '"\n';
  });
  downloadBlob(csv, 'pet_data_' + todayJST() + '.csv', 'text/csv;charset=utf-8');
  showToast('CSVエクスポートしました');
}

// ── Start ─────────────────────────────────────────────────
init();
