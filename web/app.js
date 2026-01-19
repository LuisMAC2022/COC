const DATA_PATH = "/backend/outputs/clan_snapshot.json";

const formatPct = (value) => `${Math.round(value * 100)}%`;

const getHeatClass = (value) => {
  if (value >= 0.98) return "heat-high";
  if (value >= 0.9) return "heat-mid";
  if (value >= 0.75) return "heat-low";
  return "";
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
  grid.appendChild(createKpiCard("TH promedio", aggregates.thAvg ?? "--"));
  grid.appendChild(createKpiCard("Miembros", clan.members ?? "--"));
  grid.appendChild(createKpiCard("Guerras totales", totalWars ?? "--"));
  grid.appendChild(createKpiCard("Victorias", warWins ?? "--"));
  grid.appendChild(createKpiCard("% victorias", winRate));
  grid.appendChild(createKpiCard("Empates", warTies ?? "--"));
  grid.appendChild(createKpiCard("Derrotas", warLosses ?? "--"));
  grid.appendChild(createKpiCard("Streak", clan.warWinStreak ?? "--"));
};

const renderThChart = (data) => {
  const chart = document.getElementById("th-chart");
  chart.innerHTML = "";
  const distribution = data.aggregates?.thDistribution ?? [];
  const max = Math.max(...distribution.map((item) => item.count), 1);
  distribution.forEach((item) => {
    const column = document.createElement("div");
    column.className = "histogram-bar";
    column.setAttribute("role", "listitem");
    column.innerHTML = `
      <span class="bar-value">${item.count}</span>
      <div class="bar-area">
        <span class="bar" style="height:${(item.count / max) * 100}%"></span>
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
