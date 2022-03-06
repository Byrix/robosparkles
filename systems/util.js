/* ROBOSPARKLES
script: util.js
version: 1.0.0
author: byrix
license: GPL-3.0 */


const mysql = require('mysql');
const fs = require('fs');
require('dotenv').config();

module.exports = class Util {
    constructor(api, sendMsg, delMsg) {
        this.sendMsg = sendMsg;
        this.delMsg = delMsg;
        this.twitchApi = api;

        this.db = mysql.createConnection({
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: 'robosparkles_test_db'
        });
        this.db.connect();
    }

    sendMessage(channel, msg) { this.sendMsg(channel, msg); }
    deleteMessage(id, channel='#byrix__') { this.delMsg(channel, id); }
    checkCooldown(lastCall, cooldown) { return +new Date()+cooldown < lastCall }
    saveFile(data, filepath) {
        try { fs.writeFileSync(filepath, JSON.stringify(data)) }
        catch(err) { throw err }
    }
    readFile(filepath) {
        try { var data = JSON.parse(fs.readFileSync(filepath)); }
        catch(err) { console.error(err); }
        return data;
    }
}