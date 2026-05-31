# node-red-contrib-alexa-remote2-applestrudel

[![npm](https://img.shields.io/npm/v/node-red-contrib-alexa-remote2-applestrudel.svg)](https://www.npmjs.com/package/node-red-contrib-alexa-remote2-applestrudel) [![downloads](https://img.shields.io/npm/dt/node-red-contrib-alexa-remote2-applestrudel.svg)](https://www.npmjs.com/package/node-red-contrib-alexa-remote2-applestrudel)

A collection of Node-RED nodes for interacting with the Alexa API. Control and query your Echo devices, emulate routine behaviour, manage smart home devices, work with lists, and much more — all from your Node-RED flows.

> Forked from [cakebake/node-red-contrib-alexa-remote-cakebaked](https://github.com/cakebake/node-red-contrib-alexa-remote-cakebaked), originally forked from [586837r/node-red-contrib-alexa-remote2](https://github.com/586837r/node-red-contrib-alexa-remote2).

- [Changelog](CHANGELOG.md)
- [Examples](examples.md)
- [Issues](https://github.com/bbindreiter/node-red-contrib-alexa-remote2-applestrudel/issues)

---

## Requirements

- **Node.js** >= 16.0.0
- **Node-RED** (any recent version)

---

## Available Nodes

| Node | Description |
|------|-------------|
| **Alexa Account** | Configuration node — manages authentication and connection to Alexa |
| **Alexa Routine** | Trigger built-in actions: speak, play music, set volume, run sequences, execute routines, and more |
| **Alexa Echo** | Control and query Echo devices (volume, play/pause, next/previous, player info, device info, etc.) |
| **Alexa Event** | Listen to real-time push events from your Alexa devices (media state changes, notifications, etc.) |
| **Alexa Smarthome** | Query and control smart home devices connected to Alexa |
| **Alexa List** | Read and manage your Alexa Shopping and To-do lists |
| **Alexa Other** | Miscellaneous queries: music providers, notifications, activity, etc. |
| **Alexa Init** | Manually trigger or observe the account initialisation lifecycle |

---

## Setup

### 1. Authentication (OAuth)

Authentication uses the **Proxy / OAuth** method. When you first deploy, the account node will display a URL in the node status. Open that URL in your browser, log in to Amazon, and the node will automatically capture your credentials and transition to **ready**.

1. Drag any Alexa node (e.g. **Alexa Routine**) into your flow.
2. Click the edit button next to the *Account* field to create a new account.
3. Select your **Service Host**, **Page**, and **Language** for your region:

   |     | Service Host          | Page            | Language |
   |-----|-----------------------|-----------------|----------|
   | USA | pitangui.amazon.com   | amazon.com      | en-US    |
   | UK  | alexa.amazon.co.uk    | amazon.co.uk    | en-GB    |
   | GER | layla.amazon.de       | amazon.de       | de-DE    |
   | FR  | layla.amazon.de       | amazon.fr       | fr-FR    |
   | ITA | alexa.amazon.it       | amazon.it       | it-IT    |
   | AUS | alexa.amazon.com.au   | amazon.com.au   | en-AU    |
   | ES  | alexa.amazon.es       | amazon.es       | es-ES    |
   | BR  | alexa.amazon.com.br   | amazon.com.br   | pt-BR    |

4. Set **This IP** to the IP address of your Node-RED server (used for the OAuth proxy callback).
5. Optionally set a **File Path** to persist the authentication data — this allows automatic re-authentication after restarts.
6. Click *Add*, then **Deploy**.
7. Check the account node status for a URL, open it in your browser, and log in.
8. Wait until the node status shows **ready**.

### 2. Quick Test

1. Add an **Alexa Routine** node, set the action to *Speak*, and type "Hello World!" in the text field.
2. Select a device from the *Devices* dropdown (populated after the account is ready).
3. Wire an **Inject** node to the Alexa Routine node.
4. Click the inject button — your Alexa device should say "Hello World!".

---

## Authentication Notes

- **Proxy (OAuth)** — Recommended. Opens a login URL in your browser; authentication is handled automatically. Credentials can be persisted to a file for restarts.
- **Cookie** — Manual; paste a cookie string directly. See [How do I get my cookie?](get_cookie.md)
- **Email & Password** — Legacy/deprecated. Does not work if Captcha or Two-Factor Authentication is required. Not recommended.

---

## Migration from Older Packages

If you have `node-red-contrib-alexa-remote2` or `node-red-contrib-alexa-cakebaked` installed, there will be node name conflicts. You need to remove the old package first.

### Via Command Line

```bash
node-red admin remove node-red-contrib-alexa-remote2
node-red admin remove node-red-contrib-alexa-cakebaked
node-red admin install node-red-contrib-alexa-remote2-applestrudel
```

### Via Node-RED UI

1. Export all flows: **Menu → Export → All Flows → Download**
2. Delete all flows (double-click each tab → Delete)
3. Delete the `alexa-remote-account` config node: **Menu → Configuration Nodes**
4. Deploy the empty state
5. Uninstall the old package: **Menu → Manage Palette → Nodes → Remove**
6. Install `node-red-contrib-alexa-remote2-applestrudel`
7. Reimport your flows: **Menu → Import → select file**
8. Reconfigure the Account node and redeploy

---

## Tips

- **Avoid excessive polling.** Prefer using the **Alexa Event** node to react to push notifications instead of polling for state changes.
- **Events require WebSocket.** Enable the *Events* toggle on the Account node to receive push events.
- **Multiple accounts** are supported — each account node is independent.
- **Device groups** are supported and visible in device dropdowns.

---

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/bbindreiter/node-red-contrib-alexa-remote2-applestrudel).

---

## License

[MIT](LICENSE)
