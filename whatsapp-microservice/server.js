// ── Polyfill ──────────────────────────────────────────────────────────────────
const crypto = require('crypto');
if (!global.crypto) global.crypto = crypto.webcrypto;

// ── Suppress Baileys "Bad MAC" noise ─────────────────────────────────────────
const _stderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, ...args) => {
    const s = typeof chunk === 'string' ? chunk : chunk.toString();
    if (s.includes('Bad MAC') || s.includes('Failed to decrypt') || s.includes('Session error')) return true;
    return _stderrWrite(chunk, ...args);
};
process.on('uncaughtException', (err) => {
    if (err?.message?.includes('Bad MAC')) return;
    // Baileys pre-key upload timeout — harmless, session will auto-reconnect
    if (err?.message?.includes('Timed Out') || err?.output?.statusCode === 408) return;
    console.error('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || String(reason);
    if (msg.includes('Timed Out') || msg.includes('Bad MAC')) return;
    console.error('Unhandled Rejection:', msg);
});

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const qrcode   = require('qrcode');
const pino     = require('pino');
const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
} = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

// ── Multi-session store ───────────────────────────────────────────────────────
// sessions: Map<userId, { sock, isConnected, currentQR, connectedPhone, qrDataUrl }>
const sessions = new Map();

// ── Reconnect attempt counters (survive session object recreation) ────────────
const reconnectAttempts = new Map();

const AUTH_SESSIONS_DIR = path.join(__dirname, 'auth_sessions');
if (!fs.existsSync(AUTH_SESSIONS_DIR)) fs.mkdirSync(AUTH_SESSIONS_DIR);

// ── Connect / Reconnect for a specific user ───────────────────────────────────
async function connectUser(userId) {
    const authDir = path.join(AUTH_SESSIONS_DIR, userId);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['AI CRM Brain', 'Chrome', '11.0.0'],
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,  // reduces on-connect load
        // Stability: generous timeouts to survive pre-key uploads
        connectTimeoutMs:       90_000,
        defaultQueryTimeoutMs:  90_000,
        keepAliveIntervalMs:    25_000,
        retryRequestDelayMs:    3_000,
        maxMsgRetryCount:       2,
        // Stub to avoid heavy message history fetch on connect
        getMessage: async () => undefined,
    });

    // Initialise session record
    const session = {
        sock,
        isConnected: false,
        currentQR:   null,   // raw QR string
        qrDataUrl:   null,   // base64 PNG for the frontend
        connectedPhone: null,
    };
    sessions.set(userId, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            session.currentQR = qr;
            session.isConnected = false;
            try {
                session.qrDataUrl = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
            } catch (_) {}
            console.log(`📱 [${userId}] QR ready — fetch via GET /qr?user_id=${userId}`);
        }

        if (connection === 'open') {
            session.isConnected  = true;
            session.currentQR    = null;
            session.qrDataUrl    = null;
            try {
                const me = sock.authState?.creds?.me;
                session.connectedPhone = me?.id ? me.id.split(':')[0] : null;
            } catch (_) {}
            console.log(`✅ [${userId}] WhatsApp connected! Phone: ${session.connectedPhone}`);

            // Only reset backoff if connection stays stable for 20s
            // Prevents the 'always attempt 1' loop on flapping connections
            setTimeout(() => {
                if (session.isConnected) {
                    reconnectAttempts.set(userId, 0);
                }
            }, 20_000);
        }

        if (connection === 'close') {
            session.isConnected    = false;
            session.connectedPhone = null;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            if (isLoggedOut) {
                console.log(`❌ [${userId}] Logged out deliberately. Session cleared.`);
                sessions.delete(userId);
                reconnectAttempts.delete(userId);
                fs.rmSync(path.join(AUTH_SESSIONS_DIR, userId), { recursive: true, force: true });
            } else {
                // Use persistent counter — exponential backoff: 15s, 30s, 45s … max 60s
                const attempt = (reconnectAttempts.get(userId) || 0) + 1;
                reconnectAttempts.set(userId, attempt);
                const delay = Math.min(15000 * attempt, 60000);
                console.log(`⚠️ [${userId}] Reconnecting in ${delay/1000}s (attempt ${attempt})...`);
                setTimeout(() => connectUser(userId).catch(console.error), delay);
            }
        }
    });
}

// ── Restore existing sessions on startup ──────────────────────────────────────
function restoreExistingSessions() {
    if (!fs.existsSync(AUTH_SESSIONS_DIR)) return;
    const userDirs = fs.readdirSync(AUTH_SESSIONS_DIR);
    for (const userId of userDirs) {
        const p = path.join(AUTH_SESSIONS_DIR, userId);
        if (fs.statSync(p).isDirectory()) {
            console.log(`♻️  Restoring session for user: ${userId}`);
            connectUser(userId).catch(console.error);
        }
    }
}
restoreExistingSessions();

// ═══════════════════════════════════════════════════════════════
// API Routes — all require ?user_id=<crm_user_uuid>
// ═══════════════════════════════════════════════════════════════

/**
 * GET /status?user_id=xxx
 * Returns connection state for this user.
 */
app.get('/status', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const session = sessions.get(user_id);
    if (!session) {
        // First time — start the connection so a QR is generated
        connectUser(user_id).catch(console.error);
        return res.json({ connected: false, has_qr: false, phone: null, starting: true });
    }

    res.json({
        connected: session.isConnected,
        has_qr:    session.qrDataUrl !== null,
        phone:     session.connectedPhone,
    });
});

/**
 * GET /qr?user_id=xxx
 * Returns the current QR code as a base64 PNG data URL for this user.
 */
app.get('/qr', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    let session = sessions.get(user_id);
    if (!session) {
        await connectUser(user_id);
        session = sessions.get(user_id);
    }

    if (session.isConnected) {
        return res.json({ status: 'connected', qr: null, phone: session.connectedPhone });
    }
    if (session.qrDataUrl) {
        return res.json({ status: 'pending', qr: session.qrDataUrl });
    }
    return res.json({ status: 'waiting', qr: null, message: 'QR generating, please wait...' });
});

/**
 * POST /disconnect?user_id=xxx
 * Log out this user, wipe their session, restart to generate fresh QR.
 */
app.post('/disconnect', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const session = sessions.get(user_id);
    if (session?.sock) {
        try { await session.sock.logout(); } catch (_) {}
        try { session.sock.end(undefined); } catch (_) {}
    }
    sessions.delete(user_id);

    const authDir = path.join(AUTH_SESSIONS_DIR, user_id);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log(`🗑️  [${user_id}] Session cleared.`);
    }

    // Restart — will generate fresh QR for this user
    setTimeout(() => connectUser(user_id).catch(console.error), 1500);

    res.json({ status: 'disconnected', message: 'Session cleared. New QR will appear shortly.' });
});

/**
 * POST /send-message?user_id=xxx
 * Send a WhatsApp message FROM this user's connected account.
 * Body: { phone: "201xxxxxxxxx", message: "..." }
 *
 * The phone to send TO is usually the user's own number (self-notification),
 * so they receive a private alert from themselves.
 */
app.post('/send-message', async (req, res) => {
    const { user_id } = req.query;
    const { phone, message } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    if (!phone || !message) return res.status(400).json({ error: 'phone and message are required' });

    const session = sessions.get(user_id);
    if (!session?.isConnected) {
        return res.status(503).json({ error: `User ${user_id} WhatsApp is not connected.` });
    }

    try {
        const jid = `${phone}@s.whatsapp.net`;
        const sentMsg = await session.sock.sendMessage(jid, { text: message });
        console.log(`✉️ [${user_id}] Message sent to ${phone}`);
        res.json({ success: true, messageId: sentMsg.key.id });
    } catch (err) {
        console.error(`❌ [${user_id}] Failed to send:`, err.message);
        res.status(500).json({ error: 'Failed to send message', details: err.message });
    }
});

/**
 * GET /sessions
 * Admin-only: list all active sessions (for debugging).
 */
app.get('/sessions', (req, res) => {
    const result = {};
    for (const [userId, s] of sessions.entries()) {
        result[userId] = {
            connected: s.isConnected,
            phone: s.connectedPhone,
            has_qr: s.qrDataUrl !== null,
        };
    }
    res.json(result);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Multi-Session Microservice on http://localhost:${PORT}`);
    console.log(`📡 Endpoints: GET /status?user_id= | GET /qr?user_id= | POST /send-message?user_id= | POST /disconnect?user_id= | GET /sessions`);
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use! Kill the existing process first:`);
        console.error(`   Run:  fuser -k ${PORT}/tcp  then  npm start`);
        process.exit(1);
    }
    throw err;
});
