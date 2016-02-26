# NBrain

NTHU Multilingual Brainstorming Tool, prototype v3.1. Concept by Fredy, Allie, and Seraphina.

## Features

### Two-Columns Display

Users can alter their display settings. In one-column mode, it works just like common instant messenger. However, in two-columns mode, the messages sent by the sender will be placed at the right half of the screen, while other messages will be placed in the left half.


### Block mode and share function

This function is designed to prevent from the evaluation by others' when brainstorming. When you are in "Block mode", others are not able to see the content that you have sent, unless you click on the share button. The shared message will be wrapped in green color.


### Inline translation

Users can select a text or click on “translate” to translate the word you select or in the message. The result of translation will be placed at the end of the message, and will be highlighted in red color. In the view of sender, the result will be highlighted in yellow color.


## Modules

### Express

Use express as web framework


### Socket.io

Use socket.io to manipulate events between client and server. 


### Bing Translator 

Use Microsoft Bing translator to support inline translation. The module for accessing Bing is [mstranslator](https://github.com/nanek/mstranslator). Before starting, please check your Microsoft Developer ID and secret key in config file (or in Server.js) to access Bing translator.


### Postgres

Use [pg](https://github.com/brianc/node-postgres) to link postgres database. To store control history and messages.


