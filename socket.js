var Player = require("./player");
var GameLobby = require("./gamelobby");
var encoder = new require("node-html-encoder").Encoder("entity");

module.exports = function(server) {
    var io = require("socket.io").listen(server, {log: false});
    
    /* Global variables */
    var players = [];
    var gameList = []; // Actually game lobbies
    
    // Add temp games for testing
    gameList.push(new GameLobby(io, {
        playerCount: 3,
        map: "rift"
    }));
    gameList.push(new GameLobby(io, {
        playerCount: 5,
        map: "temple"
    }));
    gameList.push(new GameLobby(io, {
        playerCount: 2,
        map: "paths"
    }));
    
    /* Global methods */
    // Checks whether the given name is valid and unused
    function nameValid(name) {
        if(name.length < 3 || name.toLowerCase() === "server" || name.toLowerCase() === "you")
            return false;
    
        for(var i = 0; i < players.length; i++) {
            if(players[i].name === name)
                return false;
        }
        
        return true;
    }
    
    // Returns a player with the given name, or null
    function playerByName(name) {
        for(var i = 0; i < players.length; i++) {
            if(players[i].name === name) {
                return players[i];
            }
        }
        
        return null;
    }
    
    // Returns the game lobby with the given id, or null
    function gameById(id) {
        for(var i = 0; i < gameList.length; i++) {
            if(gameList[i].id === id) {
                return gameList[i];
            }
        }
        return null;
    }
    
    // Returns a list of all game lobbies, serialized for sending
    function serializedGames() {
        var g = [];
        for(var i = 0; i < gameList.length; i++) {
            g.push(gameList[i].serialize());
        }
        return g;
    }
    
    // Deletes the game lobby with the given id
    function deleteGame(id) {
        for(var i = 0; i < gameList.length; i++) {
            if(gameList[i].id === id) {
                gameList[i].deleteSelf();
                gameList.splice(i, 1);
                return;
            }
        }
    }
    
    /* Connection handler */
    io.sockets.on("connection", function(socket) {
        console.log("A user connected via Socket.IO.");
        
        // Create a new player object
        var player = new Player(socket);
        players.push(player);
        var joined = false; // Officially joined or not
        
        socket.on("requestname", function(name) {
            if(!joined) {
                if(name === null) {
                    socket.emit("name", player.name);
                } else {
                    if(nameValid(name)) {
                        player.changeName(name);
                        socket.emit("name", name);
                    } else {
                        socket.emit("name", player.name);
                    }
                }
                
                // Announce their arrival
                socket.broadcast.to("chat").emit("message",
                    {tags: [{type: "info", text: "Info"}], text: player.name + " joined the server."}
                );
                
                socket.join("chat"); // Join the chat room
                socket.emit("gamelist", serializedGames());
                joined = true;
            } else { // Request to change name
                if(nameValid(name)) {                    
                    // Send name update info message
                    socket.broadcast.to("chat").emit("message",
                        {tags: [{type: "info", text: "Info"}], text: player.name + " changed their name to " + name + "."}
                    );
                    
                    player.changeName(name);
                    socket.emit("name", name);
                } else {
                    // Send error message
                    socket.emit("message",
                        {tags: [{type: "info", text: "Info"}], text: "That name is not available."}
                    );
                }
            }
        });
        
        socket.on("message", function(message) {
            var text = encoder.htmlEncode(message.text);
            if(message.to) {
                var target = playerByName(message.to);
                if(target !== null) {
                    target.socket.emit("message",
                        {tags: [{text: player.name}, {type: "info", text: "PM"}], text: text}
                    );
                } else {
                    socket.emit("message",
                        {tags: [{type: "info", text: "Info"}], text: "Player not found."}
                    );
                }
            } else {
                socket.broadcast.to("chat").emit("message",
                    {tags: [{text: player.name}], text: text}
                );
            }
        });
        
        socket.on("joingame", function(options) {
            if(player.gameLobby === null) { // Not already in a game
                var game = gameById(options.id);
                if(game !== null) {
                    var spectate = options.spectate || false;
                    
                    // Add the player to the game
                    game.addPlayer(player, spectate);
                } else {
                    socket.emit("message",
                        {tags: [{type: "info", text: "Info"}], text: "Game not found."}
                    );
                }
            }
        });
        
        socket.on("leavegame", function() {
            if(player.gameLobby !== null) {
                player.gameLobby.removePlayer(player);
            }
        });
        
        socket.on("ping", function(id) {
            // Relay ping
            socket.emit("ping", id);
        });
        
        socket.on("disconnect", function() {
            players.splice(players.indexOf(player), 1);
            
            if(player.gameLobby !== null) {
                // Remove them from their game
                player.gameLobby.removePlayer(player);
            }
            
            // Announce their departure
            socket.broadcast.to("chat").emit("message",
                {tags: [{type: "info", text: "Info"}], text: player.name + " left the server."}
            );
        });
    });
};