# COC

Prompt de desarrollo (A–D) para un sistema de scouting/analytics con la API de Clash of Clans

Convierte esto en un producto con cuatro objetivos integrados, desarrollados secuencialmente y reutilizando componentes.

A) Seguimiento de estadísticas del clan (baseline + “perfil de poder”)

Objetivo: tener un “panel de salud” del clan que permita entender capacidad ofensiva/defensiva y distribución de fuerza sin ver guerra.

A1. Alcance funcional (qué debe hacer)

Resumen del clan (KPI):

Ayuntamiento promedio (y distribución por rangos)

Miembros totales (y cuántos activos “recientemente” si se puede inferir en base al warlog)

Guerras jugadas + win ratio (si hay acceso a warlog; si no, mostrar wins/streak/ties/losses)

Perfil de combate por jugador (solo Home):

Top tropas/hechizos/héroes/equipment (por %max) por jugador

“Especialidades” por jugador: unidades con %max ≥ 90% y disponibilidad de super (si aplica)

Exploración rápida:

buscador por jugador

“Top donadores potenciales” por tipo (ver sección D, pero se prepara la base aquí)

A2. Datos (fuentes y normalización)

GET /clans/{clanTag} para metadatos.

GET /clans/{clanTag}/members para roster estable.

GET /players/{playerTag} para tropas/hechizos/héroes/equipment.

Opcional (si disponible): GET /clans/{clanTag}/warlog?limit=N para win ratio reciente.

Modelo de datos unificado (reutilizable en B–D):

PlayerProfile: {tag, name, th, categories[troops/spells/heroes/heroEquipment], derived: {powerIndexByCat, topUnitsByCat, superCount}}

ClanSnapshot: {timestamp, clanMeta, members[], aggregates{thAvg, distributions, topByCategory, availability}}

A3. Visualización recomendada (no técnica)

KPI cards arriba (TH promedio, wins, win ratio, streak).

Histograma/stacked bar para distribución de TH (rápido de leer).

Tabla compacta por jugador: columnas “PowerIndex” por categoría + badges de “amenazas” (≥90%).

Heatmap en detalle : solo para vista drill-down.

Colores:

Mantén “amenaza alta” como tonos fríos intensos (morado/azul), no verde.

Usa rojo solo para alertas negativas (inactividad, ataques faltantes) en C.

A4. Buenas prácticas 

Pipeline por capas: fetch → normalize → derive → render.

Caching local (archivos JSON con timestamp) para no quemar rate limits.

Feature detection: si warlog no está, degradar UI sin romper.

Entregable A: dashboard “Clan Overview” + export clan_snapshot.json + componentes reutilizables (normalizador, calculador de %max, powerIndex, heatmap).

Estado de implementación A

Backend (export)
- Configura backend/config.example.json (clanTag, token env var, TTL).
- Exporta el snapshot con: python -m backend.export.export_clan_snapshot --config backend/config.example.json
- El export crea backend/outputs/clan_snapshot.json con meta, clan, members y aggregates.

Frontend (UI)
- Abre web/pages/clan.html (sirve por HTTP) para ver KPI, histograma TH y tabla filtrable.
- Lee el JSON desde backend/outputs/clan_snapshot.json y degrada si falta warlog.

B) Análisis de guerra activa (scouting por matchups y amenazas)

Objetivo: durante una guerra activa, entender rápidamente el rival y cada matchup, con foco en combate (heroes/equipment/army/spells/pets en troops).

B1. Alcance funcional

War Overview (clan vs oponente):

Gap por categoría incluir:

“amenazas dominantes del rival” 

“amenazas dominantes del clan”

Comparación por posición en mapa (matchups):

Vista lado a lado por mapPosition con:

columna “perfil rápido” del atacante y del defensor (PowerIndex por cat)

botón “comparar A vs B”  precargado con ese par

Threat-to-base checklist por rival:

lista automatizada basada en hechizos/equipment dominantes del rival (reglas simples, explicables)

B2. Datos

Reutiliza A, y añade:

GET /clans/{clanTag}/currentwar

Para cada miembro en war: GET /players/{tag} 

Normalización clave:

“pets” permanecen dentro de troops (home).

Guardar mapPosition y linkearlo con PlayerProfile.

B3. Visualización
 
 Panel a tres columnas

izquierda clan, derecha oponente, centro gaps + checklist.

Añadir “vista de matchups”:

tabla: filas por posición, y dos celdas grandes (clan #i vs opp #i)

dentro: mini-barras PowerIndex por cat + botón “Comparar”

Colores:

Heatmap para %max (amenazas).

Para gaps: verde = ventaja propia, rojo = desventaja (aquí sí tiene sentido).

Entregable B: “War Active” dashboard + matchups por mapPosition + reglas checklist y comparador integrado.

C) Monitoreo de actividad en guerras (MVP, disciplina y timing)

Objetivo: medir ejecución: quién ataca temprano/tarde, quién maximiza estrellas y destrucción, quién usa ambos ataques, y ajustar por dificultad (ataques arriba/abajo).

C1. Alcance funcional

Timeline de ataques:

orden cronológico (si la API trae timestamps; si no, aproximación por “order”/aparición)

“primeros atacantes” vs “últimos atacantes”

Disciplina de uso de ataques:

% de guerras en que usa todos los ataques (requiere historial; en fase inicial solo guerra activa)

MVP Score explicable (guerra activa):

estrellas ganadas

destrucción promedio

“dificultad relativa”: atacar arriba vale más que atacar abajo

C2. Datos (y dependencia realista)

En currentwar, cada miembro puede traer attacks[] con:

stars, destructionPercentage, order, defenderTag

Para dificultad:

usar attacker.mapPosition y defender.mapPosition

delta = attackerPos - defenderPos (si delta > 0 atacó “arriba”)

Si la API no da timestamps exactos: el “timing” será aproximado (orden de ataque) y se documenta como tal.

C3. Métrica MVP (simple, calibrable)

Prototipo inicial (evita sobreajuste):

score = stars*1.0 + destruction%*0.01 + max(0, delta)*0.15

Guardar componentes por jugador para explicar el ranking.

C4. Visualización

Leaderboard (Top 10) por:

Stars, Destruction, MVP Score, Attacks used

Scatter plot: (x = delta promedio, y = estrellas) para ver quién “pega arriba” con éxito.

Tabla de cumplimiento: ataques usados (0/1/2) con colores:

rojo: faltan ataques

amarillo: 1 ataque

neutro: 2 ataques

Colores:

Rojo reservado a “faltas” (ataques no usados).

Morado/azul para potencia (heatmap).

Verde para ventaja o desempeño.

Entregable C: módulo “War Execution” con MVP + disciplina + evidencia (tabla de ataques).

D) Manejo de recursos y progresión (donaciones y coordinación de laboratorios)

Objetivo: convertir datos en decisiones: quién debe donar qué, y cómo coordinar upgrades para cubrir gaps y reducir redundancia.

D1. Alcance funcional

Donaciones / refuerzos (clan castle):

identificar top donadores por unidad (troops/spells) basado en nivel absoluto y %max

“mejor donador disponible” por cada refuerzo típico (lista configurable)

Plan de laboratorio sin redundancias (heurístico):

detectar redundancia: muchos miembros maxean lo mismo mientras faltan unidades críticas

sugerir “prioridades” por:

debilidades del clan vs meta (si defines una lista objetivo)

debilidades vs rivales recientes (si hay historial)

Vista de cobertura:

para cada unidad: cuántos miembros la tienen ≥90% y cuántos la tienen baja

D2. Datos

Reutiliza PlayerProfile de A.
Para laboratorio, la API no te dice “qué está mejorando ahora”. Así que:

Solo se puede sugerir qué convendría mejorar, no “estado actual del laboratorio”.

Si quieres tracking real, necesitas input humano (encuesta, Google Form, o UI manual).

D3. Algoritmos (explicables)

“Cobertura” de unidad u:

coverage90 = count(p_i >= 0.90)

avgPct

“Prioridad”:

alta si coverage90 es baja pero el valor estratégico es alto (lista de prioridades configurable)

“Recomendación por jugador”:

sugerir una unidad donde el jugador esté cerca de max y el clan tenga poca cobertura (maximiza ROI)

D4. Visualización

Matriz de cobertura (unidad vs cobertura90) en barras horizontales.

Tabla “Reforzadores”: unidad → top 3 donadores.

Panel “Gaps del clan”: unidades con baja cobertura (alerta).

Paleta:

Cobertura baja = naranja suave (alerta operativa, no “error”)

Cobertura alta = azul neutro

Entregable D: módulo “Resources & Progression” con donadores, cobertura y recomendaciones.

Secuenciación recomendada (para desarrollo estable y reutilizable)

A: construir el “modelo canónico” (PlayerProfile, ClanSnapshot) + dashboard base.

B: reutilizar perfiles para guerra activa + matchups + checklist.

C: añadir extracción de ataques + MVP score + disciplina; guardar “war report” JSON.

D: usar ClanSnapshot para cobertura/donaciones y recomendaciones; si se requiere tracking real, añadir inputs manuales.

Reglas de diseño (para toda la app)

Unidades/amenazas: morado/azul (intensidad = más peligro/potencia).

Ventajas/desventajas (comparativas): verde/rojo.

Faltas de actividad: rojo (solo aquí).

Evitar tablas gigantes: siempre Top N + búsqueda + drill-down.

Cada gráfica debe responder una pregunta:

barras: ranking/cobertura

histograma: distribución

scatter: tradeoff/relación (pegar arriba vs resultado)

Definición de “Done” por sección

A Done: puedo abrir la web, seleccionar clan, ver TH promedio + top amenazas por jugador + búsqueda.

B Done: puedo cargar guerra activa y comparar clan vs rival; ver matchups y comparar dos jugadores.

C Done: puedo ver quién atacó, quién faltó, y un MVP ranking explicable.

D Done: puedo ver quién dona mejor cada refuerzo y un mapa de cobertura con recomendaciones.
