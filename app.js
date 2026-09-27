const tg = window.Telegram?.WebApp;

let currentUser = null;
let currentWallet = null;

// =========================
// APP START
// =========================

document.addEventListener("DOMContentLoaded", async () => {
  if (tg) {
    tg.ready();
    tg.expand();
  }

  await authenticateTelegram();
  await loadOffers();
  await loadOrders();
});


// =========================
// TELEGRAM AUTH
// =========================

async function authenticateTelegram() {
  const guestName = document.querySelector(".profile-name");

  // Telegram-এর বাইরে browser-এ খুললে
  if (!tg || !tg.initData) {
    if (guestName) {
      guestName.textContent = "Open in Telegram";
    }

    return;
  }

  try {
    const response = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        initData: tg.initData,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      console.error("Telegram authentication failed:", data.error);

      if (guestName) {
        guestName.textContent = "Authentication failed";
      }

      return;
    }

    currentUser = data.user;
    currentWallet = data.wallet;

    updateUserUI();
    updateWalletUI();

  } catch (error) {
    console.error("Authentication error:", error);

    if (guestName) {
      guestName.textContent = "Connection error";
    }
  }
}


// =========================
// USER UI
// =========================

function updateUserUI() {
  if (!currentUser) return;

  const displayName =
    currentUser.first_name ||
    currentUser.username ||
    "Telegram User";

  const username =
    currentUser.username
      ? "@" + currentUser.username
      : "Telegram account";

  document.querySelectorAll(".profile-name").forEach(el => {
    el.textContent = displayName;
  });

  document.querySelectorAll(".profile-username").forEach(el => {
    el.textContent = username;
  });

  document.querySelectorAll(".profile-avatar").forEach(el => {
    if (currentUser.photo_url) {
      el.src = currentUser.photo_url;
    }
  });
}


// =========================
// WALLET UI
// =========================

function updateWalletUI() {
  if (!currentWallet) return;

  const balance =
    Number(currentWallet.balance || 0).toFixed(2);

  document.querySelectorAll(".wallet-balance").forEach(el => {
    el.textContent = balance;
  });

  document.querySelectorAll(".available-balance").forEach(el => {
    el.textContent = balance;
  });
}


// =========================
// LOAD OFFERS
// =========================

async function loadOffers() {
  try {
    const response = await fetch("/api/offers");

    const data = await response.json();

    if (!data.success) {
      console.error("Offers error:", data.error);
      return;
    }

    renderOffers(data.offers || []);

  } catch (error) {
    console.error("Failed to load offers:", error);
  }
}


// =========================
// RENDER OFFERS
// =========================

function renderOffers(offers) {
  const container =
    document.querySelector("#offers-list");

  if (!container) return;

  if (!offers.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⇄</div>
        <h3>No other offers yet</h3>
        <p>New P2P offers will appear here.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = offers.map(offer => `
    <div class="offer-card">

      <div class="offer-header">
        <strong>${escapeHtml(offer.title)}</strong>
        <span class="verified">✓ Active</span>
      </div>

      <div class="offer-price">
        Price ৳ ${Number(offer.price).toFixed(2)}
      </div>

      <div class="offer-available">
        Available ${Number(
          offer.available_amount || 0
        ).toFixed(2)} USDT
      </div>

      <div class="offer-payment">
        ${escapeHtml(
          offer.payment_method || "Payment method"
        )}
      </div>

      <button
        class="offer-buy-button"
        onclick="openOffer(${offer.id})"
      >
        Buy USDT
      </button>

    </div>
  `).join("");
}


// =========================
// OPEN OFFER
// =========================

async function openOffer(offerId) {
  try {
    const response = await fetch("/api/offers");

    const data = await response.json();

    const offer = (data.offers || [])
      .find(item => Number(item.id) === Number(offerId));

    if (!offer) {
      alert("Offer not found");
      return;
    }

    const amountInput =
      document.querySelector("#usdt-amount");

    const priceElement =
      document.querySelector("#trade-price");

    const paymentElement =
      document.querySelector("#trade-payment");

    if (priceElement) {
      priceElement.textContent =
        `৳ ${Number(offer.price).toFixed(2)} / USDT`;
    }

    if (paymentElement) {
      paymentElement.textContent =
        offer.payment_method || "Not selected";
    }

    if (amountInput) {
      amountInput.value = "";
    }

    window.selectedOffer = offer;

    showTradePage();

  } catch (error) {
    console.error(error);
  }
}


// =========================
// CREATE ORDER
// =========================

async function createOrder() {
  if (!currentUser) {
    alert("Please open PayP2P from Telegram.");
    return;
  }

  if (!window.selectedOffer) {
    alert("Please select an offer first.");
    return;
  }

  const amountInput =
    document.querySelector("#usdt-amount");

  const amount =
    Number(amountInput?.value || 0);

  if (!amount || amount <= 0) {
    alert("Enter a valid USDT amount.");
    return;
  }

  const offer = window.selectedOffer;

  if (
    offer.min_amount &&
    amount < Number(offer.min_amount)
  ) {
    alert(
      `Minimum amount is ${offer.min_amount} USDT`
    );
    return;
  }

  if (
    offer.max_amount &&
    amount > Number(offer.max_amount)
  ) {
    alert(
      `Maximum amount is ${offer.max_amount} USDT`
    );
    return;
  }

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telegram_id: currentUser.telegram_id,
        offer_id: offer.id,
        type: "buy",
        amount,
        price: Number(offer.price),
        payment_method: offer.payment_method,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.error || "Order creation failed.");
      return;
    }

    alert(
      `Order #${data.order_id} created successfully.`
    );

    await loadOrders();

  } catch (error) {
    console.error(error);
    alert("Connection error.");
  }
}


// =========================
// LOAD ORDERS
// =========================

async function loadOrders() {
  if (!currentUser) return;

  try {
    const response = await fetch(
      `/api/orders?telegram_id=${encodeURIComponent(
        currentUser.telegram_id
      )}`
    );

    const data = await response.json();

    if (!data.success) {
      console.error(data.error);
      return;
    }

    renderOrders(data.orders || []);

  } catch (error) {
    console.error("Orders error:", error);
  }
}


// =========================
// RENDER ORDERS
// =========================

function renderOrders(orders) {
  const container =
    document.querySelector("#orders-list");

  if (!container) return;

  if (!orders.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No orders yet</h3>
        <p>Your orders will appear here.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = orders.map(order => `
    <div class="order-card">

      <div>
        <strong>
          ${escapeHtml(
            String(order.type || "").toUpperCase()
          )}
          USDT
        </strong>

        <div>
          ${Number(order.amount).toFixed(2)} USDT
        </div>
      </div>

      <div>
        <strong>
          ৳ ${Number(order.total).toFixed(2)}
        </strong>

        <div class="order-status">
          ${escapeHtml(order.status)}
        </div>
      </div>

    </div>
  `).join("");
}


// =========================
// TRADE PAGE
// =========================

function showTradePage() {
  const tradePage =
    document.querySelector("#trade-page");

  if (tradePage) {
    tradePage.classList.add("active");
  }
}


// =========================
// ESCAPE HTML
// =========================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =========================
// TELEGRAM MAIN BUTTON
// =========================

if (tg) {
  tg.MainButton.setText("PayP2P");
}


// =========================
// GLOBAL FUNCTIONS
// =========================

window.authenticateTelegram = authenticateTelegram;
window.loadOffers = loadOffers;
window.loadOrders = loadOrders;
window.openOffer = openOffer;
window.createOrder = createOrder;
