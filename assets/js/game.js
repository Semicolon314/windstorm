$(function() {
    /* Socket.IO methods */
    var socket = io();
    var pings = {};
    
    function millis() {
        return new Date().getTime();
    }
    
    socket.on("connect", function() {
        // Check if there's a stored name
        if(localStorage["name"] !== null) {
            // Request that name from the server
            socket.emit("requestname", localStorage["name"]);
        } else {
            // Request a name from the server
            socket.emit("requestname", null);
        }
    });
    
    socket.on("name", function(name) {
        Messager.addMessage({tags: [{type: "info", text: "Info"}], text: "Name set to " + name + "."});
        Messager.setName(name);
        
        localStorage["name"] = name;
    });
    
    socket.on("message", function(message) {
        Messager.addMessage(message);
    });
    
    socket.on("ping", function(id) {
        var delta = millis() - pings[id];
        delete pings[id];
        
        Messager.info("Ping: " + delta);
    });
    
    function ping() {
        var id = Math.round(Math.random() * 1000000);
        pings[id] = millis();
        socket.emit("ping", id);
    }
    
    /* Message Handler */
    var Messager = (function() {
        // Private variables
        var messageLog = [];
        var userName = "You";
    
        function addMessage(message) {
            messageLog.push(message);
            
            var mDiv = $("#messages");
            
            mDiv.append(createElement(message));
            
            mDiv.scrollTop(mDiv.prop("scrollHeight"));
        }
        
        function plain(name, text) {
            addMessage({tags: [{text: name}], text: text});
        }
        
        function info(text) {
            addMessage({tags: [{type: "info", text: "Info"}], text: text});
        }
        
        function debug(text) {
            addMessage({tags: [{type: "danger", text: "Debug"}], text: text});
        }
        
        function sendMessage(text) {
            if(text[0] === "/") {
                // Parse the command
                var args = text.substring(1).split(" ");
                if(args[0].toLowerCase() === "ping") {
                    ping();
                } else if(args[0].toLowerCase() === "name") {
                    if(args.length > 1) {
                        socket.emit("requestname", args[1]);
                    } else {
                        info("Usage: /name [name]");
                    }
                } else {
                    info("Unknown command.");
                }
            } else {
                // Send the message as a message
                socket.emit("message", text);
                plain(userName, text);
            }
        }
        
        function setName(name) {
            userName = name;
        }
        
        function createElement(message) {
            // Create an element for the message
            var element = $("<p></p>");
            
            // Create a tags array
            var tags = [];
            
            // Append tags
            $.each(message.tags, function(i, tag) {
                var label = $("<span></span>");
                label.addClass("label");
                if(tag.type) {
                    label.addClass("label-" + tag.type);
                } else {
                    label.addClass("label-default");
                }
                label.html(tag.text);
                element.append(label);
            });
            
            // Append message body
            element.append("<span class=\"message\">" + message.text + "</span>");
            
            return element;
        }
        
        return {
            addMessage: addMessage,
            plain: plain,
            info: info,
            debug: debug,
            sendMessage: sendMessage,
            setName: setName
        };
    })();
    
    /* UI Input methods */
    $("#messageBox").keydown(function(e) {
        var k = e.keyCode ? e.keyCode : e.charCode;
        
        if(k === 13) { // Enter
            // Ensure the message isn't empty
            if($(this).val() !== "") {
                // Send the message and clear the input
                Messager.sendMessage($(this).val());
                $(this).val("");
            }
        }
    });
});