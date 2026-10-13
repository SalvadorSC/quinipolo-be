const { supabase } = require('./supabaseClient');
const { fetchAllEq, selectInBatches } = require('./batchedQuery');

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
  let members;
  try {
    members = await fetchAllEq(supabase, {
      table: 'user_leagues',
      columns: 'user_id',
      column: 'league_id',
      value: leagueId,
    });
  } catch (error) {
    console.warn('[Notifications] No members found for league:', leagueId, error);
    return [];
  }

  if (!members.length) return [];

  try {
    return await selectInBatches(supabase, {
      table: 'notification_tokens',
      columns: 'user_id, expo_push_token',
      column: 'user_id',
      ids: members.map((member) => member.user_id),
      refine: (query) => query.eq('is_active', true),
    });
  } catch (error) {
    console.error('[Notifications] Error fetching tokens:', error);
    return [];
  }
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
    let answers;
    try {
      answers = await fetchAllEq(supabase, {
        table: 'answers',
        columns: 'user_id',
        column: 'quinipolo_id',
        value: quinipoloId,
      });
    } catch (error) {
      console.error('[Notifications] Error fetching answers:', error);
      return;
    }

    if (!answers.length) return;

    let tokens;
    try {
      tokens = await selectInBatches(supabase, {
        table: 'notification_tokens',
        columns: 'user_id, expo_push_token',
        column: 'user_id',
        ids: answers.map((answer) => answer.user_id),
        refine: (query) => query.eq('is_active', true),
      });
    } catch (error) {
      console.error('[Notifications] Error fetching tokens:', error);
      return;
    }

    if (!tokens.length) return;

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
