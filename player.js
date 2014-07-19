var moniker = require("moniker");
var util = require("util");
var events = require("events");

var id_counter = 0;

function Player(socket) {
    events.EventEmitter.call(this);

    this.id = ++id_counter;
    
    this.name = moniker.choose();
    this.socket = socket;
    this.gameLobby = null;
}

util.inherits(Player, events.EventEmitter);

Player.prototype.changeName = function(name) {
    this.name = name;
};

module.exports = Player;