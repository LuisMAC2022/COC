const DATA_PATH = "/backend/outputs/clan_snapshot.json";

const formatPct = (value) => `${Math.round(value * 100)}%`;

const flattenDonors = (resources) => {
  const donorsByCategory = resources?.topDonors || {};
  return Object.entries(donorsByCategory).flatMap(([category, units]) =>
    Object.entries(units || {}).map(([unit, donors]) => ({
      category,
      unit,
      donors: donors || [],
    }))
  );
};

const renderDonors = (rows) => {
  const body = document.getElementById("donors-body");
  body.innerHTML = "";
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="3" class="empty-state">Sin datos disponibles.</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const entry = document.createElement("tr");
    const donors = row.donors.length
      ? `
        <ul class="donor-list">
          ${row.donors
            .map(
              (donor) => `
              <li>
                <strong>${donor.name ?? "--"}</strong>
                <small>${donor.tag ?? ""}</small>
                <span class="badge">${donor.level ?? "--"}/${donor.maxLevel ?? "--"}</span>
              </li>
            `
            )
            .join("")}
        </ul>
      `
      : '<span class="empty-state">Sin donadores</span>';

    entry.innerHTML = `
      <td>${row.unit ?? "--"}</td>
      <td>${row.category ?? "--"}</td>
      <td>${donors}</td>
    `;
    body.appendChild(entry);
  });
};

const filterDonors = (rows, query) => {
  if (!query) return rows;
  const normalized = query.trim().toLowerCase();
  return rows.filter((row) => {
    return (
      row.unit.toLowerCase().includes(normalized) ||
      row.category.toLowerCase().includes(normalized)
    );
  });
};

const renderCoverage = (resources) => {
  const container = document.getElementById("coverage-gaps");
  container.innerHTML = "";
  const gapsByCategory = resources?.coverageGaps || {};
  const categories = Object.entries(gapsByCategory);
  if (!categories.length) {
    container.innerHTML = '<p class="empty-state">Sin datos disponibles.</p>';
    return;
  }

  categories.forEach(([category, gaps]) => {
    const section = document.createElement("section");
    section.className = "panel";
    section.innerHTML = `<h3>${category}</h3>`;
    const list = document.createElement("ul");
    list.className = "coverage-list";
    (gaps || []).forEach((gap) => {
      const rate = gap.coverageRate ?? 0;
      const item = document.createElement("li");
      item.className = "coverage-row";
      item.innerHTML = `
        <div class="coverage-meta">
          <strong>${gap.unit ?? "--"}</strong>
          <span class="badge">${gap.coverage90 ?? 0} con 90%+</span>
          <span class="badge">${formatPct(rate)}</span>
        </div>
        <div class="coverage-bar" role="img" aria-label="Cobertura ${formatPct(rate)}">
          <span style="width:${Math.round(rate * 100)}%"></span>
        </div>
      `;
      list.appendChild(item);
    });
    if (!list.children.length) {
      list.innerHTML = '<li class="empty-state">Sin gaps relevantes.</li>';
    }
    section.appendChild(list);
    container.appendChild(section);
  });
};

const renderRecommendations = (resources) => {
  const container = document.getElementById("recommendations");
  container.innerHTML = "";
  const recommendations = resources?.recommendations || [];
  if (!recommendations.length) {
    container.innerHTML = '<p class="empty-state">Sin recomendaciones disponibles.</p>';
    return;
  }

  recommendations.forEach((rec) => {
    const card = document.createElement("article");
    card.className = "panel recommendation-card";
    const suggestions = rec.suggestions || [];
    card.innerHTML = `
      <h3>${rec.player?.name ?? "--"}</h3>
      <p class="muted">${rec.player?.tag ?? ""}</p>
      <ul class="recommendation-list">
        ${
          suggestions.length
            ? suggestions
                .map(
                  (item) => `
                  <li>
                    <strong>${item.unit ?? "--"}</strong>
                    <span class="badge">${item.category ?? "--"}</span>
                    <span class="badge">${formatPct(item.pct ?? 0)}</span>
                    <span class="badge">Cobertura ${formatPct(item.coverageRate ?? 0)}</span>
                  </li>
                `
                )
                .join("")
            : '<li class="empty-state">Sin sugerencias.</li>'
        }
      </ul>
    `;
    container.appendChild(card);
  });
};

const updateNotes = (data) => {
  const note = document.getElementById("resources-note");
  const generatedAt = data.meta?.generatedAt;
  const resourcesNote = data.aggregates?.resources?.note ?? "";
  note.textContent = generatedAt
    ? `Última actualización: ${new Date(generatedAt).toLocaleString()}. ${resourcesNote}`
    : resourcesNote || "Datos cargados.";
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
    const resources = data.aggregates?.resources || {};
    const donorRows = flattenDonors(resources).sort((a, b) =>
      a.unit.localeCompare(b.unit)
    );
    renderDonors(donorRows);
    renderCoverage(resources);
    renderRecommendations(resources);
    updateNotes(data);

    const search = document.getElementById("donor-search");
    search.addEventListener("input", (event) => {
      const filtered = filterDonors(donorRows, event.target.value);
      renderDonors(filtered);
    });
  } catch (error) {
    const note = document.getElementById("resources-note");
    note.textContent = error.message;
  }
};

document.addEventListener("DOMContentLoaded", init);
