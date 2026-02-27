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
| `image1_lastResults` | Match results grouped by league (DHF, DHM, CLF), with scores and status | correction-see + correct_answers |
| `image2_lastResultsExtended` | Alternate quinipolo with CLF, PDF, PDM, PLENO AL 15 | Same |
| `image3_quinipoloRanking` | Ranking for this quinipolo (points per user) | submit-correction → results |
| `image4_generalLeagueRanking` | General league leaderboard (cumulative points) | GET leaderboard |
| `image5_statistics` | Average points, most failed match, correct guesses count | submit-correction → averagePointsThisQuinipolo, mostFailed |
| `rawBeResponses` | Raw API response shapes for reference | All endpoints |

### Use Cases

- Image generation service (OG images, social posts)
- Testing graphic templates without live data
- API contract validation for new graphic endpoints
