var Player = require("./player");

module.exports = function(server) {
    var io = require("socket.io").listen(server, {log: false});
    
    /* Global variables */
    var players = [];
    
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
    
    /* Connection handler */
    io.sockets.on("connection", function(socket) {
        console.log("A user connected via Socket.IO.");
        
        // Create a new player object
        var player = new Player(socket);
        var joined = false; // Officially joined or not
        
        socket.on("requestname", function(name) {
            if(!joined) {
                if(name === null) {
                    socket.emit("name", player.name);
                } else {
                    if(nameValid(name)) {
                        player.name = name;
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
                joined = true;
            } else { // Request to change name
                if(nameValid(name)) {                    
                    // Send name update info message
                    socket.broadcast.to("chat").emit("message",
                        {tags: [{type: "info", text: "Info"}], text: player.name + " changed their name to " + name + "."}
                    );
                    
                    player.name = name;
                    socket.emit("name", name);
                } else {
                    // Send error message
                    socket.emit("message",
                        {tags: [{type: "info", text: "Info"}], text: "That name is not available."}
                    );
                }
            }
        });
        
        socket.on("message", function(text) {
            socket.broadcast.to("chat").emit("message",
                {tags: [{text: player.name}], text: text}
            );
        });
        
        socket.on("ping", function(id) {
            // Relay ping
            socket.emit("ping", id);
        });
    });
};