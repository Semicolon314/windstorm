$(function() {
    /* Socket.IO Variables */
    var socket = io();
    var pings = {};
    
    function millis() {
        return new Date().getTime();
    }
    
    socket.on("connect", function() {
        Messager.addMessage({tags: [{type: "info", text: "Info"}], text: "Connected."});
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
                } else {
                    info("Unknown command.");
                }
            } else {
                // Send the message as a message
                socket.emit("message", text);
                plain("You", text);
            }
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
            sendMessage: sendMessage
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