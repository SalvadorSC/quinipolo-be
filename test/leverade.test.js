process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test-service-key";
process.env.NODE_ENV ||= "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseLeveradeMatches,
  resolveLeveradeTeamName,
  leveradeDatetimeToIso,
} = require("../services/scraper/leverade");
const {
  supplementDomesticMatches,
  computeAdjustedQuotas,
  buildPresetSelections,
  warnEmptyLeagues,
  isSameFixture,
} = require("../services/scraper/scraperService");
const { maxClfFill } = require("../services/scraper/config");

const PDM = {
  id: "PDM",
  name: "Primera División Masculina",
};

test("Leverade datetimes are UTC and convert to Madrid time", () => {
  const iso = leveradeDatetimeToIso("2026-10-10 10:15:00");
  assert.equal(iso, "2026-10-10T10:15:00.000Z");
  const madrid = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  assert.equal(madrid, "12:15");

  const pdf = leveradeDatetimeToIso("2026-10-10 15:00:00");
  const pdfMadrid = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(pdf));
  assert.equal(pdfMadrid, "17:00");
});

test("home and away come from meta, not the teams relationship order", () => {
  const payload = {
    data: [
      {
        type: "match",
        id: "145435700",
        attributes: {
          datetime: "2026-10-10 10:15:00",
          canceled: false,
          postponed: false,
          rest: false,
        },
        meta: { home_team: "home-1", away_team: "away-1" },
        relationships: {
          teams: {
            data: [
              { type: "team", id: "away-1" },
              { type: "team", id: "home-1" },
            ],
          },
        },
      },
      {
        type: "match",
        id: "skip-me",
        attributes: {
          datetime: "2026-10-10 11:00:00",
          canceled: true,
        },
        meta: { home_team: "home-1", away_team: "away-1" },
      },
    ],
    included: [
      {
        type: "team",
        id: "home-1",
        attributes: { name: "C.N. MONTJUIC" },
        relationships: { club: { data: { type: "club", id: "c1" } } },
      },
      {
        type: "team",
        id: "away-1",
        attributes: { name: "C. WATERPOLO TURIA" },
        relationships: { club: { data: { type: "club", id: "c2" } } },
      },
      { type: "club", id: "c1", attributes: { name: "C.N. MONTJUIC" } },
      { type: "club", id: "c2", attributes: { name: "C.D. WATERPOLO TURIA" } },
    ],
  };

  const matches = parseLeveradeMatches(payload, PDM);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].homeTeam, "C.N. MONTJUIC");
  assert.equal(matches[0].awayTeam, "C.D. WATERPOLO TURIA");
  assert.equal(matches[0].startTime, "2026-10-10T10:15:00.000Z");
  assert.equal(matches[0].leveradeId, "145435700");
  assert.equal(matches[0].source, "leverade");
  assert.equal(matches[0].leagueId, "PDM");
});

test("sponsor prefixes use the club name and unrelated clubs are ignored", () => {
  const cases = [
    ["ASTRALPOOL C.N. SABADELL", "C.N. SABADELL", "C.N. SABADELL"],
    ["ZODIAC C.N. ATLETIC-BARCELONETA", "C.N. ATLETIC-BARCELONETA", "C.N. ATLETIC-BARCELONETA"],
    ["Solartradex C.N. MATARO", "C.N. MATARO", "C.N. MATARO"],
    ["LOOMIS PAY REAL CANOE N.C. GEODESIC", "REAL CANOE N.C.", "REAL CANOE N.C."],
    ["SANTA CRUZ TENERIFE ECHEYDE", "C.N. ECHEYDE", "C.N. ECHEYDE"],
    ["CLUB WATERPOLO ELX HUMANS", "CLUB WATERPOLO ELX", "CLUB WATERPOLO ELX"],
    ["C.W. DOS HERMANAS PQS", "C.W. DOS HERMANAS", "C.W. DOS HERMANAS"],
    ["Adbisio ETL GLOBAL C.N. MANRESA", "C.N. MANRESA", "C.N. MANRESA"],
    ["C. WATERPOLO TURIA", "C.D. WATERPOLO TURIA", "C.D. WATERPOLO TURIA"],
    ["WATERPOLO CIUDAD DE RIVAS", "C.WATERPOLO CIUDAD DE RIVAS", "C. WATERPOLO CIUDAD DE RIVAS"],
    ["AESE - L'HOSPITALET", "A.E. SANTA EULALIA", "A.E. SANTA EULALIA"],
    ["C.N. CABALLA - CIUDAD DE CEUTA", "C.N. CABALLA - CIUDAD DE CEUTA", "C.N. CABALLA"],
    ["URBAT IKE", "URBAT IKE", "URBAT"],
    ["COLEGIO BRAINS", "Club Deportivo Básico Bis", "COLEGIO BRAINS"],
    ["FAUCA UNIÓN WATERPOLO TENERIFE", "C.WP. ERIDU Y CURTIN", "FAUCA UNIÓN WATERPOLO TENERIFE"],
  ];

  cases.forEach(([team, club, expected]) => {
    assert.equal(
      resolveLeveradeTeamName(team, club),
      expected,
      `${team} -> ${club}`
    );
  });
});

function flash(leagueId, home, away, startTime) {
  return {
    leagueId,
    homeTeam: home,
    awayTeam: away,
    startTime,
    source: "flashscore",
    flashscoreId: `${leagueId}-${home}`,
  };
}

test("Leverade fills only leagues that are short inside the window", () => {
  const primary = [
    flash("DHM", "Barceloneta", "Caballa", "2026-10-09T18:45:00.000Z"),
    flash("DHM", "Real Canoe", "Mataró", "2026-10-10T15:00:00.000Z"),
    flash("DHM", "Echeyde", "Sabadell", "2026-10-10T16:00:00.000Z"),
    flash("DHM", "Mediterrani", "Sant Andreu", "2026-10-10T16:00:00.000Z"),
    flash("DHF", "Real Canoe F", "Mediterrani F", "2026-10-10T11:30:00.000Z"),
    flash("DHF", "Echeyde F", "Barceloneta F", "2026-10-10T12:00:00.000Z"),
  ];
  const backup = [
    flash("DHM", "C.N. ATLETIC-BARCELONETA", "C.N. CABALLA", "2026-10-09T18:45:00.000Z"),
    flash("DHM", "REAL CANOE N.C.", "C.N. MATARO", "2026-10-10T15:00:00.000Z"),
    flash("DHM", "C.N. ECHEYDE", "C.N. SABADELL", "2026-10-10T16:00:00.000Z"),
    flash("DHM", "C.E. MEDITERRANI", "C.N. SANT ANDREU", "2026-10-10T16:00:00.000Z"),
    flash("DHF", "REAL CANOE N.C.", "C.E. MEDITERRANI", "2026-10-10T11:30:00.000Z"),
    flash("DHF", "C.N. ECHEYDE", "C.N. ATLETIC-BARCELONETA", "2026-10-10T12:00:00.000Z"),
    {
      leagueId: "PDM",
      homeTeam: "C.N. MONTJUIC",
      awayTeam: "C.D. WATERPOLO TURIA",
      startTime: "2026-10-10T10:15:00.000Z",
      source: "leverade",
      leveradeId: "pdm-1",
    },
    {
      leagueId: "PDF",
      homeTeam: "C.N. CUATRO CAMINOS",
      awayTeam: "C.D. WATERPOLO TURIA",
      startTime: "2026-10-10T15:00:00.000Z",
      source: "leverade",
      leveradeId: "pdf-1",
    },
    {
      leagueId: "SDM",
      homeTeam: "C.N. MANRESA",
      awayTeam: "C.N. CIUDAD DE ALCORCON",
      startTime: "2026-10-10T14:00:00.000Z",
      source: "leverade",
      leveradeId: "sdm-1",
    },
  ];

  assert.equal(isSameFixture(primary[0], backup[0]), true);
  assert.equal(isSameFixture(primary[4], backup[4]), true);

  const merged = supplementDomesticMatches(primary, backup);
  const count = (leagueId) =>
    merged.filter((match) => match.leagueId === leagueId).length;
  assert.equal(count("DHM"), 4);
  assert.equal(count("DHF"), 2);
  assert.equal(count("PDM"), 1);
  assert.equal(count("PDF"), 1);
  assert.equal(count("SDM"), 1);
  assert.equal(
    merged.filter((match) => match.leagueId === "DHM" && match.source === "leverade")
      .length,
    0
  );
});

test("CLF only fills domestic shortfalls and is capped", () => {
  const domestic = [];
  ["DHM", "DHM", "DHM", "DHM"].forEach((leagueId, index) => {
    domestic.push({
      ...flash(leagueId, `Home ${index}`, `Away ${index}`, `2026-10-10T1${index}:00:00.000Z`),
      matchId: `dhm-${index}`,
      isChampionsLeague: false,
      closeness: 1,
    });
  });
  ["DHF", "DHF"].forEach((leagueId, index) => {
    domestic.push({
      ...flash(leagueId, `F Home ${index}`, `F Away ${index}`, `2026-10-10T1${index}:30:00.000Z`),
      matchId: `dhf-${index}`,
      isChampionsLeague: false,
      closeness: 1,
    });
  });
  for (let i = 0; i < 6; i += 1) {
    domestic.push({
      leagueId: "PDM",
      homeTeam: `PDM H${i}`,
      awayTeam: `PDM A${i}`,
      startTime: `2026-10-10T${String(8 + i).padStart(2, "0")}:00:00.000Z`,
      matchId: `pdm-${i}`,
      isChampionsLeague: false,
      closeness: Number.POSITIVE_INFINITY,
      source: "leverade",
    });
  }
  for (let i = 0; i < 6; i += 1) {
    domestic.push({
      leagueId: "PDF",
      homeTeam: `PDF H${i}`,
      awayTeam: `PDF A${i}`,
      startTime: `2026-10-11T${String(8 + i).padStart(2, "0")}:00:00.000Z`,
      matchId: `pdf-${i}`,
      isChampionsLeague: false,
      closeness: Number.POSITIVE_INFINITY,
      source: "leverade",
    });
  }
  for (let i = 0; i < 8; i += 1) {
    domestic.push({
      leagueId: "SDM",
      homeTeam: `SDM H${i}`,
      awayTeam: `SDM A${i}`,
      startTime: `2026-10-10T${String(10 + i).padStart(2, "0")}:15:00.000Z`,
      matchId: `sdm-${i}`,
      isChampionsLeague: false,
      closeness: Number.POSITIVE_INFINITY,
      source: "leverade",
    });
  }

  const clf = [];
  for (let i = 0; i < 18; i += 1) {
    clf.push({
      leagueId: "CLF",
      homeTeam: `CLF H${i}`,
      awayTeam: `CLF A${i}`,
      startTime: `2026-10-09T${String(i).padStart(2, "0")}:00:00.000Z`,
      matchId: `clf-${i}`,
      isChampionsLeague: true,
      closeness: Number.POSITIVE_INFINITY,
      source: "flashscore",
    });
  }

  const matches = [...domestic, ...clf];
  const quotas = computeAdjustedQuotas(matches);
  assert.equal(quotas.DHM, 4);
  assert.equal(quotas.DHF, 2);
  assert.equal(quotas.PDM, 3);
  assert.equal(quotas.PDF, 3);
  assert.equal(quotas.SDM, 1);
  assert.equal(quotas.CLF, 2);
  assert.equal(quotas.CL, undefined);
  assert.ok(quotas.CLF <= maxClfFill);

  const presets = buildPresetSelections(matches, quotas);
  ["easy", "moderate", "hard"].forEach((strategy) => {
    const picked = presets[strategy].map((id) =>
      matches.find((match) => match.matchId === id)
    );
    const tally = {};
    picked.forEach((match) => {
      tally[match.leagueId] = (tally[match.leagueId] || 0) + 1;
    });
    assert.equal(tally.PDM, 3, strategy);
    assert.equal(tally.PDF, 3, strategy);
    assert.equal(tally.SDM, 1, strategy);
    assert.equal(tally.DHM, 4, strategy);
    assert.equal(tally.DHF, 2, strategy);
    assert.ok((tally.CLF || 0) <= maxClfFill, strategy);
    assert.equal(tally.CLF, 2, strategy);
    assert.equal(picked.length, 15, strategy);
  });
});

test("an empty league logs a warning", () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    warnEmptyLeagues([
      { leagueId: "DHM" },
      { leagueId: "DHF" },
      { leagueId: "PDM" },
      { leagueId: "SDM" },
    ]);
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /No PDF matches/);
});
