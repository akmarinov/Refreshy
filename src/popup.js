const summary = document.querySelector("#summary");
const details = document.querySelector("#details");
const tabList = document.querySelector("#tabList");
const refreshButton = document.querySelector("#refreshTabs");
const optionsButton = document.querySelector("#openOptions");

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}

function renderTabs(tabs) {
  tabList.replaceChildren();

  if (!tabs.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No matching tabs are currently open.";
    tabList.append(empty);
    return;
  }

  for (const tab of tabs) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const url = document.createElement("span");

    title.textContent = tab.title || "Untitled tab";
    url.textContent = tab.url || "";
    item.append(title, url);

    if (tab.pinned) {
      const pinned = document.createElement("small");
      pinned.textContent = "Pinned";
      item.append(pinned);
    }

    tabList.append(item);
  }
}

async function refreshPreview() {
  const response = await sendMessage({ type: "preview-tabs" });

  if (!response?.ok) {
    summary.textContent = "Could not inspect tabs.";
    details.textContent = response?.error || "Chrome did not return a tab list.";
    return;
  }

  const count = response.tabs.length;
  summary.textContent = `${count} matching tab${count === 1 ? "" : "s"} found.`;
  details.textContent = "Click refresh after your sign-in has completed.";
  renderTabs(response.tabs);
}

async function refreshTabs() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing...";
  summary.textContent = "Refreshing matching tabs…";
  details.textContent = "";

  const response = await sendMessage({ type: "refresh-tabs" });

  if (!response?.ok) {
    summary.textContent = "Refresh failed.";
    details.textContent = response?.error || "Chrome returned an unknown error.";
  } else {
    const { result } = response;
    summary.textContent = `Refreshed ${result.refreshedCount} of ${result.matchedCount} matching tab${result.matchedCount === 1 ? "" : "s"}.`;
    details.textContent = result.failures.length
      ? `${result.failures.length} tab${result.failures.length === 1 ? "" : "s"} could not be refreshed.`
      : `Done at ${formatTime(result.refreshedAt)}.`;
  }

  refreshButton.disabled = false;
  refreshButton.textContent = "Refresh matching tabs";
  await refreshPreview();
}

optionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refreshButton.addEventListener("click", refreshTabs);
refreshPreview();
