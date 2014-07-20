var moniker = require("moniker");
var util = require("util");
var events = require("events");

var idCounter = 0;

function Player(socket) {
    events.EventEmitter.call(this);

    this.id = ++idCounter;
    
    this.name = moniker.choose();
    this.socket = socket;
    this.gameLobby = null;
}

util.inherits(Player, events.EventEmitter);

Player.prototype.changeName = function(name) {
    this.name = name;
};

module.exports = Player;