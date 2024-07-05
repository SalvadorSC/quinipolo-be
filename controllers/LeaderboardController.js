const Leaderboard = require("../models/Leaderboard");
const User = require("../models/User");

const updateLeaderboard = async (
  userId,
  leagueId,
  points,
  fullCorrectQuinipolo
) => {
  const entry = await Leaderboard.findOne({ userId, leagueId });
  const user = await User.findOne({ _id: userId });
  if (entry) {
    entry.points += points;
    if (fullCorrectQuinipolo) {
      entry.fullCorrectQuinipolos += 1;
    }
    await entry.save();
  } else {
    const newEntry = new Leaderboard({
      userId,
      leagueId,
      points,
      fullCorrectQuinipolos: fullCorrectQuinipolo ? 1 : 0,
    });
    await newEntry.save();
  }
  const response = {
    username: user.username,
    totalPoints: entry.points,
    fullCorrectQuinipolos: entry.fullCorrectQuinipolos,
    changeInPoints: points,
  };
  console.log(response);
  return response;
};

module.exports = {
  updateLeaderboard,
};
