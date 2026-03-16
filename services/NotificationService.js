const { supabase } = require('./supabaseClient');

let _expo = null;
let _Expo = null;

async function getExpo() {
  if (!_expo) {
    const mod = await import('expo-server-sdk');
    _Expo = mod.Expo;
    _expo = new _Expo({ useFcmV1: true });
  }
  return { expo: _expo, Expo: _Expo };
}

/**
 * Fetch active push tokens for all users in a league.
 */
async function getTokensForLeague(leagueId) {
  // Get all user IDs in this league
  const { data: members, error: membersError } = await supabase
    .from('user_leagues')
    .select('user_id')
    .eq('league_id', leagueId);

  if (membersError || !members?.length) {
    console.warn('[Notifications] No members found for league:', leagueId, membersError);
    return [];
  }

  const userIds = members.map((m) => m.user_id);

  const { data: tokens, error: tokensError } = await supabase
    .from('notification_tokens')
    .select('user_id, expo_push_token')
    .in('user_id', userIds)
    .eq('is_active', true);

  if (tokensError) {
    console.error('[Notifications] Error fetching tokens:', tokensError);
    return [];
  }

  return tokens || [];
}

/**
 * Send push notifications and record them in the notifications table.
 */
async function sendNotifications(messages, notificationRecords) {
  const { expo, Expo } = await getExpo();
  const validMessages = messages.filter((msg) => Expo.isExpoPushToken(msg.to));

  if (!validMessages.length) return;

  const chunks = expo.chunkPushNotifications(validMessages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      // Mark invalid tokens as inactive
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const token = chunk[i].to;
          await supabase
            .from('notification_tokens')
            .update({ is_active: false })
            .eq('expo_push_token', token);
        }
      }
    } catch (error) {
      console.error('[Notifications] Error sending chunk:', error);
    }
  }

  // Store notification records
  if (notificationRecords.length) {
    const { error } = await supabase.from('notifications').insert(notificationRecords);
    if (error) {
      console.error('[Notifications] Error inserting notification records:', error);
    }
  }
}

/**
 * Notify all league members that a new quinipolo has been created.
 */
async function notifyNewQuinipolo(quinipoloId, leagueId) {
  try {
    const { data: league } = await supabase
      .from('leagues')
      .select('league_name')
      .eq('id', leagueId)
      .single();

    const leagueName = league?.league_name || 'tu liga';
    const tokens = await getTokensForLeague(leagueId);
    if (!tokens.length) return;

    const title = '¡Nuevo Quinipolo!';
    const body = `Hay un nuevo quinipolo disponible en ${leagueName}`;
    const data = { type: 'quinipolo_created', quinipoloId, leagueId };

    const messages = tokens.map(({ expo_push_token }) => ({
      to: expo_push_token,
      sound: 'default',
      title,
      body,
      data,
    }));

    const notificationRecords = tokens.map(({ user_id }) => ({
      user_id,
      type: 'quinipolo_created',
      quinipolo_id: quinipoloId,
      league_id: leagueId,
      title,
      body,
      data,
    }));

    await sendNotifications(messages, notificationRecords);
    console.log(`[Notifications] Sent quinipolo_created to ${tokens.length} devices`);
  } catch (error) {
    console.error('[Notifications] Error in notifyNewQuinipolo:', error);
  }
}

/**
 * Notify users who answered a quinipolo that it has been corrected.
 */
async function notifyQuinolosCorrected(quinipoloId, leagueId) {
  try {
    const { data: league } = await supabase
      .from('leagues')
      .select('league_name')
      .eq('id', leagueId)
      .single();

    const leagueName = league?.league_name || 'tu liga';

    // Only notify users who actually answered this quinipolo
    const { data: answers } = await supabase
      .from('answers')
      .select('user_id')
      .eq('quinipolo_id', quinipoloId);

    if (!answers?.length) return;

    const userIds = answers.map((a) => a.user_id);

    const { data: tokens, error: tokensError } = await supabase
      .from('notification_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (tokensError || !tokens?.length) return;

    const title = '¡Quinipolo corregido!';
    const body = `Tu quinipolo de ${leagueName} ya ha sido corregido. ¡Comprueba tus puntos!`;
    const data = { type: 'quinipolo_corrected', quinipoloId, leagueId };

    const messages = tokens.map(({ expo_push_token }) => ({
      to: expo_push_token,
      sound: 'default',
      title,
      body,
      data,
    }));

    const notificationRecords = tokens.map(({ user_id }) => ({
      user_id,
      type: 'quinipolo_corrected',
      quinipolo_id: quinipoloId,
      league_id: leagueId,
      title,
      body,
      data,
    }));

    await sendNotifications(messages, notificationRecords);
    console.log(`[Notifications] Sent quinipolo_corrected to ${tokens.length} devices`);
  } catch (error) {
    console.error('[Notifications] Error in notifyQuinolosCorrected:', error);
  }
}

module.exports = { notifyNewQuinipolo, notifyQuinolosCorrected };
