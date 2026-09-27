export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // =========================
      // HEALTH
      // =========================
      if (url.pathname === "/api/health") {
        return json({
          success: true,
          app: "PayP2P",
          backend: "online",
          database: !!env.DB,
          telegram_auth: !!env.BOT_TOKEN,
        }, corsHeaders);
      }

      // =========================
      // TELEGRAM AUTH
      // =========================
      if (
        url.pathname === "/api/auth/telegram" &&
        request.method === "POST"
      ) {
        if (!env.BOT_TOKEN) {
          return json({
            success: false,
            error: "BOT_TOKEN is not configured",
          }, corsHeaders, 500);
        }

        const body = await request.json();
        const initData = body.initData;

        if (!initData) {
          return json({
            success: false,
            error: "Telegram initData is required",
          }, corsHeaders, 400);
        }

        const telegramData = await validateTelegramInitData(
          initData,
          env.BOT_TOKEN
        );

        if (!telegramData.valid) {
          return json({
            success: false,
            error: "Invalid Telegram authentication",
          }, corsHeaders, 401);
        }

        const user = telegramData.user;

        if (!user || !user.id) {
          return json({
            success: false,
            error: "Telegram user data not found",
          }, corsHeaders, 401);
        }

        // Create/update user
        await env.DB
          .prepare(`
            INSERT INTO users (
              telegram_id,
              username,
              first_name,
              last_name,
              photo_url
            )
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(telegram_id)
            DO UPDATE SET
              username = excluded.username,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              photo_url = excluded.photo_url,
              updated_at = CURRENT_TIMESTAMP
          `)
          .bind(
            String(user.id),
            user.username || null,
            user.first_name || null,
            user.last_name || null,
            user.photo_url || null
          )
          .run();

        const dbUser = await env.DB
          .prepare(`
            SELECT
              id,
              telegram_id,
              username,
              first_name,
              last_name,
              photo_url,
              status,
              created_at
            FROM users
            WHERE telegram_id = ?
          `)
          .bind(String(user.id))
          .first();

        if (!dbUser) {
          throw new Error("Unable to create user");
        }

        // Create wallet automatically
        await env.DB
          .prepare(`
            INSERT OR IGNORE INTO wallets (user_id)
            VALUES (?)
          `)
          .bind(dbUser.id)
          .run();

        const wallet = await env.DB
          .prepare(`
            SELECT
              balance,
              pending_balance,
              updated_at
            FROM wallets
            WHERE user_id = ?
          `)
          .bind(dbUser.id)
          .first();

        return json({
          success: true,
          authenticated: true,
          user: dbUser,
          wallet: wallet || {
            balance: 0,
            pending_balance: 0,
          },
        }, corsHeaders);
      }

      // =========================
      // DATABASE TEST
      // =========================
      if (url.pathname === "/api/db-test") {
        const result = await env.DB
          .prepare("SELECT COUNT(*) AS count FROM users")
          .first();

        return json({
          success: true,
          database: "connected",
          users: result?.count || 0,
        }, corsHeaders);
      }

      // =========================
      // GET OFFERS
      // =========================
      if (
        url.pathname === "/api/offers" &&
        request.method === "GET"
      ) {
        const result = await env.DB
          .prepare(`
            SELECT
              id,
              type,
              title,
              payment_method,
              price,
              min_amount,
              max_amount,
              available_amount,
              terms,
              status,
              created_at
            FROM offers
            WHERE status = 'active'
            ORDER BY id DESC
          `)
          .all();

        return json({
          success: true,
          offers: result.results || [],
        }, corsHeaders);
      }

      // =========================
      // GET DEPOSIT METHODS
      // =========================
      if (
        url.pathname === "/api/deposit-methods" &&
        request.method === "GET"
      ) {
        const result = await env.DB
          .prepare(`
            SELECT
              id,
              name,
              type,
              account_number,
              wallet_address,
              network,
              instructions
            FROM deposit_methods
            WHERE is_active = 1
            ORDER BY id DESC
          `)
          .all();

        return json({
          success: true,
          methods: result.results || [],
        }, corsHeaders);
      }

      // =========================
      // GET USER
      // =========================
      if (
        url.pathname === "/api/user" &&
        request.method === "GET"
      ) {
        const telegramId = url.searchParams.get("telegram_id");

        if (!telegramId) {
          return json({
            success: false,
            error: "telegram_id is required",
          }, corsHeaders, 400);
        }

        const user = await env.DB
          .prepare(`
            SELECT
              id,
              telegram_id,
              username,
              first_name,
              last_name,
              photo_url,
              status,
              created_at
            FROM users
            WHERE telegram_id = ?
          `)
          .bind(telegramId)
          .first();

        if (!user) {
          return json({
            success: false,
            error: "User not found",
          }, corsHeaders, 404);
        }

        return json({
          success: true,
          user,
        }, corsHeaders);
      }

      // =========================
      // CREATE / UPDATE USER
      // =========================
      if (
        url.pathname === "/api/user" &&
        request.method === "POST"
      ) {
        const body = await request.json();

        if (!body.telegram_id) {
          return json({
            success: false,
            error: "telegram_id is required",
          }, corsHeaders, 400);
        }

        await env.DB
          .prepare(`
            INSERT INTO users (
              telegram_id,
              username,
              first_name,
              last_name,
              photo_url
            )
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(telegram_id)
            DO UPDATE SET
              username = excluded.username,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              photo_url = excluded.photo_url,
              updated_at = CURRENT_TIMESTAMP
          `)
          .bind(
            String(body.telegram_id),
            body.username || null,
            body.first_name || null,
            body.last_name || null,
            body.photo_url || null
          )
          .run();

        const user = await env.DB
          .prepare(`
            SELECT *
            FROM users
            WHERE telegram_id = ?
          `)
          .bind(String(body.telegram_id))
          .first();

        await env.DB
          .prepare(`
            INSERT OR IGNORE INTO wallets (user_id)
            VALUES (?)
          `)
          .bind(user.id)
          .run();

        return json({
          success: true,
          user,
        }, corsHeaders);
      }

      // =========================
      // GET WALLET
      // =========================
      if (
        url.pathname === "/api/wallet" &&
        request.method === "GET"
      ) {
        const telegramId = url.searchParams.get("telegram_id");

        if (!telegramId) {
          return json({
            success: false,
            error: "telegram_id is required",
          }, corsHeaders, 400);
        }

        const wallet = await env.DB
          .prepare(`
            SELECT
              w.user_id,
              w.balance,
              w.pending_balance,
              w.updated_at
            FROM wallets w
            INNER JOIN users u ON u.id = w.user_id
            WHERE u.telegram_id = ?
          `)
          .bind(telegramId)
          .first();

        if (!wallet) {
          return json({
            success: false,
            error: "Wallet not found",
          }, corsHeaders, 404);
        }

        return json({
          success: true,
          wallet,
        }, corsHeaders);
      }

      // =========================
      // GET ORDERS
      // =========================
      if (
        url.pathname === "/api/orders" &&
        request.method === "GET"
      ) {
        const telegramId = url.searchParams.get("telegram_id");

        if (!telegramId) {
          return json({
            success: false,
            error: "telegram_id is required",
          }, corsHeaders, 400);
        }

        const result = await env.DB
          .prepare(`
            SELECT
              o.id,
              o.type,
              o.amount,
              o.price,
              o.total,
              o.payment_method,
              o.status,
              o.created_at,
              o.updated_at
            FROM orders o
            INNER JOIN users u ON u.id = o.user_id
            WHERE u.telegram_id = ?
            ORDER BY o.id DESC
          `)
          .bind(telegramId)
          .all();

        return json({
          success: true,
          orders: result.results || [],
        }, corsHeaders);
      }

      // =========================
      // CREATE ORDER
      // =========================
      if (
        url.pathname === "/api/orders" &&
        request.method === "POST"
      ) {
        const body = await request.json();

        if (!body.telegram_id) {
          return json({
            success: false,
            error: "telegram_id is required",
          }, corsHeaders, 400);
        }

        if (!body.type || !body.amount || !body.price) {
          return json({
            success: false,
            error: "type, amount and price are required",
          }, corsHeaders, 400);
        }

        const user = await env.DB
          .prepare(`
            SELECT id
            FROM users
            WHERE telegram_id = ?
          `)
          .bind(String(body.telegram_id))
          .first();

        if (!user) {
          return json({
            success: false,
            error: "User not found",
          }, corsHeaders, 404);
        }

        const amount = Number(body.amount);
        const price = Number(body.price);
        const total = amount * price;

        const result = await env.DB
          .prepare(`
            INSERT INTO orders (
              user_id,
              offer_id,
              type,
              amount,
              price,
              total,
              payment_method,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
          `)
          .bind(
            user.id,
            body.offer_id || null,
            body.type,
            amount,
            price,
            total,
            body.payment_method || null
          )
          .run();

        return json({
          success: true,
          order_id: result.meta.last_row_id,
          status: "pending",
        }, corsHeaders);
      }

      // =========================
      // GET NOTIFICATIONS
      // =========================
      if (
        url.pathname === "/api/notifications" &&
        request.method === "GET"
      ) {
        const telegramId = url.searchParams.get("telegram_id");

        if (!telegramId) {
          return json({
            success: false,
            error: "telegram_id is required",
          }, corsHeaders, 400);
        }

        const result = await env.DB
          .prepare(`
            SELECT
              n.id,
              n.title,
              n.message,
              n.is_read,
              n.created_at
            FROM notifications n
            INNER JOIN users u ON u.id = n.user_id
            WHERE u.telegram_id = ?
            ORDER BY n.id DESC
            LIMIT 100
          `)
          .bind(telegramId)
          .all();

        return json({
          success: true,
          notifications: result.results || [],
        }, corsHeaders);
      }

      // =========================
      // API NOT FOUND
      // =========================
      if (url.pathname.startsWith("/api/")) {
        return json({
          success: false,
          error: "API endpoint not found",
        }, corsHeaders, 404);
      }

      // =========================
      // FRONTEND
      // =========================
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("PayP2P is running", {
        headers: corsHeaders,
      });

    } catch (error) {
      return json({
        success: false,
        error: "Internal server error",
        message: error.message,
      }, corsHeaders, 500);
    }
  },
};


// ============================================
// TELEGRAM MINI APP INITDATA VALIDATION
// ============================================

async function validateTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);

    const receivedHash = params.get("hash");

    if (!receivedHash) {
      return {
        valid: false,
        reason: "Missing hash",
      };
    }

    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Secret key:
    // HMAC-SHA256(bot_token, "WebAppData")
    const secretKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("WebAppData"),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    const secretKeyBytes = await crypto.subtle.sign(
      "HMAC",
      secretKey,
      new TextEncoder().encode(botToken)
    );

    // Data hash
    const dataKey = await crypto.subtle.importKey(
      "raw",
      secretKeyBytes,
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    const calculatedHashBytes = await crypto.subtle.sign(
      "HMAC",
      dataKey,
      new TextEncoder().encode(dataCheckString)
    );

    const calculatedHash = [...new Uint8Array(calculatedHashBytes)]
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");

    if (!timingSafeEqual(calculatedHash, receivedHash)) {
      return {
        valid: false,
        reason: "Invalid hash",
      };
    }

    // Check auth_date
    const authDate = Number(params.get("auth_date"));

    if (!authDate) {
      return {
        valid: false,
        reason: "Missing auth_date",
      };
    }

    const now = Math.floor(Date.now() / 1000);

    // Reject data older than 24 hours
    if (now - authDate > 86400) {
      return {
        valid: false,
        reason: "Telegram authentication data expired",
      };
    }

    const userString = params.get("user");

    if (!userString) {
      return {
        valid: false,
        reason: "Missing Telegram user",
      };
    }

    const user = JSON.parse(userString);

    return {
      valid: true,
      user,
    };

  } catch (error) {
    return {
      valid: false,
      reason: error.message,
    };
  }
}


// ============================================
// CONSTANT-TIME STRING COMPARISON
// ============================================

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}


// ============================================
// JSON RESPONSE
// ============================================

function json(data, corsHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
