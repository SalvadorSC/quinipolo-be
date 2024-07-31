// controllers/StripeController.js
const User = require("../models/User");

const handleSubscriptionEvent = async (event) => {
  const subscription = event.data.object;

  switch (event.type) {
    case "customer.subscription.updated":
    case "customer.subscription.created":
      await User.findOneAndUpdate(
        { "subscription.id": subscription.id },
        {
          "subscription.status": subscription.status,
          "subscription.plan": subscription.items.data[0].plan.id,
        }
      );
      break;
    case "customer.subscription.deleted":
      await User.findOneAndUpdate(
        { "subscription.id": subscription.id },
        {
          "subscription.status": "canceled",
        }
      );
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
};

module.exports = { handleSubscriptionEvent };
