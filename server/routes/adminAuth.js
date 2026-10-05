// Admin authentication by wallet signature.
//
// The admin page is gated on ONE address. A client-side check of
// `address === ADMIN` would be worthless — anyone can curl the API — so the
// caller must prove control of the wallet: the server issues a nonce, the
// wallet signs it, and the server verifies the signature before handing back
// a short-lived session token.
//
// Nonces and sessions live in the database (admin_nonces, admin_sessions),
// not in memory: on Supabase Edge Functions the request that verifies a nonce
// may run on a different isolate from the one that issued it.

import { randomBytes, createHash } from 'node:crypto';
import { publicClient } from '../chain/client.js';

// Only these addresses may open the admin surface.
export const ADMIN_WALLETS = (
  process.env.ADMIN_WALLETS || '0xe1a0F916e859624D4edbadA23E4382D327EAf626'
)
  .split(',')
  .map(a => a.trim().toLowerCase())
  .filter(Boolean);

// Optional break-glass for when the wallet is unavailable. Unset by default:
// while it is unset, the wallet signature is the ONLY way in.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

const NONCE_TTL_MS   = 5 * 60_000;
const SESSION_TTL_MS = 2 * 60 * 60_000;

const nowIso   = () => new Date().toISOString();
const inMs     = (ms) => new Date(Date.now() + ms).toISOString();
const hashOf   = (token) => createHash('sha256').update(token).digest('hex');

// Expired rows are only ever ignored, never trusted; clearing them is
// housekeeping, so a failure here is not worth failing the request over.
async function sweep(supabase, table) {
  await supabase.from(table).delete().lt('expires_at', nowIso());
}

export function isAdminWallet(address) {
  return Boolean(address) && ADMIN_WALLETS.includes(address.toLowerCase());
}

export async function issueNonce(supabase) {
  await sweep(supabase, 'admin_nonces');
  const nonce = randomBytes(16).toString('hex');
  const { error } = await supabase
    .from('admin_nonces').insert({ nonce, expires_at: inMs(NONCE_TTL_MS) });
  if (error) throw new Error(`could not store nonce: ${error.message}`);
  return {
    nonce,
    // Signed verbatim. Human-readable so the wallet prompt says what it is for.
    message:
      `Nukko admin sign-in\n\n` +
      `This signature proves you control this wallet.\n` +
      `It costs nothing and sends no transaction.\n\n` +
      `Nonce: ${nonce}`,
    expiresIn: NONCE_TTL_MS / 1000,
  };
}

/**
 * Verify a signed nonce and open a session.
 * @returns {{ ok: true, token: string, expiresIn: number } | { ok: false, error: string }}
 */
export async function verifySignature(supabase, { address, nonce, signature, message }) {
  if (!address || !nonce || !signature) return { ok: false, error: 'address, nonce and signature are required' };

  if (!isAdminWallet(address)) {
    // Same message either way — never reveal which addresses are admins.
    return { ok: false, error: 'This wallet does not have admin access' };
  }

  const { data: live } = await supabase
    .from('admin_nonces').select('nonce').eq('nonce', nonce).gt('expires_at', nowIso()).maybeSingle();
  if (!live) return { ok: false, error: 'Nonce expired or already used — try again' };

  // Rebuild the expected message rather than trusting the client's copy, so a
  // caller cannot get a signature over text of their own choosing accepted.
  const expected = `Nukko admin sign-in\n\n` +
    `This signature proves you control this wallet.\n` +
    `It costs nothing and sends no transaction.\n\n` +
    `Nonce: ${nonce}`;

  if (message && message !== expected) return { ok: false, error: 'Message mismatch' };

  let valid = false;
  try {
    // Goes through publicClient so smart-contract wallets (ERC-1271) verify
    // as well as plain EOAs — MiniPay accounts are not always EOAs.
    valid = await publicClient.verifyMessage({ address, message: expected, signature });
  } catch (err) {
    return { ok: false, error: `Signature check failed: ${err.shortMessage || err.message}` };
  }

  if (!valid) return { ok: false, error: 'Invalid signature' };

  // Single use: consume the nonce so a captured signature cannot be replayed.
  // The delete is the claim — if two requests race with the same signature,
  // only the one whose delete removed the row gets a session.
  const { data: claimed } = await supabase
    .from('admin_nonces').delete().eq('nonce', nonce).select('nonce');
  if (!claimed?.length) return { ok: false, error: 'Nonce expired or already used — try again' };

  await sweep(supabase, 'admin_sessions');
  const token = randomBytes(32).toString('hex');
  const { error } = await supabase.from('admin_sessions').insert({
    token_hash: hashOf(token),
    address:    address.toLowerCase(),
    expires_at: inMs(SESSION_TTL_MS),
  });
  if (error) return { ok: false, error: `Could not open a session: ${error.message}` };

  return { ok: true, token, expiresIn: SESSION_TTL_MS / 1000, address };
}

/** Express middleware — accepts a signature session, or the break-glass token if configured. */
export function requireAdmin(supabase) {
  return async (req, res, next) => {
    const header = req.get('authorization') || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    if (ADMIN_TOKEN && token === ADMIN_TOKEN) {
      req.adminAddress = 'break-glass-token';
      return next();
    }

    const { data: session, error } = await supabase
      .from('admin_sessions')
      .select('address')
      .eq('token_hash', hashOf(token))
      .gt('expires_at', nowIso())
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (session) {
      req.adminAddress = session.address;
      return next();
    }

    return res.status(401).json({ error: 'Session expired — sign in again' });
  };
}
