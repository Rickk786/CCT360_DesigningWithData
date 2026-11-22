const API = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

const URLS = {
  scoreboard: `${API}/scoreboard?limit=100`,
  roster: `${API}/teams/tor/roster`
};

let roster = [];
let games = [];
let selectedPlayer = null;

const $ = id => document.getElementById(id);

async function getJSON(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function dateLabel(date) {
  return date
    ? new Date(date).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric'
      }).toUpperCase()
    : '—';
}

function setConnection(ok) {
  $('connectionText').textContent = ok
    ? 'DATA CONNECTED'
    : 'FEED OFFLINE';

  document.querySelector('.live-state i').style.background =
    ok ? '#e31b35' : '#777';
}

// LOAD ALL DATA

async function loadData() {
  const btn = $('refreshBtn');

  btn.disabled = true;
  btn.innerHTML = '<span class="refresh-icon">↻</span> UPDATING';

  try {
    const [score, players] = await Promise.all([
      getJSON(URLS.scoreboard),
      getJSON(URLS.roster)
    ]);

    games = score.events || [];

    roster = (players.athletes || [])
      .flatMap(group => group.items || [group])
      .filter(player => player.id);

    setConnection(true);

    renderGame();
    renderLeague();
    renderRoster();

    if (selectedPlayer) {
      loadPlayerStats(selectedPlayer);
    }

  } catch (err) {
    console.error(err);

    setConnection(false);

    $('gameStatus').textContent = 'FEED OFFLINE';

    $('gameMessage').textContent =
      'The live feed could not be reached. Give refresh another try.';

    $('leagueGames').innerHTML =
      '<p class="loading">League scores are temporarily unavailable.</p>';

    $('playerGrid').innerHTML =
      '<p class="loading">Roster data is temporarily unavailable.</p>';

  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="refresh-icon">↻</span> REFRESH';
  }
}

// GAME CENTER

function findRaptorsGame() {
  return games.find(game =>
    (game.competitions?.[0]?.competitors || [])
      .some(team => team.team?.abbreviation === 'TOR')
  );
}

function renderGame() {
  const game = findRaptorsGame();

  if (!game) {
    $('gameDate').textContent = 'NO GAME TODAY';
    $('gameStatus').textContent = 'BETWEEN GAMES';

    $('raptorsScore').textContent = '—';
    $('opponentScore').textContent = '—';

    $('opponentAbbr').textContent = 'TOR NEXT';
    $('opponentName').textContent = 'CHECK SCHEDULE';

    $('gameClock').textContent = 'NEXT TIP-OFF';
    $('gamePeriod').textContent = 'TORONTO RAPTORS';

    $('gameMessage').textContent =
      'No Raptors game is listed in the current scoreboard feed. Check back for the next matchup.';

    return;
  }

  const teams = game.competitions[0].competitors;

  const tor = teams.find(team =>
    team.team?.abbreviation === 'TOR'
  );

  const opp = teams.find(team =>
    team.team?.abbreviation !== 'TOR'
  );

  if (!tor || !opp) return;

  const state = game.status?.type?.state || 'pre';

  const live = state === 'in';
  const final = state === 'post';

  $('gameDate').textContent = dateLabel(game.date);

  $('gameStatus').textContent = live
    ? 'LIVE NOW'
    : final
      ? 'FINAL'
      : 'UP NEXT';

  $('raptorsScore').textContent =
    live || final ? (tor.score ?? '0') : '—';

  $('opponentScore').textContent =
    live || final ? (opp.score ?? '0') : '—';

  $('opponentAbbr').textContent =
    opp.team.abbreviation || 'NBA';

  $('opponentName').textContent =
    opp.team.displayName || 'OPPONENT';

  $('opponentLogo').src =
    opp.team.logo ||
    'https://a.espncdn.com/i/teamlogos/nba/500/nba.png';

  $('gameClock').textContent = live
    ? (game.status.displayClock || 'GAME IN PROGRESS')
    : final
      ? 'GAME COMPLETE'
      : new Date(game.date).toLocaleString('en-CA', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });

  $('gamePeriod').textContent = live
    ? (game.status.type.detail || 'IN PROGRESS')
    : final
      ? 'FINAL SCORE'
      : 'SCHEDULED';

  $('gameMessage').textContent = live
    ? 'The Raptors are on the floor. Follow every point as the game unfolds.'
    : final
      ? (
          Number(tor.score) > Number(opp.score)
            ? 'Toronto got it done. Another one for the North.'
            : 'The final buzzer has sounded. The work continues.'
        )
      : 'Next game on the calendar. The countdown to tip-off starts here.';
}

// AROUND THE NBA

function renderLeague() {
  const others = games.filter(game =>
    !(game.competitions?.[0]?.competitors || [])
      .some(team => team.team?.abbreviation === 'TOR')
  );

  if (!others.length) {
    $('leagueGames').innerHTML =
      '<p class="loading">No other games in the current feed.</p>';

    return;
  }

  $('leagueGames').innerHTML = others.slice(0, 14).map(game => {
    const teams = game.competitions?.[0]?.competitors || [];

    const away = teams.find(team => team.homeAway === 'away');
    const home = teams.find(team => team.homeAway === 'home');

    if (!away || !home) return '';

    const state = game.status?.type?.state || 'pre';

    const score = state === 'pre'
      ? '—'
      : `${safe(away.score)} – ${safe(home.score)}`;

    const status = state === 'in'
      ? 'LIVE'
      : state === 'post'
        ? 'FINAL'
        : 'UPCOMING';

    return `
      <div class="league-row">
        <span>${dateLabel(game.date)}</span>
        <strong class="team">${safe(away.team.abbreviation)}</strong>
        <strong class="team">${safe(home.team.abbreviation)}</strong>
        <strong class="score">${score}</strong>
        <span class="state">${status}</span>
      </div>
    `;
  }).join('');
}

// ROSTER

function renderRoster() {
  const filter = $('positionFilter').value;

  const filtered = roster.filter(player =>
    filter === 'all' ||
    (player.position?.abbreviation || '').startsWith(filter)
  );

  if (!filtered.length) {
    $('playerGrid').innerHTML =
      '<p class="loading">No players found for this position.</p>';

    return;
  }

  $('playerGrid').innerHTML = filtered.map(player => {
    const name = player.displayName || player.fullName || 'Player';

    const photo = player.headshot?.href ||
      'https://a.espncdn.com/i/teamlogos/nba/500/tor.png';

    return `
      <div class="player-row ${
        selectedPlayer?.id === player.id ? 'selected' : ''
      }"
      data-id="${safe(player.id)}"
      role="button"
      tabindex="0">

        <div class="player-name-cell">
          <img src="${safe(photo)}" alt="${safe(name)}" loading="lazy">
          <strong>${safe(name)}</strong>
        </div>

        <span class="position">
          ${safe(player.position?.abbreviation || '—')}
        </span>

        <span class="number">
          ${safe(player.jersey || '—')}
        </span>

        <span class="view">EXPLORE ↗</span>
      </div>
    `;
  }).join('');
}

// SOCIAL MEDIA LINKS

function socialSearchLinks(name) {
  const query = encodeURIComponent(name + ' Toronto Raptors');

  $('socialLinks').innerHTML = `
    <a
      href="https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(name)}"
      target="_blank"
      rel="noopener">
      INSTAGRAM SEARCH ↗
    </a>

    <a
      href="https://x.com/search?q=${query}"
      target="_blank"
      rel="noopener">
      X / TWITTER ↗
    </a>

    <a
      href="https://www.google.com/search?q=${encodeURIComponent(name + ' official Instagram X Toronto Raptors')}"
      target="_blank"
      rel="noopener">
      OFFICIAL ACCOUNTS ↗
    </a>
  `;
}

// PLAYER STATISTICS

function extractStats(data) {
  const found = {};

  const categories =
    data?.splits?.categories ||
    data?.statistics?.splits?.categories ||
    [];

  for (const category of categories) {
    for (const stat of category.stats || []) {
      const key = (
        stat.abbreviation ||
        stat.name ||
        ''
      ).toLowerCase();

      if (['pts', 'reb', 'ast', 'stl', 'blk'].includes(key)) {
        found[key] = stat.displayValue ?? stat.value;
      }
    }
  }

  return found;
}

async function loadPlayerStats(player) {
  $('statsStatus').textContent = 'LOADING SEASON DATA';

  $('playerStats').innerHTML =
    '<p class="stats-empty">Pulling the latest player numbers…</p>';

  try {
    const data = await getJSON(
      `${API}/athletes/${player.id}/stats`
    );

    const stats = extractStats(data);

    const items = [
      ['pts', 'PTS', 35],
      ['reb', 'REB', 15],
      ['ast', 'AST', 15],
      ['stl', 'STL', 5],
      ['blk', 'BLK', 5]
    ];

    const available = items.filter(([key]) =>
      stats[key] !== undefined
    );

    if (!available.length) {
      throw new Error('No stats found');
    }

    $('statsStatus').textContent = 'ESPN PLAYER STATS';

    $('playerStats').innerHTML = available.map(([key, label, max]) => {
      const value = String(stats[key]);

      const number = parseFloat(
        value.replace(/[^0-9.]/g, '')
      );

      const width = Number.isFinite(number)
        ? Math.min(100, Math.max(4, number / max * 100))
        : 4;

      return `
        <div class="stat-column">
          <label>${label}</label>
          <strong>${safe(value)}</strong>
          <div class="stat-track">
            <i style="width:${width}%"></i>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn(err);

    $('statsStatus').textContent = 'STATS UNAVAILABLE';

    $('playerStats').innerHTML = `
      <p class="stats-empty">
        Season numbers are not available in the current feed for this player.
      </p>
    `;
  }
}

// PLAYER SPOTLIGHT

function choosePlayer(id) {
  const player = roster.find(p =>
    String(p.id) === String(id)
  );

  if (!player) return;

  selectedPlayer = player;

  const name =
    player.displayName ||
    player.fullName ||
    'Raptors player';

  const position =
    player.position?.displayName ||
    player.position?.abbreviation ||
    'Toronto Raptors';

  $('spotlightName').innerHTML =
    safe(name.toUpperCase()).replace(/\s+/, '<br>');

  $('spotlightPosition').textContent =
    `${position.toUpperCase()} / TORONTO RAPTORS`;

  $('spotlightDetails').textContent =
    `A closer look at ${name}: season production, player profile, and places to follow their game.`;

  $('spotlightNumber').textContent =
    `JERSEY / #${player.jersey || '—'}`;

  $('spotlightImage').src =
    player.headshot?.href ||
    'https://a.espncdn.com/i/teamlogos/nba/500/tor.png';

  $('spotlightImage').alt = name;

  socialSearchLinks(name);

  renderRoster();
  loadPlayerStats(player);

  $('spotlight').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

// EVENT LISTENERS

$('refreshBtn').addEventListener('click', loadData);

$('positionFilter').addEventListener('change', renderRoster);

$('playerGrid').addEventListener('click', event => {
  const row = event.target.closest('.player-row');

  if (row) {
    choosePlayer(row.dataset.id);
  }
});

$('playerGrid').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    const row = event.target.closest('.player-row');

    if (row) {
      event.preventDefault();
      choosePlayer(row.dataset.id);
    }
  }
});

// INITIAL LOAD + AUTO REFRESH

loadData();

setInterval(loadData, 60000);
