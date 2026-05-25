/**
 * JWT activation links for HR employee pass distribution (30-day validity).
 */
const jwt = require('jsonwebtoken');

const ACTIVATION_TYP = 'activation';

function activationSecret() {
  return process.env.ACTIVATION_JWT_SECRET || process.env.JWT_SECRET || '';
}

function signActivationToken(memberId) {
  const secret = activationSecret();
  if (!secret) throw new Error('ACTIVATION_JWT_SECRET or JWT_SECRET required');
  return jwt.sign({ mid: memberId, typ: ACTIVATION_TYP }, secret, { expiresIn: '30d' });
}

function verifyActivationToken(token) {
  const secret = activationSecret();
  if (!secret) throw new Error('ACTIVATION_JWT_SECRET or JWT_SECRET required');
  const payload = jwt.verify(token, secret);
  if (payload.typ !== ACTIVATION_TYP || !payload.mid) {
    throw new Error('Token attivazione non valido');
  }
  return { memberId: payload.mid };
}

module.exports = {
  signActivationToken,
  verifyActivationToken,
  ACTIVATION_TYP
};
