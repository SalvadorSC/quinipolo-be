// utils/usernameValidation.js
const { supabase } = require("../services/supabaseClient");

/**
 * Validates a username for security and uniqueness
 * @param {string} username - The username to validate
 * @param {string} [excludeUserId] - User ID to exclude from uniqueness check (for profile updates)
 * @returns {Promise<{isValid: boolean, error: string|null}>}
 */
async function validateUsername(username, excludeUserId = null) {
  // Check if username is provided and not empty
  if (
    !username ||
    typeof username !== "string" ||
    username.trim().length === 0
  ) {
    return {
      isValid: false,
      error: "Username is required and cannot be empty",
    };
  }

  const trimmedUsername = username.trim();

  // Check username length (3-15 characters)
  if (trimmedUsername.length < 3) {
    return {
      isValid: false,
      error: "Username must be at least 3 characters long",
    };
  }

  if (trimmedUsername.length > 15) {
    return {
      isValid: false,
      error: "Username cannot exceed 15 characters",
    };
  }

  // Prevent restricted words in username (configurable)
  const {
    RESTRICTED_USERNAMES,
    SPANISH_SWEAR_AND_HATE_WORDS,
  } = require("../config");
  const lower = trimmedUsername.toLowerCase();
  const banned = [...RESTRICTED_USERNAMES, ...SPANISH_SWEAR_AND_HATE_WORDS];
  if (banned.some((word) => lower.includes(word.toLowerCase()))) {
    return {
      isValid: false,
      error: "Username cannot contain restricted words",
    };
  }

  // Check if username already exists
  try {
    let query = supabase
      .from("profiles")
      .select("id, username")
      .eq("username", trimmedUsername);

    // Exclude current user if provided (for profile updates)
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }

    const { data: existingUser, error: checkError } = await query.single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is what we want
      console.error("Error checking username uniqueness:", checkError);
      return {
        isValid: false,
        error: "Error checking username availability",
      };
    }

    if (existingUser) {
      return {
        isValid: false,
        error: "Username already exists. Please choose a different username.",
      };
    }

    return {
      isValid: true,
      error: null,
    };
  } catch (error) {
    console.error("Error validating username:", error);
    return {
      isValid: false,
      error: "Error validating username",
    };
  }
}

module.exports = {
  validateUsername,
};
