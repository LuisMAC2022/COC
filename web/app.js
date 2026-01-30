const DATA_PATH = "/backend/outputs/clan_snapshot.json";

const formatPct = (value) => `${Math.round(value * 100)}%`;

const TH_COLOR_TOKENS = {
  1: "--th-1",
  2: "--th-2",
  3: "--th-3",
  4: "--th-4",
  5: "--th-5",
  6: "--th-6",
  7: "--th-7",
  8: "--th-8",
  9: "--th-9",
  10: "--th-10",
  11: "--th-11",
  12: "--th-12",
  13: "--th-13",
  14: "--th-14",
  15: "--th-15",
  16: "--th-16",
};

const getHeatClass = (value) => {
  if (value >= 0.98) return "heat-high";
  if (value >= 0.9) return "heat-mid";
  if (value >= 0.75) return "heat-low";
  return "";
};

const normalizeThDistribution = (distribution) => {
  const thMap = new Map();
  distribution.forEach((item) => {
    if (typeof item.th === "number") {
      thMap.set(item.th, typeof item.count === "number" ? item.count : 0);
    }
  });
  const thValues = [...thMap.keys()];
  if (!thValues.length) return [];
  const minTh = Math.min(...thValues);
  const maxTh = Math.max(...thValues);
  const normalized = [];
  for (let th = minTh; th <= maxTh; th += 1) {
    const count = thMap.get(th) ?? 0;
    normalized.push({ th, count });
  }
  return normalized;
};

const createKpiCard = (label, value, note) => {
  const card = document.createElement("div");
  card.className = "kpi-card";
  card.innerHTML = `
    <span>${label}</span>
    <strong>${value}</strong>
    ${note ? `<small>${note}</small>` : ""}
  `;
  return card;
};

const createWarStatsCard = (stats) => {
  const card = document.createElement("div");
  card.className = "kpi-card kpi-card--compact";
  const description = document.createElement("span");
  description.textContent = "Guerra";
  const list = document.createElement("dl");
  list.className = "kpi-inline";
  const addItem = ({ label, value, title }) => {
    const item = document.createElement("div");
    item.className = "kpi-inline-item";
    const term = document.createElement("dt");
    if (title) {
      const abbr = document.createElement("abbr");
      abbr.title = title;
      abbr.textContent = label;
      term.appendChild(abbr);
    } else {
      term.textContent = label;
    }
    const detail = document.createElement("dd");
    detail.textContent = value;
    item.appendChild(term);
    item.appendChild(detail);
    list.appendChild(item);
  };

  stats.forEach(addItem);
  card.appendChild(description);
  card.appendChild(list);
  return card;
};

const renderKpis = (data) => {
  const grid = document.getElementById("kpi-grid");
  grid.innerHTML = "";
  const clan = data.clan || {};
  const aggregates = data.aggregates || {};
  const warWins = typeof clan.warWins === "number" ? clan.warWins : null;
  const warTies = typeof clan.warTies === "number" ? clan.warTies : null;
  const warLosses = typeof clan.warLosses === "number" ? clan.warLosses : null;
  const canComputeWars =
    typeof warWins === "number" &&
    typeof warTies === "number" &&
    typeof warLosses === "number";
  const totalWars = canComputeWars ? warWins + warTies + warLosses : null;
  const winRate =
    typeof totalWars === "number" && totalWars > 0 ? formatPct(warWins / totalWars) : "--";
  const streakValue =
    typeof clan.warWinStreak === "number" && clan.warWinStreak >= 1
      ? clan.warWinStreak
      : null;
  const warStats = [
    { label: "Guerras", value: totalWars ?? "--" },
    { label: "V", value: warWins ?? "--", title: "Victorias" },
    { label: "D", value: warLosses ?? "--", title: "Derrotas" },
    { label: "E", value: warTies ?? "--", title: "Empates" },
    { label: "%", value: winRate, title: "Porcentaje de victorias" },
  ];
  if (streakValue !== null) {
    warStats.push({ label: "Streak", value: streakValue });
  }
  grid.appendChild(createKpiCard("TH promedio", aggregates.thAvg ?? "--"));
  grid.appendChild(createKpiCard("Miembros", clan.members ?? "--"));
  grid.appendChild(createWarStatsCard(warStats));
};

const renderThChart = (data) => {
  const chart = document.getElementById("th-chart");
  chart.innerHTML = "";
  const distribution = normalizeThDistribution(data.aggregates?.thDistribution ?? []);
  if (!distribution.length) return;
  const max = Math.max(...distribution.map((item) => item.count), 1);
  distribution.forEach((item) => {
    const column = document.createElement("div");
    column.className = `histogram-bar${item.count === 0 ? " histogram-bar--empty" : ""}`;
    column.setAttribute("role", "listitem");
    column.innerHTML = `
      <span class="bar-value">${item.count}</span>
      <div class="bar-area">
        <span class="bar" style="height:${(item.count / max) * 100}%;--bar-color: var(${TH_COLOR_TOKENS[item.th] || "--heat-mid"});"></span>
      </div>
      <span class="bar-label">TH ${item.th}</span>
    `;
    chart.appendChild(column);
  });
};

const renderPlayers = (players) => {
  const body = document.getElementById("players-body");
  body.innerHTML = "";
  players.forEach((player) => {
    const power = player.derived?.powerIndex || {};
    const topResearch = player.derived?.topResearchByCat || {};
    const avgPower = [power.troops, power.spells, power.heroes, power.heroEquipment].filter(
      (value) => typeof value === "number"
    );
    const avgValue = avgPower.length
      ? avgPower.reduce((acc, value) => acc + value, 0) / avgPower.length
      : 0;

    const row = document.createElement("tr");
    const formatUnit = (unit) => `${unit.name} (Nv. ${unit.level})`;
    const renderTopList = (label, units) => {
      const display = Array.isArray(units) && units.length
        ? units.map(formatUnit).join(", ")
        : "<span class=\"muted\">Sin datos</span>";
      return `<li><strong>${label}:</strong> ${display}</li>`;
    };
    const topListHtml = `
      <ul class="player-top-list">
        ${renderTopList("Tropas", topResearch.troops)}
        ${renderTopList("Mascotas", topResearch.pets)}
        ${renderTopList("Hechizos", topResearch.spells)}
      </ul>
    `;

    row.innerHTML = `
      <td>
        <strong>${player.name ?? "--"}</strong><br />
        <small>${player.tag ?? ""}</small>
      </td>
      <td>${player.th ?? "--"}</td>
      <td>
        <span class="badge ${getHeatClass(avgValue)}">${formatPct(avgValue)}</span>
      </td>
      <td>${topListHtml}</td>
      <td>${player.derived?.superActiveCount ?? 0}</td>
    `;
    body.appendChild(row);
  });
};

const filterPlayers = (players, query) => {
  if (!query) return players;
  const normalized = query.trim().toLowerCase();
  return players.filter((player) => {
    const name = player.name?.toLowerCase() ?? "";
    const tag = player.tag?.toLowerCase() ?? "";
    return name.includes(normalized) || tag.includes(normalized);
  });
};

const updateDataNote = (data) => {
  const note = document.getElementById("data-note");
  const generatedAt = data.meta?.generatedAt;
  const warlog = data.clan?.warlog ? "Warlog incluido." : "Warlog no disponible.";
  note.textContent = generatedAt
    ? `Última actualización: ${new Date(generatedAt).toLocaleString()}. ${warlog}`
    : "Datos cargados.";
};

const loadData = async () => {
  const response = await fetch(DATA_PATH);
  if (!response.ok) {
    throw new Error("No se pudo cargar clan_snapshot.json");
  }
  return response.json();
};

const init = async () => {
  try {
    const data = await loadData();
    const players = data.members || [];
    renderKpis(data);
    renderThChart(data);
    renderPlayers(players);
    updateDataNote(data);

    const search = document.getElementById("player-search");
    search.addEventListener("input", (event) => {
      const filtered = filterPlayers(players, event.target.value);
      renderPlayers(filtered);
    });
  } catch (error) {
    const note = document.getElementById("data-note");
    note.textContent = error.message;
  }
};

document.addEventListener("DOMContentLoaded", init);
