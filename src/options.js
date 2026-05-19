const DEFAULT_OPTIONS = {
  tabPatterns: [
    "*.atlassian.net/*",
    "jira.*/*",
    "confluence.*/*",
    "bitbucket.*/*"
  ],
  loginSuccessPatterns: [],
  autoRefreshAfterLogin: false,
  refreshPinnedTabs: true,
  refreshDiscardedTabs: false,
  cooldownMinutes: 5
};

const form = document.querySelector("#optionsForm");
const tabPatterns = document.querySelector("#tabPatterns");
const loginSuccessPatterns = document.querySelector("#loginSuccessPatterns");
const autoRefreshAfterLogin = document.querySelector("#autoRefreshAfterLogin");
const refreshPinnedTabs = document.querySelector("#refreshPinnedTabs");
const refreshDiscardedTabs = document.querySelector("#refreshDiscardedTabs");
const cooldownMinutes = document.querySelector("#cooldownMinutes");
const saveStatus = document.querySelector("#saveStatus");
const resetOptions = document.querySelector("#resetOptions");

function linesToArray(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(values) {
  return values.join("\n");
}

function renderOptions(options) {
  tabPatterns.value = arrayToLines(options.tabPatterns || []);
  loginSuccessPatterns.value = arrayToLines(options.loginSuccessPatterns || []);
  autoRefreshAfterLogin.checked = Boolean(options.autoRefreshAfterLogin);
  refreshPinnedTabs.checked = Boolean(options.refreshPinnedTabs);
  refreshDiscardedTabs.checked = Boolean(options.refreshDiscardedTabs);
  cooldownMinutes.value = Number(options.cooldownMinutes || 5);
}

function readOptions() {
  return {
    tabPatterns: linesToArray(tabPatterns.value),
    loginSuccessPatterns: linesToArray(loginSuccessPatterns.value),
    autoRefreshAfterLogin: autoRefreshAfterLogin.checked,
    refreshPinnedTabs: refreshPinnedTabs.checked,
    refreshDiscardedTabs: refreshDiscardedTabs.checked,
    cooldownMinutes: Number(cooldownMinutes.value || 5)
  };
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function loadOptions() {
  const response = await sendMessage({ type: "get-options" });

  if (response?.ok) {
    renderOptions(response.options);
  } else {
    saveStatus.textContent = response?.error || "Could not load options.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveStatus.textContent = "Saving…";

  const response = await sendMessage({
    type: "save-options",
    options: readOptions()
  });

  if (response?.ok) {
    renderOptions(response.options);
    saveStatus.textContent = "Saved.";
  } else {
    saveStatus.textContent = response?.error || "Could not save options.";
  }
});

resetOptions.addEventListener("click", () => {
  renderOptions(DEFAULT_OPTIONS);
  saveStatus.textContent = "Defaults restored. Save to apply them.";
});

loadOptions();
