/**
 * Backend Quinipolo Types Documentation
 *
 * This file documents the expected data structures for Quinipolo-related API responses
 * to ensure consistency between frontend and backend.
 */

/**
 * Supabase Quinipolo table structure
 * @typedef {Object} SupabaseQuinipolo
 * @property {string} id - Unique identifier
 * @property {string} league_id - Reference to leagues table
 * @property {Array} quinipolo - Array of survey items
 * @property {string} end_date - ISO date string
 * @property {boolean} has_been_corrected - Whether answers have been corrected
 * @property {string} creation_date - ISO date string
 * @property {boolean} is_deleted - Whether quinipolo is marked as deleted
 * @property {Array<string>} [participants_who_answered] - Array of user IDs who answered
 * @property {Array} [correct_answers] - Array of correct answers
 */

/**
 * API Response structure for quinipolo endpoints
 * @typedef {Object} QuinipoloApiResponse
 * @property {string} id - Unique identifier
 * @property {string} league_id - Reference to leagues table
 * @property {string} league_name - League name (added by backend joins)
 * @property {Array} quinipolo - Array of survey items
 * @property {string} end_date - ISO date string
 * @property {boolean} has_been_corrected - Whether answers have been corrected
 * @property {string} creation_date - ISO date string
 * @property {boolean} is_deleted - Whether quinipolo is marked as deleted
 * @property {Array<string>} [participants_who_answered] - Array of user IDs who answered
 * @property {Array} [correct_answers] - Array of correct answers
 * @property {boolean} [answered] - Whether current user has answered (added by getQuinipolosToAnswer)
 */

/**
 * Survey item structure
 * @typedef {Object} SurveyItem
 * @property {string} gameType - "waterpolo" | "football"
 * @property {string} homeTeam - Home team name
 * @property {string} awayTeam - Away team name
 * @property {boolean} isGame15 - Whether this is the 15th game
 */

/**
 * Correct answer structure
 * @typedef {Object} CorrectAnswer
 * @property {number} matchNumber - Match number (1-15)
 * @property {string} chosenWinner - "home" | "away" | "draw"
 * @property {string} goalsHomeTeam - Number of goals for home team
 * @property {string} goalsAwayTeam - Number of goals for away team
 * @property {boolean} isGame15 - Whether this is the 15th game
 */

/**
 * Backend API endpoints that return quinipolo data:
 *
 * 1. GET /api/leagues/league/:leagueId/leagueQuinipolos
 *    - Returns: QuinipoloApiResponse[]
 *    - Includes: league_name via Supabase join
 *
 * 2. GET /api/users/me/quinipolos
 *    - Returns: QuinipoloApiResponse[]
 *    - Includes: league_name via Supabase join, answered flag
 *
 * 3. POST /api/quinipolos
 *    - Returns: QuinipoloApiResponse
 *    - Includes: league_name added manually in response
 *
 * 4. GET /api/quinipolos/:id
 *    - Returns: QuinipoloApiResponse
 *    - Note: This endpoint still uses MongoDB, needs migration
 */

module.exports = {
  // Export types for potential future use
  SupabaseQuinipolo: "SupabaseQuinipolo",
  QuinipoloApiResponse: "QuinipoloApiResponse",
  SurveyItem: "SurveyItem",
  CorrectAnswer: "CorrectAnswer",
};
