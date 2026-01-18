const DATA_PATH = "../backend/outputs/war_active.json";

const formatPct = (value) => `${Math.round(value * 100)}%`;

const getHeatClass = (value) => {
  if (value >= 0.98) return "heat-high";
  if (value >= 0.9) return "heat-mid";
  if (value >= 0.75) return "heat-low";
  return "";
};

const getGapClass = (value) => {
  if (value > 0.03) return "gap-positive";
  if (value < -0.03) return "gap-negative";
  return "gap-neutral";
};

const buildThreatList = (threats) => {
  const wrapper = document.createElement("div");
  Object.entries(threats || {}).forEach(([category, units]) => {
    const section = document.createElement("div");
    section.className = "threat-category";
    section.innerHTML = `<h4>${category}</h4>`;
    const list = document.createElement("ul");
    list.className = "threat-list";
    units.slice(0, 5).forEach((unit) => {
      const item = document.createElement("li");
      item.innerHTML = `
        <span>${unit.unit ?? "--"}</span>
        <span class="badge ${getHeatClass(unit.avgPct ?? 0)}">${formatPct(
        unit.avgPct ?? 0
      )}</span>
        <small>Disponibilidad ${(unit.availability ?? 0) * 100}%</small>
      `;
      list.appendChild(item);
    });
    section.appendChild(list);
    wrapper.appendChild(section);
  });
  return wrapper;
};

const renderThreats = (data) => {
  const clan = document.getElementById("clan-threats");
  const opponent = document.getElementById("opponent-threats");
  clan.innerHTML = "";
  opponent.innerHTML = "";
  const threats = data.derived?.topThreats || {};
  clan.appendChild(buildThreatList(threats.clan || {}));
  opponent.appendChild(buildThreatList(threats.opponent || {}));
};

const renderGaps = (data) => {
  const container = document.getElementById("gap-list");
  container.innerHTML = "";
  const gaps = data.derived?.gaps || {};
  Object.entries(gaps).forEach(([category, items]) => {
    const section = document.createElement("div");
    section.className = "gap-category";
    section.innerHTML = `<h4>${category}</h4>`;
    const list = document.createElement("ul");
    list.className = "gap-items";
    items.slice(0, 6).forEach((item) => {
      const value = item.gapPct ?? 0;
      const entry = document.createElement("li");
      entry.innerHTML = `
        <span>${item.unit ?? "--"}</span>
        <span class="badge ${getGapClass(value)}">${formatPct(Math.abs(value))}</span>
      `;
      list.appendChild(entry);
    });
    section.appendChild(list);
    container.appendChild(section);
  });
};

const describeProfile = (profile) => {
  const power = profile?.derived?.powerIndex || {};
  return [
    { label: "Tropas", value: power.troops },
    { label: "Hechizos", value: power.spells },
    { label: "Héroes", value: power.heroes },
    { label: "Equipamiento", value: power.heroEquipment },
  ];
};

const renderPowerBars = (profile) => {
  const list = document.createElement("ul");
  list.className = "power-bars";
  describeProfile(profile).forEach((item) => {
    const value = item.value ?? 0;
    const row = document.createElement("li");
    row.innerHTML = `
      <span>${item.label}</span>
      <span class="bar"><span style="width:${Math.round(value * 100)}%"></span></span>
      <span class="badge ${getHeatClass(value)}">${formatPct(value)}</span>
    `;
    list.appendChild(row);
  });
  return list;
};

const renderMatchups = (data) => {
  const body = document.getElementById("matchups-body");
  body.innerHTML = "";

  const teams = data.teams || [];
  const clan = teams.find((team) => team.side === "clan");
  const opponent = teams.find((team) => team.side === "opponent");
  const clanMembers = clan?.members || [];
  const opponentMembers = opponent?.members || [];

  const positions = new Set();
  clanMembers.forEach((member) => positions.add(member.mapPosition || 0));
  opponentMembers.forEach((member) => positions.add(member.mapPosition || 0));

  const sortedPositions = Array.from(positions).sort((a, b) => a - b);

  sortedPositions.forEach((position) => {
    const clanMember = clanMembers.find((member) => member.mapPosition === position);
    const opponentMember = opponentMembers.find((member) => member.mapPosition === position);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${position || "--"}</td>
      <td class="cell-profile"></td>
      <td class="cell-profile"></td>
      <td>
        <button class="button" type="button" data-clan="${clanMember?.tag ?? ""}" data-opponent="${
      opponentMember?.tag ?? ""
    }">Comparar</button>
      </td>
    `;
    const clanCell = row.querySelectorAll("td")[1];
    const oppCell = row.querySelectorAll("td")[2];
    clanCell.appendChild(renderProfileCard(clanMember));
    oppCell.appendChild(renderProfileCard(opponentMember));
    body.appendChild(row);
  });
};

const renderProfileCard = (member) => {
  const card = document.createElement("div");
  card.className = "profile-card";
  if (!member) {
    card.textContent = "Sin datos";
    return card;
  }
  card.innerHTML = `
    <strong>${member.name ?? "--"}</strong>
    <small>${member.tag ?? ""}</small>
  `;
  card.appendChild(renderPowerBars(member.profile));
  return card;
};

const openCompare = (data, clanTag, opponentTag) => {
  const dialog = document.getElementById("compare-dialog");
  const grid = document.getElementById("compare-grid");
  grid.innerHTML = "";

  const findMember = (tag) =>
    data.teams
      ?.flatMap((team) => team.members || [])
      .find((member) => member.tag === tag);

  const clanMember = findMember(clanTag);
  const opponentMember = findMember(opponentTag);

  [clanMember, opponentMember].forEach((member) => {
    const panel = document.createElement("div");
    panel.className = "compare-panel";
    if (!member) {
      panel.textContent = "Sin datos";
    } else {
      panel.innerHTML = `
        <strong>${member.name ?? "--"}</strong>
        <small>${member.tag ?? ""}</small>
      `;
      panel.appendChild(renderPowerBars(member.profile));
    }
    grid.appendChild(panel);
  });

  dialog.showModal();
};

const attachCompareHandlers = (data) => {
  const body = document.getElementById("matchups-body");
  body.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-clan]");
    if (!button) return;
    openCompare(data, button.dataset.clan, button.dataset.opponent);
  });

  const close = document.getElementById("close-compare");
  close.addEventListener("click", () => {
    document.getElementById("compare-dialog").close();
  });
};

const loadData = async () => {
  const response = await fetch(DATA_PATH);
  if (!response.ok) {
    throw new Error("No se pudo cargar war_active.json");
  }
  return response.json();
};

const renderEmptyState = (state) => {
  const note = document.getElementById("war-state");
  if (state === "notInWar") {
    note.textContent = "El clan no está en guerra activa actualmente.";
  } else if (state === "preparation") {
    note.textContent = "La guerra está en preparación. Los datos pueden estar incompletos.";
  } else if (state === "warEnded") {
    note.textContent = "La guerra terminó. Usa esta vista como referencia histórica.";
  } else if (state === "unknown") {
    note.textContent = "Estado de guerra no disponible.";
  } else {
    note.textContent = "";
  }
};

const init = async () => {
  try {
    const data = await loadData();
    renderThreats(data);
    renderGaps(data);
    renderMatchups(data);
    renderEmptyState(data.meta?.state);
    attachCompareHandlers(data);
  } catch (error) {
    const note = document.getElementById("war-state");
    note.textContent = error.message;
  }
};

document.addEventListener("DOMContentLoaded", init);
