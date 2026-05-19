# Refreshy

A small Manifest V3 Chrome extension for the annoying sign-in loop:

1. Sign back in through your usual browser flow.
2. Click the extension icon.
3. Reload every matching work tab in one shot.

It also has an optional automatic mode that reloads matching tabs after a configured sign-in page finishes loading.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `Refreshy` folder.

## Install from this repository

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the cloned `Refreshy` folder.

## Configure

Open the extension's options page and set your private wildcard patterns locally. Add every work surface you want refreshed, such as issue tracking, docs, code hosting, and review tabs.

Patterns may omit the protocol. The extension treats a host/path pattern as matching both browser protocols. Refreshy also checks decoded redirect values from long sign-in URLs, so a private pattern can still match when the destination is nested inside query parameters.

## Use

The default, safest workflow is manual:

1. Complete the sign-in flow.
2. Open the extension popup.
3. Confirm the matched tab list looks right.
4. Click **Refresh matching tabs**.

For automatic refreshes, enable **Refresh matching tabs after a configured login page finishes loading** in the options page and add the sign-in patterns that indicate your session has been renewed.

## Permissions

- `tabs`: inspect open tab URLs and reload matching tabs.
- `storage`: save patterns and extension state.

The extension does not read page content, cookies, or site data.
