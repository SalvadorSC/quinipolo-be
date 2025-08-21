// controllers/LeagueStripeController.js
const Stripe = require("stripe");
const { STRIPE_KEY, STRIPE_PRICE_IDS } = require("../config");
const stripe = Stripe(STRIPE_KEY);
const { supabase } = require("../services/supabaseClient");

// Ensure the creator has a moderator membership in user_leagues
const ensureUserLeagueModerator = async (userId, leagueId) => {
  try {
    const { data: existing, error: checkError } = await supabase
      .from("user_leagues")
      .select("user_id")
      .eq("user_id", userId)
      .eq("league_id", leagueId)
      .limit(1);

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking user_leagues:", checkError);
      return;
    }

    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase
        .from("user_leagues")
        .insert({ user_id: userId, league_id: leagueId, role: "moderator" });
      if (insertError) {
        console.error(
          "Error inserting user_leagues moderator entry:",
          insertError
        );
      }
    }
  } catch (err) {
    console.error("Exception ensuring user_leagues moderator entry:", err);
  }
};

// League tier configurations
const LEAGUE_TIERS = {
  managed: {
    name: "Managed League",
    description: "Professional league managed by our development team",
    priceId: STRIPE_PRICE_IDS.managed,
    amount: 3999,
    currency: "eur",
    features: [
      "Professional league management",
      "24/7 support",
      "Advanced analytics",
      "Custom branding",
      "Priority support",
    ],
  },
  self_managed: {
    name: "Self-Managed League",
    description: "League managed by you with optional support",
    priceId: STRIPE_PRICE_IDS.self_managed,
    amount: 3999,
    currency: "eur",
    features: [
      "Full league control",
      "Basic support",
      "Standard analytics",
      "Community features",
    ],
  },
};

// Create a Stripe checkout session for league creation
const createLeagueCheckoutSession = async (req, res) => {
  try {
    const { tier, leagueName, leagueDescription, isPrivate, userId } = req.body;

    if (!tier || !LEAGUE_TIERS[tier]) {
      return res.status(400).json({ error: "Invalid tier specified" });
    }

    if (!leagueName || !userId) {
      return res
        .status(400)
        .json({ error: "League name and user ID are required" });
    }

    // Get user profile from Supabase
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create or get Stripe customer (and heal stale IDs across accounts/modes)
    let customerId = userProfile.stripe_customer_id || null;
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (err) {
        // If the stored ID does not exist in the current Stripe account/mode, create a new one
        if (err && err.code === "resource_missing") {
          customerId = null;
        } else {
          throw err;
        }
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userProfile.email,
        name: userProfile.full_name || userProfile.username,
        metadata: {
          user_id: userId,
          username: userProfile.username,
        },
      });
      customerId = customer.id;

      // Update user profile with Stripe customer ID
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    // Create Stripe checkout session
    // Require configured priceId; we no longer allow hardcoded amounts
    const usePriceId = LEAGUE_TIERS[tier].priceId;
    if (!usePriceId) {
      return res
        .status(500)
        .json({ error: "Missing Stripe price ID for tier" });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: usePriceId, quantity: 1 }],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/league-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/create-league?cancelled=true`,
      metadata: {
        tier: tier,
        league_name: leagueName,
        league_description: leagueDescription || "",
        is_private: isPrivate ? "true" : "false",
        user_id: userId,
      },
      discounts: [
        {
          promotion_code: "promo_1RyaXOBAGHnqysPytRZJXM9c",
        },
      ],
      /* allow_promotion_codes: true, */
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

// Handle Stripe webhook events for league payments
const handleLeaguePaymentWebhook = async (req, res) => {
  console.log("Webhook received:", req.method, req.url);
  console.log("Webhook headers:", req.headers);
  console.log("Webhook body length:", req.body?.length);

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("Webhook event constructed successfully:", event.type);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        console.log("Processing checkout.session.completed event");
        const session = event.data.object;
        console.log("Session metadata:", session.metadata);

        // Extract metadata
        const {
          tier,
          league_name: leagueName,
          league_description: leagueDescription,
          is_private: isPrivate,
          user_id: userId,
        } = session.metadata;

        console.log("Extracted metadata:", {
          tier,
          leagueName,
          leagueDescription,
          isPrivate,
          userId,
        });

        // Create the league in Supabase (align with DB schema)
        const { data: newLeague, error: leagueError } = await supabase
          .from("leagues")
          .insert({
            league_name: leagueName,
            is_private: true, // Always set to private for user-created leagues
            tier: tier,
            created_by: userId,
            status: "active",
          })
          .select()
          .single();

        if (leagueError) {
          console.error("Error creating league:", leagueError);
          throw new Error("Failed to create league");
        }

        console.log("League created successfully:", newLeague);

        // Create league subscription record
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year subscription

        const { error: subscriptionError } = await supabase
          .from("league_subscriptions")
          .insert({
            league_id: newLeague.id,
            user_id: userId,
            stripe_subscription_id: session.subscription || null,
            stripe_customer_id: session.customer,
            status: "active",
            tier: tier,
            amount_paid: session.amount_total,
            currency: session.currency,
            expires_at: expiresAt.toISOString(),
          });

        if (subscriptionError) {
          console.error(
            "Error creating league subscription:",
            subscriptionError
          );
          throw new Error("Failed to create league subscription");
        }

        // Add creator as moderator to the league
        await ensureUserLeagueModerator(userId, newLeague.id);

        // Create leaderboard entry for the creator (following same pattern as LeaguesController)
        const { error: leaderboardError } = await supabase
          .from("leaderboard")
          .insert({
            user_id: userId,
            league_id: newLeague.id,
            points: 0,
            full_correct_quinipolos: 0,
            n_quinipolos_participated: 0,
          });

        if (leaderboardError) {
          console.error("Error creating leaderboard entry:", leaderboardError);
        }

        console.log(
          `League "${leagueName}" created successfully for user ${userId}`
        );
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log("Payment succeeded:", paymentIntent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log("Payment failed:", paymentIntent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

// Get league tier information
const getLeagueTiers = async (req, res) => {
  try {
    const tiers = Object.keys(LEAGUE_TIERS).map((key) => ({
      id: key,
      ...LEAGUE_TIERS[key],
    }));

    res.status(200).json(tiers);
  } catch (error) {
    console.error("Error getting league tiers:", error);
    res.status(500).json({ error: "Failed to get league tiers" });
  }
};

// Verify league subscription status
const verifyLeagueSubscription = async (req, res) => {
  try {
    const { leagueId, userId } = req.params;

    const { data: subscription, error } = await supabase
      .from("league_subscriptions")
      .select("*")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const isActive =
      subscription && new Date(subscription.expires_at) > new Date();

    res.status(200).json({
      hasActiveSubscription: isActive,
      subscription: subscription || null,
    });
  } catch (error) {
    console.error("Error verifying league subscription:", error);
    res.status(500).json({ error: "Failed to verify subscription" });
  }
};

// Get checkout session details and resolve created league if any
const getCheckoutSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Attempt to locate the league created by the webhook
    const tier = session?.metadata?.tier || null;
    const userId = session?.metadata?.user_id || null;
    const leagueName = session?.metadata?.league_name || null;

    let league = null;
    if (leagueName && userId) {
      const { data, error } = await supabase
        .from("leagues")
        .select("*")
        .eq("league_name", leagueName)
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        league = data[0];
      }
    }

    // Fallback: if payment succeeded but webhook hasn't created the league yet,
    // create it here to avoid race conditions in local/dev setups
    if (
      !league &&
      session?.payment_status === "paid" &&
      leagueName &&
      userId &&
      tier
    ) {
      try {
        // Create league
        const { data: newLeague, error: leagueError } = await supabase
          .from("leagues")
          .insert({
            league_name: leagueName,
            is_private: true,
            tier: tier,
            created_by: userId,
            status: "active",
          })
          .select()
          .single();

        if (leagueError) {
          console.error("Fallback: error creating league:", leagueError);
          throw leagueError;
        }

        league = newLeague;

        // Create subscription record
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        const { error: subscriptionError } = await supabase
          .from("league_subscriptions")
          .insert({
            league_id: newLeague.id,
            user_id: userId,
            stripe_subscription_id: session.subscription || null,
            stripe_customer_id: session.customer,
            status: "active",
            tier: tier,
            amount_paid: session.amount_total,
            currency: session.currency,
            expires_at: expiresAt.toISOString(),
          });
        if (subscriptionError) {
          console.error(
            "Fallback: error creating league subscription:",
            subscriptionError
          );
        }

        // Ensure creator is moderator in user_leagues
        await ensureUserLeagueModerator(userId, newLeague.id);

        // Create leaderboard entry
        const { error: leaderboardError } = await supabase
          .from("leaderboard")
          .insert({
            user_id: userId,
            league_id: newLeague.id,
            points: 0,
            full_correct_quinipolos: 0,
            n_quinipolos_participated: 0,
          });
        if (leaderboardError) {
          console.error(
            "Fallback: error creating leaderboard entry:",
            leaderboardError
          );
        }
      } catch (fallbackErr) {
        console.error(
          "Fallback: failed to finalize league after paid session:",
          fallbackErr
        );
      }
    }

    // Ensure membership also for pre-existing league
    if (league && userId) {
      await ensureUserLeagueModerator(userId, league.id);
    }
    return res.status(200).json({ session, league });
  } catch (error) {
    console.error("Error fetching checkout session:", error);
    return res.status(500).json({ error: "Failed to fetch session" });
  }
};

module.exports = {
  createLeagueCheckoutSession,
  handleLeaguePaymentWebhook,
  getLeagueTiers,
  verifyLeagueSubscription,
  getCheckoutSessionStatus,
  LEAGUE_TIERS,
};
