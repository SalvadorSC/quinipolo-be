// models/Leagues.js - Updated for Supabase compatibility
const { supabase } = require("../services/supabaseClient");

// Supabase table structure for leagues
const createLeagueTable = async () => {
  // This would be done via Supabase migrations, but here's the structure:
  /*
  CREATE TABLE leagues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_name VARCHAR NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT false,
    tier VARCHAR NOT NULL CHECK (tier IN ('managed', 'self_managed')),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    current_participants INTEGER DEFAULT 0
  );
  */
};

// Supabase table structure for league subscriptions
const createLeagueSubscriptionsTable = async () => {
  /*
  CREATE TABLE league_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR,
    stripe_customer_id VARCHAR,
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due')),
    tier VARCHAR NOT NULL CHECK (tier IN ('managed', 'self_managed')),
    amount_paid INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR DEFAULT 'usd',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(league_id, user_id)
  );
  */
};

// Helper functions for Supabase operations
const createLeague = async (leagueData) => {
  const { data, error } = await supabase
    .from("leagues")
    .insert({
      league_name: leagueData.leagueName || leagueData.name,
      description: leagueData.description,
      is_private: leagueData.isPrivate,
      tier: leagueData.tier,
      created_by: leagueData.createdBy,
      status: leagueData.status || "active",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

const getLeagueById = async (leagueId) => {
  const { data, error } = await supabase
    .from("leagues")
    .select(
      `
      *,
      profiles!leagues_created_by_fkey(username, full_name, email)
    `
    )
    .eq("id", leagueId)
    .single();

  if (error) throw error;
  return data;
};

const getAllLeagues = async (userId = null) => {
  let query = supabase
    .from("leagues")
    .select(
      `
      *,
      profiles!leagues_created_by_fkey(username, full_name, email)
    `
    )
    .eq("status", "active");

  if (userId) {
    // Get leagues where user is a participant or moderator
    const { data: userLeagues } = await supabase
      .from("user_leagues")
      .select("league_id")
      .eq("user_id", userId);

    const leagueIds = userLeagues?.map((ul) => ul.league_id) || [];
    if (leagueIds.length > 0) {
      query = query.in("id", leagueIds);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

const updateLeague = async (leagueId, updates) => {
  const { data, error } = await supabase
    .from("leagues")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leagueId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const deleteLeague = async (leagueId) => {
  const { error } = await supabase.from("leagues").delete().eq("id", leagueId);

  if (error) throw error;
  return true;
};

// League subscription functions
const createLeagueSubscription = async (subscriptionData) => {
  const { data, error } = await supabase
    .from("league_subscriptions")
    .insert({
      league_id: subscriptionData.leagueId,
      user_id: subscriptionData.userId,
      stripe_subscription_id: subscriptionData.stripeSubscriptionId,
      stripe_customer_id: subscriptionData.stripeCustomerId,
      tier: subscriptionData.tier,
      amount_paid: subscriptionData.amountPaid,
      currency: subscriptionData.currency || "usd",
      expires_at: subscriptionData.expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

const getLeagueSubscription = async (leagueId, userId) => {
  const { data, error } = await supabase
    .from("league_subscriptions")
    .select("*")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
};

const updateLeagueSubscription = async (subscriptionId, updates) => {
  const { data, error } = await supabase
    .from("league_subscriptions")
    .update(updates)
    .eq("id", subscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

module.exports = {
  createLeague,
  getLeagueById,
  getAllLeagues,
  updateLeague,
  deleteLeague,
  createLeagueSubscription,
  getLeagueSubscription,
  updateLeagueSubscription,
  createLeagueTable,
  createLeagueSubscriptionsTable,
};
