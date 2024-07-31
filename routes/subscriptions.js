const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(
  process.env.STRIPE_SECRET_KEY ||
    "sk_test_51L71ojBAGHnqysPyGny75aZRdHcRAPYWFbFk7pDfJBLW8WjTtqdG3py4ISzhrJXk85t4WMSquWTgkM9qx59EI2VE00wYpcYrr5"
);
const { updateUserSubscription } = require("../controllers/UserController");
const User = require("../models/User");

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

    await updateUserSubscription(user._id, subscription.id, planId);

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
    res.status(200).send(updatedSubscription);
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

router.post("/create-payment-intent", async (req, res) => {
  const { userId, planId } = req.body;

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // Set the amount based on the plan selected
      currency: "eur",
      customer: customerId,
      metadata: { planId },
    });

    res.status(200).send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

router.post("/create-checkout-session", async (req, res) => {
  const { userId, planId } = req.body;

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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: planId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    res.status(200).send({ id: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

module.exports = router;
