const pages = document.querySelectorAll(".page");
const navItems = document.querySelectorAll(".nav-item");

const buyTab = document.getElementById("buyTab");
const sellTab = document.getElementById("sellTab");
const tradeBtn = document.getElementById("tradeBtn");

const tradeTitle = document.getElementById("tradeTitle");
const amountInput = document.getElementById("amountInput");
const paymentMethod = document.getElementById("paymentMethod");

const summaryAmount = document.getElementById("summaryAmount");
const summaryPayment = document.getElementById("summaryPayment");

const createOrderBtn =
  document.getElementById("createOrderBtn");

const ordersList =
  document.getElementById("ordersList");

const notifyBtn =
  document.getElementById("notifyBtn");

const backHome =
  document.getElementById("backHome");

let tradeMode = "buy";

let orders =
  JSON.parse(localStorage.getItem("payp2p_orders")) || [];


/* PAGE NAVIGATION */

function showPage(pageId) {

  pages.forEach(page => {
    page.classList.remove("active");
  });

  const page = document.getElementById(pageId);

  if (page) {
    page.classList.add("active");
  }

  navItems.forEach(item => {

    item.classList.remove("active");

    if (item.dataset.page === pageId) {
      item.classList.add("active");
    }

  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


navItems.forEach(item => {

  item.addEventListener("click", () => {

    showPage(item.dataset.page);

    if (item.dataset.page === "ordersPage") {
      renderOrders();
    }

  });

});


/* BUY / SELL */

buyTab.addEventListener("click", () => {

  tradeMode = "buy";

  buyTab.classList.add("active");
  sellTab.classList.remove("active");

  tradeBtn.textContent = "Buy USDT";

});


sellTab.addEventListener("click", () => {

  tradeMode = "sell";

  sellTab.classList.add("active");
  buyTab.classList.remove("active");

  tradeBtn.textContent = "Sell USDT";

});


/* OPEN TRADE */

tradeBtn.addEventListener("click", () => {

  tradeTitle.textContent =
    tradeMode === "buy"
      ? "Buy USDT"
      : "Sell USDT";

  showPage("tradePage");

});


/* OFFER BUTTONS */

document.querySelectorAll(".offer-btn").forEach(button => {

  button.addEventListener("click", () => {

    tradeMode = "buy";

    tradeTitle.textContent = "Buy USDT";

    showPage("tradePage");

  });

});


/* INPUT */

amountInput.addEventListener("input", () => {

  const amount =
    Number(amountInput.value) || 0;

  summaryAmount.textContent =
    amount.toFixed(2) + " USDT";

});


paymentMethod.addEventListener("change", () => {

  summaryPayment.textContent =
    paymentMethod.value || "Not selected";

});


/* CREATE ORDER */

createOrderBtn.addEventListener("click", () => {

  const amount =
    Number(amountInput.value);

  const payment =
    paymentMethod.value;

  if (!amount || amount <= 0) {

    alert("Please enter a valid USDT amount.");

    return;
  }


  if (!payment) {

    alert("Please select a payment method.");

    return;
  }


  const order = {

    id:
      "PP" +
      Date.now().toString().slice(-8),

    type: tradeMode,

    amount:
      amount.toFixed(2),

    payment:

      payment,

    status:
      "Pending",

    date:
      new Date().toLocaleString()

  };


  orders.unshift(order);


  localStorage.setItem(
    "payp2p_orders",
    JSON.stringify(orders)
  );


  alert(
    "Order created successfully.\n\n" +
    "Order ID: " +
    order.id
  );


  amountInput.value = "";

  paymentMethod.value = "";

  summaryAmount.textContent =
    "0 USDT";

  summaryPayment.textContent =
    "Not selected";


  showPage("ordersPage");

  renderOrders();

});


/* ORDERS */

function renderOrders() {

  if (!orders.length) {

    ordersList.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          📋
        </div>

        <strong>
          No orders yet
        </strong>

        <p>
          Your P2P transactions will appear here.
        </p>

      </div>
    `;

    return;
  }


  ordersList.innerHTML =
    orders.map(order => `

      <div class="offer-card">

        <div class="merchant">

          <div class="avatar">
            ${order.type === "buy" ? "B" : "S"}
          </div>

          <div>

            <strong>
              ${order.type === "buy"
                ? "Buy USDT"
                : "Sell USDT"}
            </strong>

            <div class="merchant-meta">

              <span>
                ${order.id}
              </span>

              <span class="verified">
                ${order.status}
              </span>

            </div>

          </div>

        </div>


        <div class="offer-info">

          <div>

            <span>
              Amount
            </span>

            <strong>
              ${order.amount} USDT
            </strong>

          </div>

          <div>

            <span>
              Payment
            </span>

            <strong>
              ${order.payment}
            </strong>

          </div>

        </div>

        <div class="merchant-meta">
          ${order.date}
        </div>

      </div>

    `).join("");

}


/* BACK */

backHome.addEventListener("click", () => {

  showPage("homePage");

});


/* NOTIFICATION */

notifyBtn.addEventListener("click", () => {

  alert("No new notifications.");

});


/* INITIAL */

renderOrders();
