# node-red-contrib-alexa-remote2-applestrudel

[![npm](https://img.shields.io/npm/v/node-red-contrib-alexa-remote2-applestrudel.svg)](https://www.npmjs.com/package/node-red-contrib-alexa-remote2-applestrudel) [![downloads](https://img.shields.io/npm/dt/node-red-contrib-alexa-remote2-applestrudel.svg)](https://www.npmjs.com/package/node-red-contrib-alexa-remote2-applestrudel)


> Forked from [cakebake/node-red-contrib-alexa-remote-cakebaked](https://github.com/cakebake/node-red-contrib-alexa-remote-cakebaked) which was forked from [586837r/node-red-contrib-alexa-remote2](https://github.com/586837r/node-red-contrib-alexa-remote2) to keep dependencies up to date.

This is a collection of Node-RED nodes for interacting with the Alexa API.
You can emulate routine behaviour, control and query your devices and much more!

All functionality is from [alexa-remote2](https://www.npmjs.com/package/alexa-remote2).
The goal is to expose all of its functionality in node-red nodes.

- [Changelog](CHANGELOG.md)
- [Examples](examples.md)

### **Migration**
In case you've already installed Node-RED nodes from [alexa-cakebaked](https://www.npmjs.com/package/node-red-contrib-alexa-cakebaked) or [alexa-remote2](https://www.npmjs.com/package/node-red-contrib-alexa-remote2) the installation won't work due to conflicting names. You have 2 options:

#### **Command Line**
```
node-red admin remove node-red-contrib-alexa-remote2
node-red admin remove node-red-contrib-alexa-cakebaked
node-red admin install node-red-contrib-alexa-remote2-applestrudel
````

#### **Node-RED UI**
1. Export all of your flows to a file (Menu -> Export -> all flows -> Download) 
2. Delete all flows (Double Click on each Tab -> Delete)
3. Delete configuration node `alex-remote-account` node (Menu -> Configuration Nodes) and write down settings (Cookie path, refresh time)
4. Deploy empty state
5. Uninstall `node-red-contrib-alexa-remote2` or `node-red-contrib-alexa-cakebaked` (Menu -> Manage Palette -> Palette -> Nodes -> remove)
6. Search and install `node-red-contrib-alexa-remote2-applestrudel`
7. Reimport all flows from file (Menu -> Import -> Clipboard -> select a file to upload)
8. Restart Node-RED

### **Setup**

1. Drag an **Alexa Routine** node into your flow.
2. Create a new Account by pressing the edit button at the right side of the *Account* field.
3. Choose a **Service Host** and **Page** and **Language** depending on your location. For example:

   |     | Service Host        | Page          | Language |
   |-----|---------------------|---------------|----------|
   | USA | pitangui.amazon.com | amazon.com    | en-US    |
   | UK  | alexa.amazon.co.uk  | amazon.co.uk  | en-UK    |
   | GER | layla.amazon.de     | amazon.de     | de-DE    |
   | FR  | layla.amazon.de     | amazon.fr     | de-DE    |
   | ITA | alexa.amazon.it     | amazon.it     | it-IT    |
   | AUS | alexa.amazon.com.au | amazon.com.au | en-US    |
   | ES  | alexa.amazon.es     | amazon.es     | es-ES    |
   | BR  | alexa.amazon.com.br | amazon.com.br | pt-BR    |
   
4. Set **This IP** to the ip of your Node-RED server
5. Enter a **File Path** to save the authentication result so following authentications will be
automatic.
6. *Add* the new Account.
7. Deploy
8. Follow the url you see in the node status
9. Log in, wait until you see the node status **ready**
10. Write "Hello World!" in the *Alexa Routine* node text field.
11. Select a device in the *Alexa Routine* node devices field.

Now trigger the *Alexa Routine* Node with any message and your Alexa will say "Hello World!". (Hopefully!)
