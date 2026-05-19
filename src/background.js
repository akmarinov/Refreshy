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

const STORAGE_KEY = "sessionRefresherOptions";
const STATE_KEY = "sessionRefresherState";

async function getOptions() {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return {
    ...DEFAULT_OPTIONS,
    ...(stored[STORAGE_KEY] || {})
  };
}

async function setOptions(options) {
  await chrome.storage.sync.set({
    [STORAGE_KEY]: {
      ...DEFAULT_OPTIONS,
      ...options
    }
  });
}

async function getState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return {
    lastAutoRefreshAt: 0,
    lastManualRefreshAt: 0,
    lastResult: null,
    ...(stored[STATE_KEY] || {})
  };
}

async function setState(state) {
  await chrome.storage.local.set({
    [STATE_KEY]: {
      ...(await getState()),
      ...state
    }
  });
}

function normalizePattern(pattern) {
  const trimmed = String(pattern || "").trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.includes("://") ? trimmed : `*://${trimmed}`;
}

function patternToRegExp(pattern) {
  const normalized = normalizePattern(pattern);

  if (!normalized) {
    return null;
  }

  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const wildcarded = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${wildcarded}$`, "i");
}

function addDecodedUrlCandidates(value, candidates, depth = 0) {
  if (!value || depth > 4 || candidates.has(value)) {
    return;
  }

  candidates.add(value);

  try {
    const decoded = decodeURIComponent(value);

    if (decoded !== value) {
      addDecodedUrlCandidates(decoded, candidates, depth + 1);
    }
  } catch (_error) {
    // Ignore malformed escape sequences in browser-provided URLs.
  }
}

function buildUrlCandidates(url) {
  const candidates = new Set();
  addDecodedUrlCandidates(url, candidates);

  for (const candidate of [...candidates]) {
    try {
      const parsed = new URL(candidate);

      for (const value of parsed.searchParams.values()) {
        addDecodedUrlCandidates(value, candidates);
      }
    } catch (_error) {
      // Some decoded redirect fragments are not complete URLs; matching the
      // decoded string still covers host/path patterns embedded in them.
    }
  }

  return [...candidates];
}

function matchesAnyPattern(url, patterns) {
  if (!url) {
    return false;
  }

  const candidates = buildUrlCandidates(url);

  return patterns.some((pattern) => {
    const matcher = patternToRegExp(pattern);
    return matcher ? candidates.some((candidate) => matcher.test(candidate)) : false;
  });
}

function shouldRefreshTab(tab, options) {
  if (!tab.url || !matchesAnyPattern(tab.url, options.tabPatterns)) {
    return false;
  }

  if (!options.refreshPinnedTabs && tab.pinned) {
    return false;
  }

  if (!options.refreshDiscardedTabs && tab.discarded) {
    return false;
  }

  return true;
}

async function findRefreshableTabs(options = null) {
  const resolvedOptions = options || await getOptions();
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => shouldRefreshTab(tab, resolvedOptions));
}

async function refreshMatchingTabs({ source = "manual" } = {}) {
  const options = await getOptions();
  const tabs = await findRefreshableTabs(options);
  const refreshedAt = Date.now();
  const failures = [];

  await Promise.all(tabs.map(async (tab) => {
    try {
      await chrome.tabs.reload(tab.id, { bypassCache: false });
    } catch (error) {
      failures.push({
        tabId: tab.id,
        title: tab.title || tab.url || "Untitled tab",
        message: error?.message || String(error)
      });
    }
  }));

  const result = {
    source,
    refreshedAt,
    matchedCount: tabs.length,
    refreshedCount: tabs.length - failures.length,
    failures
  };

  await setState({
    lastResult: result,
    ...(source === "auto" ? { lastAutoRefreshAt: refreshedAt } : { lastManualRefreshAt: refreshedAt })
  });

  return result;
}

async function maybeAutoRefreshAfterLogin(url) {
  const options = await getOptions();

  if (!options.autoRefreshAfterLogin || !matchesAnyPattern(url, options.loginSuccessPatterns)) {
    return;
  }

  const state = await getState();
  const cooldownMs = Math.max(1, Number(options.cooldownMinutes || 1)) * 60 * 1000;

  if (Date.now() - state.lastAutoRefreshAt < cooldownMs) {
    return;
  }

  await refreshMatchingTabs({ source: "auto" });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    await setOptions(DEFAULT_OPTIONS);
  }
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;

  if (changeInfo.status === "complete" && url) {
    maybeAutoRefreshAfterLogin(url);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "get-options":
        sendResponse({ ok: true, options: await getOptions() });
        break;
      case "save-options":
        await setOptions(message.options || {});
        sendResponse({ ok: true, options: await getOptions() });
        break;
      case "preview-tabs": {
        const options = await getOptions();
        const tabs = await findRefreshableTabs(options);
        sendResponse({
          ok: true,
          tabs: tabs.map((tab) => ({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            pinned: tab.pinned,
            discarded: tab.discarded
          }))
        });
        break;
      }
      case "refresh-tabs":
        sendResponse({ ok: true, result: await refreshMatchingTabs({ source: "manual" }) });
        break;
      case "get-state":
        sendResponse({ ok: true, state: await getState() });
        break;
      default:
        sendResponse({ ok: false, error: "Unknown message type." });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });

  return true;
});
