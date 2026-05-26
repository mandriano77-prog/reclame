'use strict';

function isConfirmTypingMatch(input, expected) {
  return String(input || '').trim() === String(expected || '').trim();
}

module.exports = { isConfirmTypingMatch };
