# node-red-contrib-alexa-remote-cakebaked

> Forked from [586837r/node-red-contrib-alexa-remote2](https://github.com/586837r/node-red-contrib-alexa-remote2) to keep dependencies up to date.

This is a collection of Node-RED nodes for interacting with the Alexa API.
You can emulate routine behaviour, control and query your devices and much more!

All functionality is from [alexa-remote2](https://www.npmjs.com/package/alexa-remote2).
The goal is to expose all of [alexa-remote2](https://www.npmjs.com/package/alexa-remote2)s functionality in node-red nodes.

- [Changelog](CHANGELOG.md)
- [Examples](examples.md)

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

### **Guides**

These are few community guides that can help you install the plugin/module. If you find more let us know.

- [Alexa Text-To-Speech - How-To (2020)](https://youtu.be/vj9K0O_3zxI)
- [Alexa TTS using Node-RED – How-To (2020)](https://peyanski.com/alexa-tts-how-to/)
- [Node Red Alexa Remote2](https://tech.scargill.net/node-red-alexa-remote2/)
