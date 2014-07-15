var moniker = require("moniker");

function Player(socket) {
    this.name = moniker.choose();
    this.socket = socket;
}

module.exports = Player;