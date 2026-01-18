const DATA_PATH = "/backend/outputs/war_execution.json";

const formatPct = (value) => `${Math.round(value)}%`;

const formatSigned = (value) => {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
};

const createLeaderboardCard = (title, items, valueLabel) => {
  const card = document.createElement("article");
  card.className = "panel";
  const listItems = items.length
    ? items
        .map(
          (item) => `
            <li>
              <div>
                <strong>${item.name ?? "--"}</strong>
                <small>${item.tag ?? ""}</small>
              </div>
              <span>${valueLabel(item)}</span>
            </li>
          `
        )
        .join("")
    : '<li class="empty-state">Sin datos disponibles.</li>';

  card.innerHTML = `
    <h3>${title}</h3>
    <ol class="leaderboard-list">${listItems}</ol>
  `;
  return card;
};

const renderLeaderboards = (data) => {
  const container = document.getElementById("leaderboards");
  container.innerHTML = "";
  const leaderboards = data.leaderboards || {};

  container.appendChild(
    createLeaderboardCard("MVP Score", leaderboards.mvp || [], (item) =>
      (item.mvpScore ?? 0).toFixed(2)
    )
  );
  container.appendChild(
    createLeaderboardCard("Estrellas", leaderboards.stars || [], (item) => item.totalStars ?? 0)
  );
  container.appendChild(
    createLeaderboardCard("Destrucción prom.", leaderboards.destruction || [], (item) =>
      formatPct(item.avgDestruction ?? 0)
    )
  );
  container.appendChild(
    createLeaderboardCard(
      "Ataques usados",
      leaderboards.attacksUsed || [],
      (item) => item.attacksUsed ?? 0
    )
  );
};

const renderScatter = (data) => {
  const scatter = document.getElementById("scatter-plot");
  scatter.innerHTML = "";
  const points = data.scatter || [];
  if (!points.length) {
    scatter.innerHTML = '<p class="empty-state">Sin datos para graficar.</p>';
    return;
  }

  const deltas = points.map((point) => point.avgDelta ?? 0);
  const stars = points.map((point) => point.avgStars ?? 0);
  const minDelta = Math.min(...deltas);
  const maxDelta = Math.max(...deltas);
  const maxStars = Math.max(...stars, 1);

  points.forEach((point) => {
    const delta = point.avgDelta ?? 0;
    const avgStars = point.avgStars ?? 0;
    const xRange = maxDelta - minDelta || 1;
    const x = ((delta - minDelta) / xRange) * 100;
    const y = (avgStars / maxStars) * 100;
    const dot = document.createElement("span");
    dot.className = "scatter-point";
    dot.style.left = `${x}%`;
    dot.style.bottom = `${y}%`;
    dot.setAttribute(
      "aria-label",
      `${point.name ?? "Jugador"}: delta ${formatSigned(delta)}, estrellas ${avgStars}`
    );
    dot.setAttribute("role", "img");
    dot.title = `${point.name ?? "--"} (${formatSigned(delta)}, ${avgStars}★)`;
    scatter.appendChild(dot);
  });
};

const getDisciplineClass = (attacksUsed) => {
  if (attacksUsed <= 0) return "status-miss";
  if (attacksUsed === 1) return "status-one";
  return "status-full";
};

const renderDiscipline = (players) => {
  const body = document.getElementById("discipline-body");
  body.innerHTML = "";
  players.forEach((player) => {
    const attacksUsed = player.attacksUsed ?? 0;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <strong>${player.name ?? "--"}</strong><br />
        <small>${player.tag ?? ""}</small>
      </td>
      <td><span class="badge ${getDisciplineClass(attacksUsed)}">${attacksUsed}/2</span></td>
      <td>${player.totalStars ?? 0}</td>
      <td>${formatPct(player.avgDestruction ?? 0)}</td>
      <td>${formatSigned(player.avgDelta ?? 0)}</td>
    `;
    body.appendChild(row);
  });
};

const renderAttacks = (attacks) => {
  const body = document.getElementById("attacks-body");
  body.innerHTML = "";
  attacks.forEach((attack) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${attack.order ?? "--"}</td>
      <td>
        <strong>${attack.attackerName ?? "--"}</strong><br />
        <small>${attack.attackerTag ?? ""}</small>
      </td>
      <td>
        <strong>${attack.defenderName ?? "--"}</strong><br />
        <small>${attack.defenderTag ?? ""}</small>
      </td>
      <td>${attack.stars ?? 0}</td>
      <td>${formatPct(attack.destruction ?? 0)}</td>
      <td>${formatSigned(attack.delta ?? 0)}</td>
      <td>${attack.mvpScore ?? 0}</td>
    `;
    body.appendChild(row);
  });
};

const updateDataNote = (data) => {
  const note = document.getElementById("data-note");
  if (data.meta?.state === "notInWar") {
    note.textContent = "El clan no está en guerra activa actualmente.";
    return;
  }
  const generatedAt = data.meta?.generatedAt;
  const timingNote = data.meta?.note ?? "";
  note.textContent = generatedAt
    ? `Última actualización: ${new Date(generatedAt).toLocaleString()}. ${timingNote}`
    : "Datos cargados.";
};

const loadData = async () => {
  const response = await fetch(DATA_PATH);
  if (!response.ok) {
    throw new Error("No se pudo cargar war_execution.json");
  }
  return response.json();
};

const init = async () => {
  try {
    const data = await loadData();
    renderLeaderboards(data);
    renderScatter(data);
    renderDiscipline(data.players || []);
    renderAttacks(data.attacks || []);
    updateDataNote(data);
  } catch (error) {
    const note = document.getElementById("data-note");
    note.textContent = error.message;
  }
};

document.addEventListener("DOMContentLoaded", init);
