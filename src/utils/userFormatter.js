/**
 * Maps PostgreSQL database user row to the StayPaw API contract representation.
 */
function formatUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email || '',
    phoneNumber: user.phone_number || '',
    role: user.role,
    isAdminApproved: Boolean(user.is_admin_approved),
    avatarUrl: user.avatar_url || null,
  };
}

module.exports = {
  formatUserResponse,
};
