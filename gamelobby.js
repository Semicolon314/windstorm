var idCounter = 0;

var Game = require("./assets/js/game");
var Maps = require("./maps");

function GameLobby(io, options) {
    this.id = ++idCounter;
    
    this.io = io;
    
    this.players = []; // Players in the lobby
    this.spectators = []; // Spectators in the lobby
    
    this.name = options.name || ("Game " + this.id);
    this.playerCount = options.playerCount || 2;
    this.map = options.map || "random";
    this.leader = options.leader || null;
    this.started = false;
}

GameLobby.prototype.serialize = function() {
    var players = [];
    var spectators = [];
    var i;
    
    for(i = 0; i < this.players.length; i++) {
        players.push({
            id: this.players[i].id,
            name: this.players[i].name
        });
    }
    for(i = 0; i < this.spectators.length; i++) {
        spectators.push({
            id: this.players[i].id,
            name: this.spectators[i].name
        });
    }
    
    return {
        id: this.id,
        name: this.name,
        players: players,
        spectators: spectators,
        playerCount: this.playerCount,
        map: this.map,
        leader: this.leader === null ? null : this.leader.name,
        started: this.started
    };
};

GameLobby.prototype.sendUpdate = function() {
    this.io.emit("gamelist", [this.serialize()]);
};

GameLobby.prototype.gameFullUpdate = function() {
    this.io.to("game" + this.id).emit("fullgame", this.game.serialize());
};

GameLobby.prototype.deleteSelf = function() {
    // Remove all players
    for(var i = 0; i < this.players.length; i++) {
        this.removePlayer(this.players[i]);
    }
    
    this.io.emit("gamelist", [{id: this.id, remove: true}]);
};

// Adds a player to the lobby
// If spec is true, adds the player as a spectator
// Returns "player" or "spectator"
GameLobby.prototype.addPlayer = function(player, spec) {
    if(!spec) {
        spec = false;
    }
    
    if(this.players.length >= this.playerCount) {
        spec = true;
    }
    
    var joinType = spec ? "spectator" : "player";
    
    // Add listeners
    this.addListeners(player);
    
    if(!spec) { // Add as a player
        this.players.push(player);
    } else { // Add as a spectator
        this.spectators.push(player);
    }
    
    // Promote to leader?
    if(this.leader === null) {
        this.leader = player;
    }
    
    // Make the player join the game room
    player.socket.join("game" + this.id);
    
    // Set the player's gameLobby
    player.gameLobby = this;
    
    // Send an update
    this.sendUpdate();
    
    // Tell the player that they've joined
    player.socket.emit("joingame", {
        id: this.id,
        joinType: joinType
    });
    
    // Send the new player a full game update if the game is started
    if(this.started) {
        player.socket.emit("fullgame", this.game.serialize());
    }
    
    return joinType;
};

// Removes a player
GameLobby.prototype.removePlayer = function(player) {
    var i;
    
    this.removeListeners(player);
    
    player.gameLobby = null;
    
    for(i = 0; i < this.players.length; i++) {
        if(this.players[i].id === player.id) {
            this.players.splice(i, 1);
            break;
        }
    }
    for(i = 0; i < this.spectators.length; i++) {
        if(this.spectators[i].id === player.id) {
            this.spectators.splice(i, 1);
            break;
        }
    }
    
    player.socket.leave("game" + this.id);
    player.socket.emit("leavegame");
    player.gameLobby = null;
    
    // Promote someone new to leader?
    if(this.leader.id === player.id) {
        if(this.players.length > 0) {
            this.leader = this.players[0];
        } else if(this.spectators.length > 0) {
            this.leader = this.spectators[0];
        } else {
            this.leader = null;
        }
    }
    
    // Send an update
    this.sendUpdate();
};

// Switches a player between spectator and player
GameLobby.prototype.toggleJoinType = function(player) {
    var i;
    
    for(i = 0; i < this.players.length; i++) {
        if(this.players[i].id === player.id) {
            this.players.splice(i, 1);
            this.spectators.push(player);
            this.sendUpdate();
            player.socket.emit("joingame", {id: this.id, joinType: "spectator"});
            return;
        }
    }
    
    if(this.players.length === this.playerCount) {
        return;
    }
    
    for(i = 0; i < this.spectators.length; i++) {
        if(this.spectators[i].id === player.id) {
            this.spectators.splice(i, 1);
            this.players.push(player);
            this.sendUpdate();
            player.socket.emit("joingame", {id: this.id, joinType: "player"});
            return;
        }
    }
};

// Starts the game
GameLobby.prototype.startGame = function() {
    this.game = new Game();
    
    // Select the map
    if(this.map === "random") {
        this.map = Maps.random();
    }
    var mapObj = Maps.get(this.map);
    
    var playerList = [];
    this.players.forEach(function(player) {
        playerList.push(player.id);
    });
    
    this.game.setup(mapObj, playerList);
    
    this.started = true;
    
    this.sendUpdate();
    this.gameFullUpdate();
};

// Does a step in the game
GameLobby.prototype.doGameStep = function() {
    var updateData = this.game.doStep();

    this.io.to("game" + this.id).emit("gameupdate", updateData);
};

/* jshint ignore: start */
GameLobby.prototype.addListeners = function(player) {
    // None yet
};

GameLobby.prototype.removeListeners = function(player) {
    // None yet
};
/* jshint ignore: end */

module.exports = GameLobby;