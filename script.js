const API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

const URLS = {
  scoreboard: `${API}/scoreboard?limit=100`,
  roster: `${API}/teams/tor/roster`,
  schedule: `${API}/teams/tor/schedule`
};

let roster = [];
let schedule = [];
let scoreboard = [];
let selectedPlayer = null;

const $ = id => document.getElementById(id);


/* FETCH DATA */

async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status}`);
  }

  return response.json();
}


/* LOAD ALL DATA */

async function loadData() {
  const button = $("refreshBtn");

  button.disabled = true;
  button.textContent = "…";

  try {
    const [scores, players, games] = await Promise.all([
      getJSON(URLS.scoreboard),
      getJSON(URLS.roster),
      getJSON(URLS.schedule)
    ]);

    scoreboard = scores.events || [];

    roster = (players.athletes || [])
      .flatMap(group => group.items || [group])
      .filter(player => player.id);

    schedule = games.events || [];

    setConnection(true);
    showGame();
    showLeague();
    showRoster();

  } catch (error) {
    console.error(error);

    setConnection(false);

    $("gameStatus").textContent = "DATA UNAVAILABLE";

    $("gameMessage").textContent =
      "Unable to load data. Try refreshing.";

    $("leagueGames").innerHTML =
      '<p class="loading">NBA data is temporarily unavailable.</p>';

    $("playerGrid").innerHTML =
      '<p class="loading">Roster data is temporarily unavailable.</p>';

  } finally {
    button.disabled = false;
    button.textContent = "↻";
  }
}


/* CONNECTION */

function setConnection(connected) {
  document.querySelectorAll(".status-dot").forEach(dot => {
    dot.classList.toggle("active", connected);
  });

  $("connectionText").textContent =
    connected ? "CONNECTED" : "OFFLINE";
}


/* SAFE TEXT */

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}


/* DATE FORMAT */

function dateLabel(date) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric"
  }).toUpperCase();
}


/* FIND RAPTORS GAME */

function findTorontoGame(events) {
  return events.find(event =>
    (event.competitions?.[0]?.competitors || []).some(team =>
      team.team?.abbreviation?.toUpperCase() === "TOR"
    )
  );
}


/* GAME CENTER */

function showGame() {
  let game = findTorontoGame(scoreboard);

  if (!game) {
    game = schedule
      .filter(item =>
        new Date(item.date) > new Date() &&
        !item.status?.type?.completed
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  }

  if (!game) {
    return noGame();
  }

  const teams = game.competitions?.[0]?.competitors || [];

  const tor = teams.find(team =>
    team.team?.abbreviation?.toUpperCase() === "TOR"
  );

  const opp = teams.find(team =>
    team.team?.abbreviation?.toUpperCase() !== "TOR"
  );

  if (!tor || !opp) {
    return noGame();
  }

  const state = game.status?.type?.state || "pre";

  const live = state === "in";
  const final = state === "post";

  const torScore = Number(tor.score) || 0;
  const oppScore = Number(opp.score) || 0;

  $("raptorsScore").textContent =
    live || final ? torScore : "—";

  $("opponentScore").textContent =
    live || final ? oppScore : "—";

  $("opponentAbbr").textContent =
    opp.team.abbreviation || "NBA";

  $("opponentName").textContent =
    opp.team.shortDisplayName ||
    opp.team.displayName ||
    "OPPONENT";

  $("opponentLogo").src =
    opp.team.logo ||
    "https://a.espncdn.com/i/teamlogos/nba/500/nba.png";

  $("gameDate").textContent = dateLabel(game.date);

  $("gameStatus").textContent =
    live ? "LIVE" : final ? "FINAL" : "UPCOMING";

  $("gameClock").textContent =
    live
      ? (game.status?.displayClock || "GAME IN PROGRESS")
      : final
        ? "GAME COMPLETED"
        : dateLabel(game.date);

  $("gamePeriod").textContent =
    live
      ? (game.status?.type?.detail || "IN PROGRESS")
      : final
        ? "FINAL"
        : "UPCOMING";

  $("gameMessage").textContent = live
    ? "Toronto is on the court. Follow the score as it changes."
    : final
      ? (
          torScore > oppScore
            ? "Toronto takes the win."
            : "The matchup has concluded."
        )
      : "The Raptors are preparing for their next matchup.";

  updateEnergy(state, torScore, oppScore);
}


/* NO GAME */

function noGame() {
  $("raptorsScore").textContent = "—";
  $("opponentScore").textContent = "—";

  $("opponentAbbr").textContent = "NBA";
  $("opponentName").textContent = "OPPONENT";

  $("opponentLogo").src =
    "https://a.espncdn.com/i/teamlogos/nba/500/nba.png";

  $("gameDate").textContent = "TORONTO RAPTORS";
  $("gameStatus").textContent = "NO GAME";
  $("gameClock").textContent = "AWAITING NEXT MATCHUP";
  $("gamePeriod").textContent = "NBA";

  $("gameMessage").textContent =
    "No Raptors game is available in the current feed.";

  updateEnergy("pre", 0, 0);
}


/* TEAM ENERGY */

function updateEnergy(state, tor, opp) {
  let energy = 25;

  let title = "PRE-GAME<br><em>ENERGY.</em>";

  let description =
    "The anticipation builds before tip-off.";

  if (state === "in") {
    energy = Math.min(
      100,
      45 + (tor % 30) + (tor > opp ? 15 : 0)
    );

    title = "GAME<br><em>ON.</em>";

    description = tor > opp
      ? "Toronto currently leads the scoreboard."
      : "The Raptors are battling on the court.";

  } else if (state === "post") {
    energy = tor > opp ? 95 : 30;

    title = tor > opp
      ? "WINNING<br><em>ENERGY.</em>"
      : "FINAL<br><em>BUZZER.</em>";

    description = tor > opp
      ? "Toronto finished ahead on the scoreboard."
      : "The matchup has concluded.";
  }

  $("energyTitle").innerHTML = title;

  $("energyDescription").textContent = description;

  $("energyValue").innerHTML =
    `${energy}<span>%</span>`;

  $("energyBar").style.width = `${energy}%`;
}


/* AROUND THE NBA */

function showLeague() {
  const games = scoreboard.filter(event =>
    !(event.competitions?.[0]?.competitors || []).some(team =>
      team.team?.abbreviation?.toUpperCase() === "TOR"
    )
  );

  if (!games.length) {
    $("leagueGames").innerHTML =
      '<p class="loading">No other NBA games listed right now.</p>';

    return;
  }

  $("leagueGames").innerHTML = games.slice(0, 12).map(game => {
    const teams = game.competitions?.[0]?.competitors || [];

    const away = teams.find(team =>
      team.homeAway === "away"
    );

    const home = teams.find(team =>
      team.homeAway === "home"
    );

    if (!away || !home) return "";

    const state = game.status?.type?.state || "pre";

    const scores = state === "pre"
      ? "— : —"
      : `${safe(away.score)} : ${safe(home.score)}`;

    const status =
      state === "in"
        ? "LIVE"
        : state === "post"
          ? "FINAL"
          : "SCHEDULED";

    return `
      <div class="league-row">

        <span class="date">
          ${dateLabel(game.date)}
        </span>

        <span class="teams">
          ${safe(away.team.abbreviation)}
          <b>VS</b>
          ${safe(home.team.abbreviation)}
        </span>

        <span class="scores">
          ${scores}
        </span>

        <span class="state">
          ${status}
        </span>

      </div>
    `;
  }).join("");
}


/* ROSTER */

function showRoster() {
  const filter = $("positionFilter").value;

  const players = roster.filter(player => {
    const position =
      player.position?.abbreviation || "";

    return filter === "all" || position.includes(filter);
  });

  if (!players.length) {
    $("playerGrid").innerHTML =
      '<p class="loading">No players found for this position.</p>';

    return;
  }

  $("playerGrid").innerHTML = players.map(player => {
    const name =
      player.displayName ||
      player.fullName ||
      "Unknown player";

    const position =
      player.position?.abbreviation || "—";

    const jersey =
      player.jersey || "—";

    const photo =
      player.headshot?.href ||
      "https://a.espncdn.com/i/teamlogos/nba/500/tor.png";

    const selected =
      selectedPlayer?.id === player.id
        ? "selected"
        : "";

    return `
      <div
        class="player-row ${selected}"
        data-id="${safe(player.id)}"
        tabindex="0"
        role="button"
      >

        <div class="player-name-cell">
          <img
            src="${safe(photo)}"
            alt="${safe(name)}"
            loading="lazy"
          >

          <strong>${safe(name)}</strong>
        </div>

        <span class="position">
          ${safe(position)}
        </span>

        <span class="number">
          #${safe(jersey)}
        </span>

        <span class="view">
          VIEW ↗
        </span>

      </div>
    `;
  }).join("");
}


/* PLAYER SPOTLIGHT */

function choosePlayer(id) {
  const player = roster.find(item =>
    String(item.id) === String(id)
  );

  if (!player) return;

  selectedPlayer = player;

  const name =
    player.displayName ||
    player.fullName ||
    "Player";

  const position =
    player.position?.displayName ||
    "Basketball player";

  const jersey =
    player.jersey || "—";

  const image =
    player.headshot?.href ||
    "https://a.espncdn.com/i/teamlogos/nba/500/tor.png";

  $("spotlightName").textContent =
    name.toUpperCase();

  $("spotlightDetails").textContent =
    `${position} · Toronto Raptors`;

  $("spotlightNumber").textContent =
    `TORONTO / JERSEY #${jersey}`;

  $("spotlightImage").src = image;
  $("spotlightImage").alt = name;

  document.querySelectorAll(".player-row").forEach(row => {
    row.classList.toggle(
      "selected",
      row.dataset.id === String(id)
    );
  });

  $("spotlight").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}


/* EVENT LISTENERS */

$("refreshBtn").addEventListener("click", loadData);

$("positionFilter").addEventListener(
  "change",
  showRoster
);

$("playerGrid").addEventListener("click", event => {
  const row = event.target.closest(".player-row");

  if (row) {
    choosePlayer(row.dataset.id);
  }
});

$("playerGrid").addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const row = event.target.closest(".player-row");

  if (!row) return;

  event.preventDefault();

  choosePlayer(row.dataset.id);
});


/* INITIAL LOAD + AUTO REFRESH */

loadData();

setInterval(loadData, 60000);
