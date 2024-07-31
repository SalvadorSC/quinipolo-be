const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { updateUserSubscription } = require("../controllers/UserController");
const User = require("../models/User");

// Helper function to determine role
const getRole = (planId) => {
  if (
    planId === process.env.PRO_MONTHLY_PLAN_ID ||
    planId === process.env.PRO_YEARLY_PLAN_ID
  ) {
    return "pro";
  } else if (
    planId === process.env.MODERATOR_MONTHLY_PLAN_ID ||
    planId === process.env.MODERATOR_YEARLY_PLAN_ID
  ) {
    return "moderator";
  }
  return "user";
};

// Create a new subscription
router.post("/create-subscription", async (req, res) => {
  const { userId, paymentMethodId, planId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
      });
      customerId = customer.id;

      user.stripeCustomerId = customerId;
      await user.save();
    }

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: planId }],
      expand: ["latest_invoice.payment_intent"],
    });

    const role = getRole(planId);
    user.role = role;

    await updateUserSubscription(user._id, subscription.id, planId);
    await user.save();

    res.status(200).send(subscription);
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

// Retrieve subscription details
router.get("/subscription-details/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    let subscription = null;

    if (user.subscription?.id) {
      subscription = await stripe.subscriptions.retrieve(user.subscription.id);
    }

    if (subscription) {
      res.status(200).send(subscription);
    } else {
      res.status(200).send({ message: "No active subscriptions found" });
    }
  } catch (error) {
    console.error("Error fetching subscription details:", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

// Cancel subscription
router.post("/cancel-subscription", async (req, res) => {
  const { subscriptionId } = req.body;

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    res.status(200).send(subscription);
  } catch (error) {
    console.error("Error canceling subscription:", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

// Update subscription plan
router.post("/update-subscription", async (req, res) => {
  const { subscriptionId, newPlanId } = req.body;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPlanId,
          },
        ],
      }
    );

    const user = await User.findOne({ "subscription.id": subscriptionId });
    if (user) {
      const role = getRole(newPlanId);
      user.role = role;
      await user.save();
    }

    res.status(200).send(updatedSubscription);
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

module.exports = router;
