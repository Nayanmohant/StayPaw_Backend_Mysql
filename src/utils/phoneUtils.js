/**
 * Phone number validation and normalization utilities following E.164 standards.
 */

// E.164 regex: + followed by 8 to 15 digits (country code + national number)
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return null;
  }

  // Remove whitespace, dashes, parentheses
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '').trim();

  // If user provided without leading '+', check if it's numeric and prepend '+'
  if (!cleaned.startsWith('+') && /^[1-9]\d{7,14}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }

  if (!E164_REGEX.test(cleaned)) {
    return null;
  }

  return cleaned;
}

module.exports = {
  normalizePhoneNumber,
};
