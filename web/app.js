const API = window.location.origin;
let allMunicipios = [];
let allPibs = [];
let charts = {};
let dataReady = false;

function fmt(v) {
  if (v == null) return '—';
  if (v >= 1e12) return 'R$ ' + (v / 1e12).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Tri';
  if (v >= 1e9) return 'R$ ' + (v / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Bi';
  if (v >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Mi';
  if (v >= 1e3) return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' K';
  return 'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fmtFull(v) {
  if (v == null) return '—';
  if (v >= 1e12) return 'R$ ' + (v / 1e12).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Tri';
  if (v >= 1e9) return 'R$ ' + (v / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Bi';
  if (v >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Mi';
  if (v >= 1e3) return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' K';
  return 'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fmtN(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR').format(Math.round(v));
}
function destroy(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}
function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    text: isDark ? '#a1a1a6' : '#6e6e73',
    grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    accent: '#6366f1',
    muted: 'rgba(128,128,128,0.3)',
  };
}

const themeBtn = document.getElementById('themeBtn');
const iconMoon = document.getElementById('iconMoon');
const iconSun = document.getElementById('iconSun');
const stored = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', stored);
updateThemeIcons(stored);
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcons(next);
  if (dataReady) loadDashboard();
});
function updateThemeIcons(theme) {
  iconMoon.style.display = theme === 'dark' ? 'block' : 'none';
  iconSun.style.display = theme === 'light' ? 'block' : 'none';
}

document.querySelectorAll('.nav-link, .mm-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll(`.nav-link[data-page="${page}"]`).forEach(l => l.classList.add('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.getElementById('mobileMenu').classList.remove('open');
    document.getElementById('burger').classList.remove('open');
    if (page === 'dashboard' && dataReady) loadDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
document.getElementById('burger').addEventListener('click', () => {
  document.getElementById('burger').classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
});

async function loadData() {
  let attempts = 0;
  while (attempts < 120) {
    try {
      const r = await fetch(`${API}/api/health`);
      const d = await r.json();
      if (d.loaded > 4000) break;
    } catch {}
    attempts++;
    await new Promise(r => setTimeout(r, 2000));
    const el = document.getElementById('loadingStatus');
    if (el) el.textContent = `Carregando dados do IBGE... (~${attempts * 2}s)`;
  }

  const [munRes, pibRes] = await Promise.all([
    fetch(`${API}/api/municipios`),
    fetch(`${API}/api/all-pibs`)
  ]);
  allMunicipios = await munRes.json();
  allPibs = await pibRes.json();
  dataReady = true;

  document.getElementById('searchInput').placeholder = 'Digite o nome da cidade...';
  document.getElementById('loadingOverlay').classList.add('hidden');
}

let map = null;
let geojsonLayer = null;

function initMap() {
  if (map) return;
  map = L.map('map', {
    center: [-14.235, -51.925],
    zoom: 4,
    zoomControl: true,
    preferCanvas: true,
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 18,
  }).addTo(map);
}

function getPibColor(pib) {
  if (pib == null) return '#1a1a2e';
  if (pib < 10000) return '#c7d2fe';
  if (pib < 20000) return '#a5b4fc';
  if (pib < 30000) return '#818cf8';
  if (pib < 50000) return '#6366f1';
  if (pib < 75000) return '#4f46e5';
  if (pib < 100000) return '#4338ca';
  if (pib < 150000) return '#3730a3';
  if (pib < 200000) return '#312e81';
  return '#1e1b4b';
}

function buildPibMap() {
  if (!dataReady || allPibs.length === 0) return;
  initMap();

  const pibMap = {};
  allPibs.forEach(p => { pibMap[String(p.cod_ibge)] = p; });

  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }

  const legendEl = document.getElementById('mapLegend');
  const ranges = [
    { min: 200000, max: Infinity, label: 'R$ 200k+' },
    { min: 150000, max: 200000, label: 'R$ 150-200k' },
    { min: 100000, max: 150000, label: 'R$ 100-150k' },
    { min: 75000, max: 100000, label: 'R$ 75-100k' },
    { min: 50000, max: 75000, label: 'R$ 50-75k' },
    { min: 30000, max: 50000, label: 'R$ 30-50k' },
    { min: 20000, max: 30000, label: 'R$ 20-30k' },
    { min: 10000, max: 20000, label: 'R$ 10-20k' },
    { min: 0, max: 10000, label: 'R$ até 10k' },
  ];
  legendEl.innerHTML = ranges.map(r =>
    `<div class="map-legend-item">
      <div class="map-legend-color" style="background:${getPibColor(r.min + 1)}"></div>
      <span>${r.label}</span>
    </div>`
  ).join('');

  fetch('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio')
    .then(r => r.json())
    .then(geo => {
      geojsonLayer = L.geoJSON(geo, {
        style: feature => {
          const cod = String(feature.properties.codarea);
          const pibData = pibMap[cod];
          return {
            fillColor: getPibColor(pibData ? pibData.pib : null),
            weight: 0.5,
            opacity: 1,
            color: 'rgba(255,255,255,0.15)',
            fillOpacity: 0.85,
          };
        },
        onEachFeature: (feature, layer) => {
          const cod = String(feature.properties.codarea);
          const pibData = pibMap[cod];
          if (pibData) {
            layer.bindPopup(`
              <strong>${pibData.nome}-${pibData.sigla_uf}</strong><br>
              PIB per Capita: ${fmtFull(pibData.pib)}<br>
              PIB: ${fmt(pibData.pib_total)}
            `);
          }
          layer.on('mouseover', function() {
            this.setStyle({ weight: 2, color: '#6366f1', fillOpacity: 0.95 });
          });
          layer.on('mouseout', function() {
            geojsonLayer.resetStyle(this);
          });
        }
      }).addTo(map);

      map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
    })
    .catch(err => console.error('Erro ao carregar mapa:', err));
}

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.classList.remove('open'); return; }
  const nq = normalize(q);
  const matches = allMunicipios.filter(m => normalize(m.nome).includes(nq)).slice(0, 20);
  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="search-empty">Nenhum município encontrado</div>';
  } else {
    searchResults.innerHTML = matches.map(m =>
      `<div class="search-item" data-cod="${m.cod_ibge}">
        ${m.nome.toUpperCase()}-${m.sigla_uf}
      </div>`
    ).join('');
  }
  searchResults.classList.add('open');
  searchResults.querySelectorAll('.search-item').forEach(item => {
    item.addEventListener('click', () => {
      showCityResult(item.dataset.cod);
      searchResults.classList.remove('open');
      searchInput.value = '';
    });
  });
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) searchResults.classList.remove('open');
});

function showCityResult(codIbge) {
  const muni = allMunicipios.find(m => m.cod_ibge === codIbge);
  const pibData = allPibs.find(p => p.cod_ibge === codIbge);
  if (!muni || !pibData) return;

  const pib = pibData.pib;
  const pibTotal = pibData.pib_total;
  const ano = pibData.ano;

  const ufPibs = allPibs.filter(p => p.sigla_uf === muni.sigla_uf);
  const ranking = ufPibs.filter(p => p.pib > pib).length + 1;
  const rankingPibTotal = ufPibs.filter(p => (p.pib_total || 0) > pibTotal).length + 1;

  const mediaNacional = 51693.92;
  const rankingNacional = allPibs.filter(p => p.pib > pib).length + 1;
  const rankingNacionalPibTotal = allPibs.filter(p => (p.pib_total || 0) > pibTotal).length + 1;

  document.getElementById('resultHeader').innerHTML = `
    <h2>${muni.nome.toUpperCase()}-${muni.sigla_uf}</h2>
    <div class="meta">
      <span>${muni.nome_regiao}</span>
      <br></br>
      <span>Ano: ${ano}</span>
    </div>
  `;

  const pctNacional = ((pib / mediaNacional - 1) * 100).toFixed(1);

  document.getElementById('cardsGrid').innerHTML = `
    <div class="stat-card">
      <div class="label">PIB</div>
      <div class="value">${fmt(pibTotal)}</div>
      <div class="sub">${rankingPibTotal}º de ${ufPibs.length} (estado) · ${rankingNacionalPibTotal}º de ${allPibs.length} (Brasil)</div>
    </div>
    <div class="stat-card">
      <div class="label">PIB per Capita</div>
      <div class="value">${fmtFull(pib)}</div>
      <div class="sub">${ranking}º de ${ufPibs.length} (estado) · ${rankingNacional}º de ${allPibs.length} (Brasil)</div>
    </div>
    <div class="stat-card">
      <div class="label">vs Brasil (per Capita)</div>
      <div class="value ${pctNacional >= 0 ? 'positive' : 'negative'}">${pctNacional >= 0 ? '+' : ''}${pctNacional}%</div>
    </div>
  `;

  document.getElementById('resultado').classList.remove('hidden');
  window.scrollTo({ top: document.getElementById('resultado').offsetTop - 80, behavior: 'smooth' });

  const t = getThemeColors();

  destroy('chartComparativo');
  charts['chartComparativo'] = new Chart(document.getElementById('chartComparativo').getContext('2d'), {
    type: 'bar',
    data: {
      labels: [muni.nome, 'Brasil'],
      datasets: [{
        data: [pib, mediaNacional],
        backgroundColor: [t.accent, t.muted],
        borderRadius: 8, barThickness: 56,
        categoryPercentage: 0.75, barPercentage: 0.65,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => fmt(c.parsed.y) } },
        datalabels: {
          display: true, anchor: 'end', align: 'top',
          color: t.text, font: { size: 12, weight: 600 },
          formatter: v => fmt(v), clamp: true, clip: false,
        }
      },
      scales: {
        y: { ticks: { callback: v => fmt(v), color: t.text, maxTicksLimit: 6 }, grid: { color: t.grid } },
        x: { ticks: { font: { weight: 600 }, color: t.text }, grid: { display: false } }
      }
    },
    plugins: [ChartDataLabels]
  });

  destroy('chartRanking');
  const sorted = [...ufPibs].sort((a, b) => b.pib - a.pib);
  const idx = sorted.findIndex(p => p.cod_ibge === codIbge);
  const slice = sorted.slice(Math.max(0, idx - 4), idx + 6);

  charts['chartRanking'] = new Chart(document.getElementById('chartRanking').getContext('2d'), {
    type: 'bar',
    data: {
      labels: slice.map(p => p.nome),
      datasets: [{
        data: slice.map(p => p.pib),
        backgroundColor: slice.map(p => p.cod_ibge === codIbge ? t.accent : t.muted),
        borderRadius: 6, barThickness: 18,
        categoryPercentage: 0.85, barPercentage: 0.75,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => fmt(c.parsed.x) } },
        datalabels: {
          display: true, anchor: 'end', align: 'right',
          color: t.text, font: { size: 10, weight: 600 },
          formatter: v => fmt(v), clamp: true, clip: false,
        }
      },
      scales: {
        x: { ticks: { callback: v => fmt(v), color: t.text, maxTicksLimit: 5 }, grid: { color: t.grid } },
        y: { ticks: { font: { weight: 500 }, color: t.text }, grid: { display: false } }
      }
    },
    plugins: [ChartDataLabels]
  });
}

function loadDashboard() {
  if (!dataReady || allPibs.length === 0) return;

  const data = allPibs;
  const total = data.length;
  const mediaNacional = 51693.92;
  const sorted = [...data].sort((a, b) => b.pib - a.pib);
  const maior = sorted[0];
  const menor = sorted[sorted.length - 1];
  const pibTotalSum = data.reduce((s, p) => s + (p.pib_total || 0), 0);

  const t = getThemeColors();

  document.getElementById('statsCards').innerHTML = `
    <div class="stat-card">
      <div class="label">Municípios</div>
      <div class="value">${fmtN(total)}</div>
    </div>
    <div class="stat-card">
      <div class="label">PIB</div>
      <div class="value">${fmt(pibTotalSum)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Média Brasil</div>
      <div class="value">${fmt(mediaNacional)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Maior</div>
      <div class="value">${fmt(maior.pib)}</div>
      <div class="sub">${maior.nome}/${maior.sigla_uf}</div>
    </div>
    <div class="stat-card">
      <div class="label">Menor</div>
      <div class="value">${fmt(menor.pib)}</div>
      <div class="sub">${menor.nome}/${menor.sigla_uf}</div>
    </div>
  `;

  destroy('chartRegioesTotal');
  const regioesTotal = {};
  data.forEach(p => {
    if (!regioesTotal[p.nome_regiao]) regioesTotal[p.nome_regiao] = 0;
    regioesTotal[p.nome_regiao] += p.pib_total || 0;
  });
  const regLabels = Object.keys(regioesTotal).sort((a, b) => regioesTotal[b] - regioesTotal[a]);
  const regValues = regLabels.map(r => regioesTotal[r]);

  charts['chartRegioesTotal'] = new Chart(document.getElementById('chartRegioesTotal').getContext('2d'), {
    type: 'bar',
    data: {
      labels: regLabels,
      datasets: [{
        data: regValues,
        backgroundColor: t.accent, borderRadius: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => fmt(c.parsed.y) } },
        datalabels: {
          display: true, anchor: 'end', align: 'top',
          color: t.text, font: { size: 11, weight: 600 },
          formatter: v => fmt(v), clamp: true, clip: false,
        }
      },
      scales: {
        y: { ticks: { callback: v => fmt(v), color: t.text, maxTicksLimit: 6 }, grid: { color: t.grid }, beginAtZero: true },
        x: { grid: { display: false }, ticks: { color: t.text } }
      }
    },
    plugins: [ChartDataLabels]
  });

  destroy('chartFaixas');
  const faixas = { 'R$ até 10k': 0, 'R$ 10-20k': 0, 'R$ 20-50k': 0, 'R$ 50-100k': 0, 'R$ 100-200k': 0, 'R$ 200-500k': 0, 'R$ acima 500k': 0 };
  data.forEach(p => {
    const v = p.pib;
    if (v < 10000) faixas['R$ até 10k']++;
    else if (v < 20000) faixas['R$ 10-20k']++;
    else if (v < 50000) faixas['R$ 20-50k']++;
    else if (v < 100000) faixas['R$ 50-100k']++;
    else if (v < 200000) faixas['R$ 100-200k']++;
    else if (v < 500000) faixas['R$ 200-500k']++;
    else faixas['R$ acima 500k']++;
  });

  charts['chartFaixas'] = new Chart(document.getElementById('chartFaixas').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(faixas),
      datasets: [{
        data: Object.values(faixas),
        backgroundColor: ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#6366f1', '#a855f7', '#78716c'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { padding: 12, font: { size: 11 }, color: t.text } },
        datalabels: {
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
          color: '#fff', font: { size: 10, weight: 600 },
          formatter: (v, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = ((v / total) * 100).toFixed(0);
            return pct > 3 ? `${pct}%` : '';
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  buildPibMap();
  initFilters();
  updateTop10Charts();
}

let filterRegioes = [];
let filterUFs = [];

function initFilters() {
  const regioes = [...new Set(allPibs.map(p => p.nome_regiao))].sort();
  const ufs = [...new Set(allPibs.map(p => p.sigla_uf))].sort();

  const dropdownRegiao = document.getElementById('dropdownRegiao');
  dropdownRegiao.innerHTML = regioes.map(r =>
    `<div class="multi-select-option" data-value="${r}">
      <div class="check"></div>${r}
    </div>`
  ).join('');

  const dropdownUF = document.getElementById('dropdownUF');
  dropdownUF.innerHTML = ufs.map(uf =>
    `<div class="multi-select-option" data-value="${uf}">
      <div class="check"></div>${uf}
    </div>`
  ).join('');

  document.getElementById('filterRegiao').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('filterRegiao').classList.toggle('open');
    document.getElementById('filterUF').classList.remove('open');
  });

  document.getElementById('filterUF').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('filterUF').classList.toggle('open');
    document.getElementById('filterRegiao').classList.remove('open');
  });

  document.addEventListener('click', () => {
    document.getElementById('filterRegiao').classList.remove('open');
    document.getElementById('filterUF').classList.remove('open');
  });

  dropdownRegiao.querySelectorAll('.multi-select-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = opt.dataset.value;
      opt.classList.toggle('selected');
      if (filterRegioes.includes(val)) {
        filterRegioes = filterRegioes.filter(r => r !== val);
      } else {
        filterRegioes.push(val);
      }
      updateFilterUI();
      updateTop10Charts();
    });
  });

  dropdownUF.querySelectorAll('.multi-select-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = opt.dataset.value;
      opt.classList.toggle('selected');
      if (filterUFs.includes(val)) {
        filterUFs = filterUFs.filter(u => u !== val);
      } else {
        filterUFs.push(val);
      }
      updateFilterUI();
      updateTop10Charts();
    });
  });
}

function updateFilterUI() {
  const triggerRegiao = document.getElementById('triggerRegiao');
  const triggerUF = document.getElementById('triggerUF');
  triggerRegiao.textContent = filterRegioes.length > 0 ? filterRegioes.join(', ') : 'Todas';
  triggerUF.textContent = filterUFs.length > 0 ? filterUFs.join(', ') : 'Todos';

  const tagsEl = document.getElementById('filterTags');
  const tags = [];
  filterRegioes.forEach(r => tags.push({ type: 'regiao', value: r }));
  filterUFs.forEach(u => tags.push({ type: 'uf', value: u }));
  tagsEl.innerHTML = tags.map(t =>
    `<div class="filter-tag">
      ${t.value}
      <button onclick="removeFilter('${t.type}', '${t.value}')">&times;</button>
    </div>`
  ).join('');
}

function removeFilter(type, value) {
  if (type === 'regiao') {
    filterRegioes = filterRegioes.filter(r => r !== value);
    document.querySelector(`#dropdownRegiao .multi-select-option[data-value="${value}"]`).classList.remove('selected');
  } else {
    filterUFs = filterUFs.filter(u => u !== value);
    document.querySelector(`#dropdownUF .multi-select-option[data-value="${value}"]`).classList.remove('selected');
  }
  updateFilterUI();
  updateTop10Charts();
}

function getFilteredData() {
  let data = allPibs;
  if (filterRegioes.length > 0) {
    data = data.filter(p => filterRegioes.includes(p.nome_regiao));
  }
  if (filterUFs.length > 0) {
    data = data.filter(p => filterUFs.includes(p.sigla_uf));
  }
  return data;
}

function updateTop10Charts() {
  const data = getFilteredData();
  const t = getThemeColors();
  const sorted = [...data].sort((a, b) => b.pib - a.pib);

  destroy('chartTop10');
  const top10 = sorted.slice(0, 10);
  charts['chartTop10'] = new Chart(document.getElementById('chartTop10').getContext('2d'), {
    type: 'bar',
    data: {
      labels: top10.map(p => `${p.nome}/${p.sigla_uf}`),
      datasets: [{
        data: top10.map(p => p.pib),
        backgroundColor: t.accent, borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => fmt(c.parsed.x) } },
        datalabels: {
          display: true, anchor: 'end', align: 'right',
          color: t.text, font: { size: 10, weight: 600 },
          formatter: v => fmt(v), clamp: true, clip: false,
        }
      },
      scales: {
        x: { ticks: { callback: v => fmt(v), color: t.text, maxTicksLimit: 5 }, grid: { color: t.grid }, beginAtZero: true },
        y: { ticks: { font: { size: 11 }, color: t.text }, grid: { display: false } }
      }
    },
    plugins: [ChartDataLabels]
  });

  destroy('chartTop10Total');
  const sortedTotal = [...data].sort((a, b) => (b.pib_total || 0) - (a.pib_total || 0));
  const top10Total = sortedTotal.slice(0, 10);
  charts['chartTop10Total'] = new Chart(document.getElementById('chartTop10Total').getContext('2d'), {
    type: 'bar',
    data: {
      labels: top10Total.map(p => `${p.nome}/${p.sigla_uf}`),
      datasets: [{
        data: top10Total.map(p => p.pib_total || 0),
        backgroundColor: t.accent, borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => fmt(c.parsed.x) } },
        datalabels: {
          display: true, anchor: 'end', align: 'right',
          color: t.text, font: { size: 10, weight: 600 },
          formatter: v => fmt(v), clamp: true, clip: false,
        }
      },
      scales: {
        x: { ticks: { callback: v => fmt(v), color: t.text, maxTicksLimit: 5 }, grid: { color: t.grid }, beginAtZero: true },
        y: { ticks: { font: { size: 11 }, color: t.text }, grid: { display: false } }
      }
    },
    plugins: [ChartDataLabels]
  });
}

loadData().catch(console.error);