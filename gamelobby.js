var id_counter = 0;

function GameLobby(io, options) {
    this.id = ++id_counter;
    
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
    
    for(var i = 0; i < this.players.length; i++) {
        players.push(this.players[i].name);
    }
    for(var i = 0; i < this.spectators.length; i++) {
        spectators.push(this.spectators[i].name);
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
    
    return joinType;
};

// Removes a player
GameLobby.prototype.removePlayer = function(player) {
    this.removeListeners(player);
    
    player.gameLobby = null;
    
    for(var i = 0; i < this.players.length; i++) {
        if(this.players[i].id === player.id) {
            this.players.splice(i, 1);
            break;
        }
    }
    for(var i = 0; i < this.spectators.length; i++) {
        if(this.spectators[i].id === player.id) {
            this.spectators.splice(i, 1);
            break;
        }
    }
    
    player.socket.leave("game" + this.id);
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

GameLobby.prototype.addListeners = function(player) {
    // None yet
};

GameLobby.prototype.removeListeners = function(player) {
    // None yet
};

module.exports = GameLobby;