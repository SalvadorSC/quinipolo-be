// controllers/StripeController.js
const Stripe = require("stripe");
const stripe = Stripe(
  "sk_test_51L71ojBAGHnqysPyGny75aZRdHcRAPYWFbFk7pDfJBLW8WjTtqdG3py4ISzhrJXk85t4WMSquWTgkM9qx59EI2VE00wYpcYrr5" /* || 'process.env.STRIPE_SECRET_KEY' */
);

const User = require("../models/User");

const plans = [
  // Quinipolo Pro Plan Mensual
  {
    link:
      process.env.REACT_APP_ENV === "development"
        ? "https://buy.stripe.com/test_bIYaFU45M5oRaCA5kl"
        : process.env.REACT_APP_PRO_MONTHLY_LINK,
    priceId:
      process.env.REACT_APP_ENV === "development"
        ? "price_1PgiQkBAGHnqysPyrkToSdEP"
        : process.env.REACT_APP_PRO_MONTHLY_PLAN_ID,
  },
  // Quinipolo Pro Plan Anual
  {
    link:
      process.env.REACT_APP_ENV === "development"
        ? "https://buy.stripe.com/test_bIYcO21XE8B35igfZ0"
        : process.env.REACT_APP_PRO_YEARLY_LINK,
    priceId:
      process.env.REACT_APP_ENV === "development"
        ? "price_1PiWO4BAGHnqysPyDiq9vQh8"
        : process.env.REACT_APP_PRO_YEARLY_PLAN_ID,
  },
];

const handleSubscriptionEvent = async (request, response) => {
  const sig = request.header("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      // First payment is successful and a subscription is created (if mode was set to "subscription" in ButtonCheckout)
      // ✅ Grant access to the product

      try {
        const session = await stripe.checkout.sessions.retrieve(
          event.data.object.id, // Use `event.data.object`
          { expand: ["line_items"] }
        );
        const customerId = session?.customer;
        const customer = await stripe.customers.retrieve(customerId);
        const priceId = session?.line_items?.data[0]?.price.id;
        const plan = plans.find((p) => p.priceId === priceId);
        if (!plan) {
          console.error("No plan found");
          throw new Error("No plan found");
        }

        if (customer.email) {
          const user = await User.findOne({ email: customer.email });

          if (!user) {
            throw new Error("No user found");
          }

          user.priceId = priceId;
          user.isPro = true;
          user.stripeCustomerId = customerId;
          console.log(user);
          await user.save();
        }

        // Update user data + Grant user access to your product. It's a boolean in the database, but could be a number of credits, etc...

        // Extra: >>>>> send email to dashboard <<<<
      } catch (err) {
        console.error("Error handling checkout.session.completed:", err);
        return response.status(500).send("Internal Server Error");
      }
      break;
    }
    case "customer.subscription.deleted": {
      // ❌ Revoke access to the product
      // The customer might have changed the plan (higher or lower plan, cancel soon etc...)
      const subscription = await stripe.subscriptions.retrieve(
        event.data.object.id
      );
      console.log(subscription);
      const user = await User.findOne({
        stripeCustomerId: subscription.customer,
      });
      console.log(user);

      // Revoke access to your product
      user.isPro = false;
      await user.save();

      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  // Return a 200 response to acknowledge receipt of the event
  response.status(200).send("Webhook processed successfully");
};

module.exports = { handleSubscriptionEvent, plans };
