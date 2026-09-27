const buyTab = document.getElementById("buyTab");
const sellTab = document.getElementById("sellTab");
const tradeBtn = document.getElementById("tradeBtn");
const notificationBtn = document.getElementById("notificationBtn");

buyTab.addEventListener("click", () => {
  buyTab.classList.add("active");
  sellTab.classList.remove("active");
  tradeBtn.textContent = "Buy USDT";
});

sellTab.addEventListener("click", () => {
  sellTab.classList.add("active");
  buyTab.classList.remove("active");
  tradeBtn.textContent = "Sell USDT";
});

tradeBtn.addEventListener("click", () => {
  alert("P2P trading will be available soon.");
});

notificationBtn.addEventListener("click", () => {
  alert("No new notifications.");
});
