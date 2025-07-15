const { supabase } = require("../services/supabaseClient");

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  // Use Supabase to get user from JWT
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.sendStatus(403);
  }
  req.user = data.user;
    next();
}

module.exports = { authenticateToken }; 