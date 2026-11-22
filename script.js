const API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

const ENDPOINTS = {
  scoreboard: `${API}/scoreboard?limit=100`,
  roster: `${API}/teams/tor/roster`,
  schedule: `${API}/teams/tor/schedule`
};

let roster = [];
let schedule = [];
let scoreboard = [];
let selectedPlayer = null;

const $ = (id) => document.getElementById(id);

const refreshBtn = $("refreshBtn");
const playerGrid = $("playerGrid");
const positionFilter = $("positionFilter");


/* FETCH DATA */

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ESPN request failed (${response.status})`);
  }

  return response.json();
}


/* LOAD ALL DATA */

async function loadData() {
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = "Loading…";

  try {
    const [scoreData, rosterData, scheduleData] = await Promise.all([
      fetchJSON(ENDPOINTS.scoreboard),
      fetchJSON(ENDPOINTS.roster),
      fetchJSON(ENDPOINTS.schedule)
    ]);

    scoreboard = scoreData.events || [];

    const groups = rosterData.athletes || [];

    roster = groups
      .flatMap(group => group.items || [group])
      .filter(player => player.id);

    schedule = scheduleData.events || [];

    updateConnection(true);
    displayGame();
    displayLeague();
    displayRoster();
    updateSeason();

  } catch (error) {
    console.error("Raptors Pulse:", error);

    updateConnection(false);

    $("gameStatus").textContent = "DATA UNAVAILABLE";

    $("gameMessage").textContent =
      "We couldn't load the latest data. Please try again.";

    playerGrid.innerHTML =
      '<p class="loading">Roster data is temporarily unavailable.</p>';

    $("leagueGames").innerHTML =
      '<p class="loading">League scores are temporarily unavailable.</p>';

  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = "↻ Refresh";
  }
}


/* CONNECTION STATUS */

function updateConnection(connected) {
  document.querySelectorAll(".status-dot").forEach(dot => {
    dot.classList.toggle("active", connected);
  });

  $("connectionText").textContent =
    connected ? "DATA CONNECTED" : "CONNECTION ISSUE";
}


/* SEASON */

function updateSeason() {
  const now = new Date();

  const endYear = now.getMonth() >= 9
    ? now.getFullYear() + 1
    : now.getFullYear();

  const season = `${endYear - 1}-${String(endYear).slice(-2)}`;

  document.querySelectorAll(".hero .kicker").forEach(element => {
    element.innerHTML =
      `<span class="kicker-line"></span> TORONTO BASKETBALL / ${season}`;
  });
}


/* DATE FORMAT */

function formatDate(date) {
  if (!date) return "DATE UNAVAILABLE";

  return new Date(date).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).toUpperCase();
}


/* FIND RAPTORS GAME */

function findRaptorsGame(events) {
  return events.find(event =>
    (event.competitions?.[0]?.competitors || []).some(team =>
      team.team?.abbreviation?.toUpperCase() === "TOR"
    )
  );
}


/* GAME CENTER */

function displayGame() {
  let game = findRaptorsGame(scoreboard);

  if (!game) {
    const upcoming = schedule
      .filter(event =>
        new Date(event.date).getTime() > Date.now() &&
        !event.status?.type?.completed
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    game = upcoming[0];
  }

  if (!game) {
    return showNoGame();
  }

  const competition = game.competitions?.[0];
  const teams = competition?.competitors || [];

  const toronto = teams.find(team =>
    team.team?.abbreviation?.toUpperCase() === "TOR"
  );

  const opponent = teams.find(team =>
    team.team?.abbreviation?.toUpperCase() !== "TOR"
  );

  if (!toronto || !opponent) {
    return showNoGame();
  }

  const status = game.status?.type || {};
  const state = status.state || "pre";

  const live = state === "in";
  const final = state === "post";

  const torScore = Number(toronto.score) || 0;
  const oppScore = Number(opponent.score) || 0;

  $("raptorsScore").textContent =
    live || final ? torScore : "—";

  $("opponentScore").textContent =
    live || final ? oppScore : "—";

  $("opponentAbbr").textContent =
    opponent.team.abbreviation || "NBA";

  $("opponentName").textContent =
    opponent.team.displayName || "OPPONENT";

  $("opponentLogo").src =
    opponent.team.logo ||
    "https://a.espncdn.com/i/teamlogos/nba/500/nba.png";

  $("gameDate").textContent = formatDate(game.date);

  $("gameStatus").textContent =
    live ? "LIVE NOW" : final ? "FINAL" : "UPCOMING";

  $("gameClock").textContent =
    live
      ? (status.displayClock || "GAME IN PROGRESS")
      : final
        ? "GAME COMPLETED"
        : formatDate(game.date);

  $("gamePeriod").textContent =
    live
      ? (status.detail || "IN PROGRESS")
      : final
        ? "FINAL SCORE"
        : "UPCOMING MATCHUP";

  let message = "The Raptors are preparing for their next matchup.";

  if (live) {
    message = "Toronto is on the court. Follow the score as it changes.";
  }

  if (final) {
    message = torScore > oppScore
      ? "Toronto takes the win."
      : torScore < oppScore
        ? "Toronto falls short this time."
        : "The game finished in a tie.";
  }

  $("gameMessage").textContent = message;

  updateEnergy(state, torScore, oppScore);
}


/* NO GAME */

function showNoGame() {
  $("raptorsScore").textContent = "—";
  $("opponentScore").textContent = "—";

  $("opponentAbbr").textContent = "NBA";
  $("opponentName").textContent = "OPPONENT";

  $("opponentLogo").src =
    "https://a.espncdn.com/i/teamlogos/nba/500/nba.png";

  $("gameStatus").textContent = "NO GAME LISTED";
  $("gameClock").textContent = "AWAITING NEXT MATCHUP";
  $("gamePeriod").textContent = "NBA";

  $("gameMessage").textContent =
    "There is no Raptors game available in the current feed.";

  $("gameDate").textContent = "TORONTO RAPTORS";

  updateEnergy("pre", 0, 0);
}


/* TEAM ENERGY */

function updateEnergy(state, torScore, opponentScore) {
  let energy = 25;

  let title = "PRE-GAME ENERGY";
  let description = "The anticipation builds before tip-off.";

  if (state === "in") {
    energy = Math.min(
      100,
      45 + (torScore % 30) + (torScore > opponentScore ? 15 : 0)
    );

    title = "GAME IN PROGRESS";

    description = torScore > opponentScore
      ? "Toronto currently leads the scoreboard."
      : "The Raptors are battling on the court.";
  }

  else if (state === "post") {
    energy = torScore > opponentScore
      ? 95
      : torScore === opponentScore
        ? 50
        : 30;

    title = torScore > opponentScore
      ? "WINNING ENERGY"
      : "GAME COMPLETED";

    description = torScore > opponentScore
      ? "Toronto finished ahead on the scoreboard."
      : "The matchup has concluded.";
  }

  $("energyBar").style.width = `${energy}%`;
  $("energyValue").textContent = `${energy}%`;
  $("energyTitle").textContent = title;
  $("energyDescription").textContent = description;
}


/* AROUND THE NBA */

function displayLeague() {
  const games = scoreboard.filter(event =>
    !(event.competitions?.[0]?.competitors || []).some(team =>
      team.team?.abbreviation?.toUpperCase() === "TOR"
    )
  );

  if (!games.length) {
    $("leagueGames").innerHTML =
      '<p class="loading">No other NBA games are listed right now.</p>';

    return;
  }

  $("leagueGames").innerHTML = games.slice(0, 9).map(game => {
    const teams = game.competitions?.[0]?.competitors || [];

    const away = teams.find(team => team.homeAway === "away");
    const home = teams.find(team => team.homeAway === "home");

    if (!away || !home) return "";

    const state = game.status?.type?.state || "pre";

    const label =
      state === "in"
        ? "LIVE"
        : state === "post"
          ? "FINAL"
          : "SCHEDULED";

    return `
      <article class="league-card">

        <p class="game-date">
          ${formatDate(game.date)}
        </p>

        <div class="league-team">
          <span>${escapeHTML(away.team.abbreviation || "AWAY")}</span>
          <strong>
            ${state !== "pre" ? escapeHTML(away.score ?? "—") : "—"}
          </strong>
        </div>

        <div class="league-team">
          <span>${escapeHTML(home.team.abbreviation || "HOME")}</span>
          <strong>
            ${state !== "pre" ? escapeHTML(home.score ?? "—") : "—"}
          </strong>
        </div>

        <p class="league-status">
          ${label}
          ${game.status?.type?.detail
            ? " · " + escapeHTML(game.status.type.detail)
            : ""}
        </p>

      </article>
    `;
  }).join("");
}


/* ROSTER */

function displayRoster() {
  const filter = positionFilter.value;

  const players = roster.filter(player => {
    const position = player.position?.abbreviation || "";

    return filter === "all" || position.includes(filter);
  });

  if (!players.length) {
    playerGrid.innerHTML =
      '<p class="loading">No players found for this position.</p>';

    return;
  }

  playerGrid.innerHTML = players.map(player => {
    const name =
      player.displayName || player.fullName || "Unknown player";

    const position =
      player.position?.abbreviation || "NBA";

    const jersey =
      player.jersey || "—";

    const image =
      player.headshot?.href ||
      "https://a.espncdn.com/i/teamlogos/nba/500/tor.png";

    const selected =
      selectedPlayer?.id === player.id ? "selected" : "";

    return `
      <article
        class="player-card ${selected}"
        data-id="${escapeHTML(player.id)}"
        tabindex="0"
        role="button"
        aria-label="View ${escapeHTML(name)}"
      >

        <span class="player-number">
          #${escapeHTML(jersey)}
        </span>

        <div class="player-photo">
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(name)}"
            loading="lazy"
            onerror="this.onerror=null;this.src='https://a.espncdn.com/i/teamlogos/nba/500/tor.png'"
          >
        </div>

        <div class="player-details">
          <h3>${escapeHTML(name)}</h3>

          <p>
            ${escapeHTML(position)} / Toronto Raptors
          </p>

          <span class="player-tag">
            VIEW PLAYER ↗
          </span>
        </div>

      </article>
    `;
  }).join("");
}


/* ESCAPE HTML */

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}


/* PLAYER SPOTLIGHT */

function selectPlayer(id) {
  const player = roster.find(item =>
    String(item.id) === String(id)
  );

  if (!player) return;

  selectedPlayer = player;

  const name =
    player.displayName || player.fullName || "Player";

  const position =
    player.position?.displayName || "Basketball player";

  const jersey =
    player.jersey || "—";

  const image =
    player.headshot?.href ||
    "https://a.espncdn.com/i/teamlogos/nba/500/tor.png";

  $("spotlightName").textContent = name.toUpperCase();

  $("spotlightDetails").textContent =
    `${position} · Toronto Raptors`;

  $("spotlightNumber").textContent =
    `TORONTO / JERSEY #${jersey}`;

  $("spotlightImage").src = image;
  $("spotlightImage").alt = name;

  document.querySelectorAll(".player-card").forEach(card => {
    card.classList.toggle(
      "selected",
      card.dataset.id === String(id)
    );
  });

  $("spotlight").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}


/* EVENT LISTENERS */

refreshBtn.addEventListener("click", loadData);

positionFilter.addEventListener("change", displayRoster);

playerGrid.addEventListener("click", event => {
  const card = event.target.closest(".player-card");

  if (card) {
    selectPlayer(card.dataset.id);
  }
});

playerGrid.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest(".player-card");

  if (!card) return;

  event.preventDefault();

  selectPlayer(card.dataset.id);
});


/* INITIAL LOAD + AUTO REFRESH */

loadData();

setInterval(loadData, 60000);
