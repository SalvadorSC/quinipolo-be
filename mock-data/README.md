# Mock Data

## `match-results-for-posts.json`

Mock data for the **automatic post creation** feature that announces match results.

### Source

Real data from `quinipolo-be` scraper (`fetchFlashscoreResults`), which mirrors `quinipolo-scrapper` output.

### Structure

| Key | Description |
|-----|-------------|
| `scraperResults` | Raw format from the scraper (leagueId, homeTeam, awayTeam, homeScore, awayScore, startTime, etc.) |
| `postReadyResults` | Enriched format for post generation (adds outcome, scoreDisplay, matchDateFormatted, wentToPenalties) |
| `samplePostTemplates` | Placeholder templates for single-match and league-summary posts |

### Use Cases

- Testing post creation UI
- API contract validation
- Post template generation
- Feature development without hitting Flashscore

### Leagues Covered

DHM, DHF, PDM, PDF, SDM (Spanish water polo leagues). Includes a penalty shootout example (Mediterrani vs Caballa).

---

## `graphics-payloads.json`

Mock data for generating the **5 quinipolo result graphics** (JORNADA 16 style).

### Source

Mirrors BE API returns: `correction-see`, `submit-correction`, `GET /api/leagues/:leagueId/leaderboard`.

### Structure

| Key | Description | BE Source |
|-----|-------------|-----------|
| `image1_lastResults` | Match results 1-7 (DHF 2, DHM 4, CLF 1) | correction-see + correct_answers |
| `image2_lastResultsExtended` | Match results 8-15 (DHF 1, PDM 3, PDF 3, PLENO AL 15 1) | Same. Total 15 matches |
| `image3_quinipoloRanking` | Ranking for this quinipolo (points per user) | submit-correction → results |
| `image4_generalLeagueRanking` | General league leaderboard (cumulative points) | GET leaderboard |
| `image5_statistics` | Average points, most failed match, correct guesses count | submit-correction → averagePointsThisQuinipolo, mostFailed |
| `rawBeResponses` | Raw API response shapes for reference | All endpoints |

### Quinipolo & Scraper Data (15 matches)

**Supabase `quinipolos` table:** `quinipolo` (15 survey items) + `correct_answers` (15). Each item has `leagueId`, `homeTeam`, `awayTeam`, `isGame15`. Correct answers have `matchNumber`, `goalsHomeTeam`, `goalsAwayTeam`, optional `cancelled`.

**Scraper config** (`services/scraper/config.js`): DHM 4, DHF 4, PDM 3, PDF 3, SDM 1. Champions League (CL/CLF) can replace. `fetchFlashscoreResults` returns `leagueId`, `leagueName`, `homeTeam`, `awayTeam`, `homeScore`, `awayScore`, `status`.

**rawBeResponses.correctionSee** = full 15-match quinipolo + correct_answers. Transform to `matchesByLeague` by grouping by `leagueId` and merging scores.

### Use Cases

- Image generation service (OG images, social posts)
- Testing graphic templates without live data
- API contract validation for new graphic endpoints
