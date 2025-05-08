const express = require("express");
const router = express.Router();
const NotificationsController = require("../controllers/NotificationsController");
const { authenticateToken } = require("../middleware/auth");

// Get user notifications
router.get("/:userId", authenticateToken, NotificationsController.getNotifications);

// Mark notification as read
router.patch("/:notificationId/read", authenticateToken, NotificationsController.markAsRead);

// Mark all notifications as read
router.patch("/:userId/read-all", authenticateToken, NotificationsController.markAllAsRead);

// Delete notification
router.delete("/:notificationId", authenticateToken, NotificationsController.deleteNotification);

module.exports = router; 