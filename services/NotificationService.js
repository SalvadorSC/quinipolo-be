const Notification = require("../models/Notification");
const User = require("../models/User");
const Quinipolo = require("../models/Quinipolo");
const Answer = require("../models/Answers");
const Leagues = require("../models/Leagues");

const createNotification = async (userId, username, type, title, message, quinipoloId = null, leagueId = null) => {
  try {
    const notification = new Notification({
      userId,
      username,
      type,
      title,
      message,
      quinipoloId,
      leagueId,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

const notifyNewQuinipolo = async (quinipoloId, leagueId) => {
  try {
    const quinipolo = await Quinipolo.findById(quinipoloId);
    const league = await Leagues.findOne({ leagueId });
    
    // Get all moderators of the league
    const moderators = await User.find({ 
      username: { $in: league.moderators }
    });

    const notifications = moderators.map(user => 
      createNotification(
        user._id,
        user.username,
        "new_quinipolo",
        "¡Nueva Quinipolo disponible!",
        `Se ha publicado una nueva Quinipolo en la liga ${quinipolo.leagueName}. ¡No te la pierdas!`,
        quinipoloId,
        leagueId
      )
    );

    await Promise.all(notifications);
  } catch (error) {
    console.error("Error notifying new quinipolo:", error);
    throw error;
  }
};

const checkAndNotifyReminders = async () => {
  try {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    
    // Find quinipolos that end in the next hour
    const endingQuinipolos = await Quinipolo.find({
      endDate: { $lte: oneHourFromNow, $gt: new Date() },
      hasBeenCorrected: false
    });

    for (const quinipolo of endingQuinipolos) {
      // Get the league and its moderators
      const league = await Leagues.findOne({ leagueId: quinipolo.leagueId });
      const moderators = await User.find({ 
        username: { $in: league.moderators }
      });

      const notifications = moderators.map(user =>
        createNotification(
          user._id,
          user.username,
          "reminder",
          "¡Última hora para responder!",
          `La Quinipolo de la liga ${quinipolo.leagueName} cierra en menos de una hora. ¡No te olvides de responder!`,
          quinipolo._id,
          quinipolo.leagueId
        )
      );

      await Promise.all(notifications);
    }
  } catch (error) {
    console.error("Error checking and notifying reminders:", error);
    throw error;
  }
};

module.exports = {
  createNotification,
  notifyNewQuinipolo,
  checkAndNotifyReminders
}; 