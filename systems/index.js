/* ROBOSPARKLES
script: index.js
version: 1.0.0
author: byrix
license: GPL-3.0 */

const Quote = require ('./quotes');
const Util = require('./util');
const Moderation = require('./moderation');
const Commands = require('./commands');
const Shoutouts = require('./shoutouts');


module.exports = {
    quote: Quote,
    util: Util,
    moderation: Moderation,
    commands: Commands,
    shoutouts: Shoutouts
}