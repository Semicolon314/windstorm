module.exports = function(server) {
    var io = require("socket.io").listen(server, {log: false});
    
    io.sockets.on("connection", function(socket) {
        console.log("A user connected via Socket.IO.");
        
        socket.on("message", function(text) {
            // TODO: Relay message
        });
        
        socket.on("ping", function(id) {
            // Relay ping
            socket.emit("ping", id);
        });
    });
};