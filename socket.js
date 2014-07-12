var moniker = require("moniker");

module.exports = function(server) {
    var io = require("socket.io").listen(server, {log: false});
    
    io.sockets.on("connection", function(socket) {
        console.log("A user connected via Socket.IO.");
        
        var userName = moniker.choose();
        
        socket.on("requestname", function(name) {
            if(name === null) {
                socket.emit("name", userName);
            } else {
                // TODO: Give them this name if possible
                // For now, give them default name
                socket.emit("name", userName);
            }
            socket.join("chat"); // Join the chat room
        });
        
        socket.on("message", function(text) {
            socket.broadcast.to("chat").emit("message",
                {tags: [{text: userName}], text: text}
            );
        });
        
        socket.on("ping", function(id) {
            // Relay ping
            socket.emit("ping", id);
        });
    });
};