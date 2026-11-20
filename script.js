
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


// ELEMENTS

const refreshBtn = document.getElementById("refreshBtn");
const playerGrid = document.getElementById("playerGrid");
const positionFilter = document.getElementById("positionFilter");


// FETCH JSON DATA

async function fetchData(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
}


// MAIN DATA FUNCTION

async function loadData() {

    refreshBtn.disabled = true;
    refreshBtn.textContent = "Loading...";

    try {

        const results = await Promise.all([
            fetchData(ENDPOINTS.scoreboard),
            fetchData(ENDPOINTS.roster),
            fetchData(ENDPOINTS.schedule)
        ]);

        scoreboard = results[0].events || [];

        // ESPN can group players into position categories.
        const athletes = results[1].athletes || [];

        roster = athletes.flatMap(group => {
            return group.items ? group.items : [group];
        }).filter(player => player.id);

        schedule = results[2].events || [];

        updateConnection(true);

        displayGame();
        displayLeague();
        displayRoster();

        updateSeason();

        console.log("NBA JSON data successfully retrieved.");

    } catch (error) {

        console.error("API Error:", error);

        updateConnection(false);

        document.getElementById("gameMessage").textContent =
            "Unable to retrieve live data. Please try again.";

        document.getElementById("gameStatus").textContent =
            "CONNECTION ERROR";

        playerGrid.innerHTML =
            '<div class="loading">Roster data unavailable. Please refresh.</div>';

        document.getElementById("leagueGames").innerHTML =
            '<div class="loading">League data unavailable.</div>';

    } finally {

        refreshBtn.disabled = false;
        refreshBtn.innerHTML = "↻ <span>Refresh</span>";

    }
}


// CONNECTION INDICATOR

function updateConnection(connected) {

    const dots = document.querySelectorAll(".status-dot");

    dots.forEach(dot => {
        dot.classList.toggle("active", connected);
    });

}


// SEASON INFORMATION

function updateSeason() {

    const now = new Date();

    const year = now.getFullYear();

    const seasonYear = now.getMonth() >= 9
        ? year + 1
        : year;

    document.getElementById("season").textContent =
        `${seasonYear - 1}-${String(seasonYear).slice(-2)}`;

}


// HELPER: FORMAT DATE

function formatDate(date) {

    if (!date) return "DATE UNAVAILABLE";

    return new Date(date).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).toUpperCase();

}


// HELPER: FIND TORONTO GAME

function findRaptorsGame(events) {

    return events.find(event => {

        const competitors =
            event.competitions?.[0]?.competitors || [];

        return competitors.some(team =>
            team.team?.abbreviation?.toUpperCase() === "TOR"
        );

    });

}


// GAME CENTER

function displayGame() {

    const game = findRaptorsGame(scoreboard);

    let selectedGame = game;

    // If Toronto is not playing today, find its next scheduled game.
    if (!selectedGame) {

        const now = Date.now();

        const upcoming = schedule
            .filter(event => {
                return new Date(event.date).getTime() > now &&
                    !event.status?.type?.completed;
            })
            .sort((a, b) =>
                new Date(a.date) - new Date(b.date)
            );

        selectedGame = upcoming[0];

    }

    if (!selectedGame) {

        showNoGame();

        return;
    }

    const competition = selectedGame.competitions?.[0];

    const competitors = competition?.competitors || [];

    const raptors = competitors.find(team =>
        team.team?.abbreviation?.toUpperCase() === "TOR"
    );

    const opponent = competitors.find(team =>
        team.team?.abbreviation?.toUpperCase() !== "TOR"
    );

    if (!raptors || !opponent) {

        showNoGame();

        return;
    }

    const status = selectedGame.status?.type || {};

    const state = status.state || "pre";

    const isLive = state === "in";
    const isFinal = state === "post";

    const raptorsScore = Number(raptors.score) || 0;
    const opponentScore = Number(opponent.score) || 0;

    // TEAM INFORMATION

    document.getElementById("raptorsScore").textContent =
        isLive || isFinal ? raptorsScore : "--";

    document.getElementById("opponentScore").textContent =
        isLive || isFinal ? opponentScore : "--";

    document.getElementById("opponentAbbr").textContent =
        opponent.team.abbreviation || "NBA";

    document.getElementById("opponentName").textContent =
        opponent.team.displayName || "OPPONENT";

    document.getElementById("opponentLogo").src =
        opponent.team.logo ||
        "https://a.espncdn.com/i/teamlogos/nba/500/nba.png";

    document.getElementById("gameDate").textContent =
        formatDate(selectedGame.date);

    // GAME STATUS

    let statusText = "SCHEDULED";

    if (isLive) statusText = "LIVE NOW";
    if (isFinal) statusText = "FINAL";

    document.getElementById("gameStatus").textContent =
        statusText;

    document.getElementById("gameClock").textContent =
        isLive
            ? status.displayClock || "GAME IN PROGRESS"
            : isFinal
                ? "GAME COMPLETED"
                : formatDate(selectedGame.date);

    document.getElementById("gamePeriod").textContent =
        isLive
            ? status.detail || "IN PROGRESS"
            : isFinal
                ? "FINAL SCORE"
                : "UPCOMING MATCHUP";

    // GAME MESSAGE

    let message = "The Raptors are preparing for their next matchup.";

    if (isLive) {
        message = "The Toronto Raptors are on the court!";
    }

    if (isFinal) {

        if (raptorsScore > opponentScore) {
            message = "Toronto takes the win!";
        } else if (raptorsScore < opponentScore) {
            message = "Toronto falls short this time.";
        } else {
            message = "Game finished.";
        }

    }

    document.getElementById("gameMessage").textContent =
        message;

    // UPDATE DATA-DRIVEN VISUALS

    updateEnergy(
        state,
        raptorsScore,
        opponentScore
    );

}


// NO GAME AVAILABLE

function showNoGame() {

    document.getElementById("raptorsScore").textContent = "--";
    document.getElementById("opponentScore").textContent = "--";

    document.getElementById("opponentAbbr").textContent = "NBA";
    document.getElementById("opponentName").textContent = "OPPONENT";

    document.getElementById("opponentLogo").src =
        "https://a.espncdn.com/i/teamlogos/nba/500/nba.png";

    document.getElementById("gameStatus").textContent =
        "NO GAME DATA";

    document.getElementById("gameClock").textContent =
        "AWAITING NEXT MATCHUP";

    document.getElementById("gamePeriod").textContent = "NBA";

    document.getElementById("gameMessage").textContent =
        "No Raptors matchup is currently available.";

    document.getElementById("gameDate").textContent =
        "TORONTO RAPTORS";

    updateEnergy("pre", 0, 0);

}


// DATA-DRIVEN ENERGY VISUALIZATION

function updateEnergy(state, torScore, opponentScore) {

    let energy = 20;

    let title = "COURT ENERGY";

    let description = "Waiting for the next game.";

    // Score and game state influence the energy level.

    if (state === "in") {

        energy = Math.min(
            100,
            45 + (torScore % 30) +
            (torScore > opponentScore ? 15 : 0)
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

    else {

        energy = 25;

        title = "PRE-GAME ENERGY";

        description = "The anticipation builds before tip-off.";

    }

    // UPDATE METER

    document.getElementById("energyBar").style.width =
        energy + "%";

    document.getElementById("energyValue").textContent =
        energy + "%";

    document.getElementById("energyTitle").textContent =
        title;

    document.getElementById("energyDescription").textContent =
        description;

    // CHANGE AMBIENT BACKGROUND

    const glow = document.getElementById("backgroundGlow");

    glow.style.background =
        `rgba(229, 27, 50, ${energy / 700})`;

    glow.style.transform =
        `scale(${0.8 + energy / 100})`;

    // CHANGE ANIMATION SPEED

    const visual = document.getElementById("energyVisual");

    visual.style.boxShadow =
        `0 0 ${energy / 2}px rgba(229, 27, 50, 0.3)`;

    visual.querySelectorAll(".pulse-circle").forEach(circle => {

        circle.style.animationDuration =
            `${3.5 - (energy / 50)}s`;

    });

}


// LEAGUE ACTIVITY

function displayLeague() {

    const container = document.getElementById("leagueGames");

    // Show current NBA games, excluding Toronto's game.

    const otherGames = scoreboard.filter(event => {

        const competitors =
            event.competitions?.[0]?.competitors || [];

        return !competitors.some(team =>
            team.team?.abbreviation?.toUpperCase() === "TOR"
        );

    });

    if (otherGames.length === 0) {

        container.innerHTML = `
            <div class="loading">
                No other NBA games are available right now.
            </div>
        `;

        return;
    }

    container.innerHTML = otherGames.slice(0, 9).map(game => {

        const competitors =
            game.competitions?.[0]?.competitors || [];

        const away = competitors.find(team =>
            team.homeAway === "away"
        );

        const home = competitors.find(team =>
            team.homeAway === "home"
        );

        if (!away || !home) return "";

        const status = game.status?.type || {};

        const state = status.state || "pre";

        let statusText = "SCHEDULED";

        if (state === "in") {
            statusText = "LIVE";
        }

        if (state === "post") {
            statusText = "FINAL";
        }

        return `

            <div class="league-card">

                <div class="game-date">
                    ${formatDate(game.date)}
                </div>

                <div class="league-team">
                    <span>${away.team.abbreviation}</span>
                    <strong>
                        ${state !== "pre" ? away.score : "--"}
                    </strong>
                </div>

                <div class="league-team">
                    <span>${home.team.abbreviation}</span>
                    <strong>
                        ${state !== "pre" ? home.score : "--"}
                    </strong>
                </div>

                <div class="league-status">
                    ${statusText}
                    ${status.detail || ""}
                </div>

            </div>

        `;

    }).join("");

}


// PLAYER ROSTER

function displayRoster() {

    const filter = positionFilter.value;

    const filteredPlayers = roster.filter(player => {

        const position =
            player.position?.abbreviation || "";

        if (filter === "all") return true;

        return position.includes(filter);

    });

    if (filteredPlayers.length === 0) {

        playerGrid.innerHTML =
            '<div class="loading">No players found for this position.</div>';

        return;
    }

    playerGrid.innerHTML = filteredPlayers.map(player => {

        const name =
            player.displayName || player.fullName || "Unknown Player";

        const position =
            player.position?.abbreviation || "NBA";

        const jersey =
            player.jersey || "--";

        const headshot =
            player.headshot?.href ||
            "https://a.espncdn.com/i/teamlogos/nba/500/tor.png";

        const selectedClass =
            selectedPlayer?.id === player.id ? "selected" : "";

        return `

            <div class="player-card ${selectedClass}"
                 data-id="${player.id}"
                 tabindex="0"
                 role="button"
                 aria-label="View ${escapeHTML(name)}">

                <span class="player-number">
                    #${escapeHTML(jersey)}
                </span>

                <div class="player-photo">

                    <img
                        src="${escapeHTML(headshot)}"
                        alt="${escapeHTML(name)}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='https://a.espncdn.com/i/teamlogos/nba/500/tor.png';"
                    >

                </div>

                <div class="player-details">

                    <h3>${escapeHTML(name)}</h3>

                    <p>
                        ${escapeHTML(position)} · Toronto Raptors
                    </p>

                    <span class="player-tag">
                        VIEW PLAYER →
                    </span>

                </div>

            </div>

        `;

    }).join("");

}


// BASIC HTML ESCAPING FOR API TEXT

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, char => {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];

    });

}


// PLAYER SELECTION INTERACTION

function selectPlayer(playerId) {

    const player = roster.find(item =>
        String(item.id) === String(playerId)
    );

    if (!player) return;

    selectedPlayer = player;

    const name =
        player.displayName || player.fullName || "Player";

    const position =
        player.position?.displayName || "Basketball Player";

    const jersey =
        player.jersey || "--";

    const image =
        player.headshot?.href ||
        "https://a.espncdn.com/i/teamlogos/nba/500/tor.png";

    // UPDATE SPOTLIGHT

    document.getElementById("spotlightName").textContent =
        name.toUpperCase();

    document.getElementById("spotlightDetails").textContent =
        `${position} | Toronto Raptors | Player ID: ${player.id}`;

    document.getElementById("spotlightNumber").textContent =
        `JERSEY #${jersey}`;

    document.getElementById("spotlightImage").src = image;

    // UPDATE SELECTED CARD

    document.querySelectorAll(".player-card").forEach(card => {

        card.classList.toggle(
            "selected",
            card.dataset.id === String(playerId)
        );

    });

    // SCROLL TO PLAYER SPOTLIGHT

    document.getElementById("spotlight").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


// EVENT LISTENERS

refreshBtn.addEventListener("click", loadData);

positionFilter.addEventListener("change", displayRoster);


// Event delegation allows dynamically generated player cards to work.

playerGrid.addEventListener("click", event => {

    const card = event.target.closest(".player-card");

    if (!card) return;

    selectPlayer(card.dataset.id);

});

playerGrid.addEventListener("keydown", event => {

    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest(".player-card");

    if (!card) return;

    event.preventDefault();

    selectPlayer(card.dataset.id);

});


// INITIALIZE WEBSITE

loadData();


// AUTOMATICALLY REFRESH DATA EVERY 60 SECONDS

setInterval(() => {

    loadData();

}, 60000);
