const cron = require('node-cron');
const NotificationService = require('./services/NotificationService');

// Schedule the reminder check to run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    console.log('Checking for Quinipolo reminders...');
    await NotificationService.checkAndNotifyReminders();
    console.log('Reminder check completed');
  } catch (error) {
    console.error('Error in reminder check:', error);
  }
});

module.exports = cron; 