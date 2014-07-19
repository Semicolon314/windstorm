$(function() {
    /* Global variables */
    var gameList = [];
    var currentLobby = null;
    var joinType = null; // "player" or "spectator"

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
        
        setGameView("List");
    });
    
    socket.on("message", function(message) {
        Messager.addMessage(message);
    });
    
    socket.on("ping", function(id) {
        var delta = millis() - pings[id];
        delete pings[id];
        
        Messager.info("Ping: " + delta);
    });
    
    socket.on("gamelist", function(list) {
        $.each(list, function(i, data) {
            // See if it's already in the list
            var inGameList = -1;
            $.each(gameList, function(j, gameData) {
                if(data.id === gameData.id) {
                    inGameList = j;
                    return false;
                }
            });
            
            console.log(data.id + " is in list at " + inGameList);
            
            if(inGameList !== -1) {
                if(!data.remove) {
                    gameList[inGameList] = data;
                    if(currentLobby !== null && data.id === currentLobby.id) {
                        currentLobby = data;
                        updateGameLobby();
                    }
                } else {
                    gameList.splice(inGameList, 1);
                }
            } else {
                if(!data.remove) {
                    gameList.push(data);
                }
            }
        });
        
        updateGameList();
    });
    
    socket.on("joingame", function(data) {
        for(var i = 0; i < gameList.length; i++) {
            if(gameList[i].id === data.id) {
                currentLobby = gameList[i];
                break;
            }
        }
        
        joinType = data.joinType;
        
        updateGameLobby();
        setGameView("Lobby");
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
                } else if(args[0].toLowerCase() === "msg") {
                    if(args.length > 2) {
                        args = text.substring(1).split(" ", 3);
                        socket.emit("message", {to: args[1], text: args[2]});
                        addMessage({tags: [{text: userName},{type: "info", text: "PM to " + args[1]}], text: args[2]});
                    } else {
                        info("Usage: /msg [name] [message]");
                    }
                } else {
                    info("Unknown command.");
                }
            } else {
                // Send the message as a message
                socket.emit("message", {text: text});
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
    
    function gameListButtonClick() {
        var id = parseInt($(this).attr("game"));
        var spectate = $(this).attr("action") === "spectate";
        
        socket.emit("joingame", {id: id, spectate: spectate});
    }
    
    $("#leaveLobbyButton").click(function() {
        socket.emit("leavegame");
        setGameView("List");
    });
    
    /* UI Update methods */
    // Sets the current game view
    function setGameView(view) {
        $(".game-view").hide();
        
        $("#gameView" + view).show();
    }
    
    // Makes a Join/Spectate button for the game list for the given game id
    function makeGameListButton(id) {
        var buttonDiv = $("<div class=\"btn-group btn-group-justified\"></div>");
        var joinButtonGroup = $("<div class=\"btn-group\"><button type=\"button\" class=\"btn btn-default\">Join</button></div>");
        var specButtonGroup = $("<div class=\"btn-group\"><button type=\"button\" class=\"btn btn-default\">Spectate</button></div>");
        
        var joinButton = joinButtonGroup.find("button");
        var specButton = specButtonGroup.find("button");
        
        joinButton.attr("game", id);
        specButton.attr("game", id);
        
        joinButton.attr("action", "join");
        specButton.attr("action", "spectate");
        
        buttonDiv.append(joinButtonGroup);
        buttonDiv.append(specButtonGroup);
        
        return buttonDiv;
    }
    
    function updateGameList() {
        var list = $("#gameList");
        list.html("");
        
        // Add rows
        $.each(gameList, function(i, game) {
            var row = $("<tr></tr>");
            
            // Button column
            var buttonCol = $("<td></td>");
            buttonCol.append(makeGameListButton(game.id));
            row.append(buttonCol);
            
            // Game name column
            row.append("<td><p>" + game.name + "</p></td>");
            
            // Map column
            row.append("<td><p>" + game.map + "</p></td>");
            
            // Players column
            row.append("<td><p>" + game.players.length + "/" + game.playerCount + "</p></td>");
            
            // Spectators column
            row.append("<td><p>" + game.spectators.length + "</p></td>");
            
            // Add the row to the table
            list.append(row);
        });
        
        // Add button listeners
        $("#gameList button").click(gameListButtonClick);
    }
    
    function updateGameLobby() {
        if(currentLobby === null) {
            return;
        }
        
        $("#lobbyName").html(currentLobby.name);
        $("#lobbyMap").html(currentLobby.map);
        
        var pList = $("#lobbyPlayerList");
        pList.html("");
        
        $.each(currentLobby.players, function(i, name) {
            pList.append("<li class=\"list-group-item\">" + name + "</li>");
        });
        // Add empty slots
        for(var i = 0; i < currentLobby.playerCount - currentLobby.players.length; i++) {
            pList.append("<li class=\"list-group-item\">&nbsp;</li>");
        }
        
        var sList = $("#lobbySpectatorList");
        sList.html("");
        if(currentLobby.spectators.length > 0) {
            $.each(currentLobby.spectators, function(i, name) {
                sList.append("<li class=\"list-group-item\">" + name + "</li>");
            });
        } else {
            sList.append("<li class=\"list-group-item\">None</li>");
        }
    }
});