// User.js - Supabase-based user operations for 'profiles' table
const supabase = require('../services/supabaseClient');

// Get user by id
async function getUserById(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// Get user by email
async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  if (error) throw error;
  return data;
}

// Create user
async function createUser(user) {
  const { data, error } = await supabase
    .from('profiles')
    .insert([user])
    .single();
  if (error) throw error;
  return data;
}

// Update user
async function updateUser(id, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// Delete user
async function deleteUser(id) {
  const { data, error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// Get user by username
async function getUserByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();
  if (error) throw error;
  return data;
}

// Update user by username
async function updateUserByUsername(username, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('username', username)
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  getUserByUsername,
  updateUserByUsername,
};
