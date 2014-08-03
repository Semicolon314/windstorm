$(function() {
    /* Global variables */
    var gameList = [];
    var currentLobby = null;
    var game = null;
    var joinType = null; // "player" or "spectator"
    var clientData = {};
    var currentView = "none";
    var lastFrame = null; // last frame for game animation
    var selectedUnit = null;

    /* Socket.IO methods */
    var socket = io();
    var pings = {};
    
    function millis() {
        return new Date().getTime();
    }
    
    socket.on("connect", function() {
        // Check if there's a stored name
        if(localStorage.name !== null) {
            // Request that name from the server
            socket.emit("requestname", localStorage.name);
        } else {
            // Request a name from the server
            socket.emit("requestname", null);
        }
    });
    
    socket.on("playerid", function(id) {
        clientData.id = id;
    });
    
    socket.on("name", function(name) {
        Messager.addMessage({tags: [{type: "info", text: "Info"}], text: "Name set to " + name + "."});
        Messager.setName(name);
        
        localStorage.name = name;
        
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
    
    socket.on("leavegame", function() {
        currentLobby = null;
        setGameView("List");
    });
    
    socket.on("fullgame", function(data) {
        game = new Game();
        game.load(data);
        setGameView("Canvas");
    });
    
    socket.on("gameupdate", function(data) {
        game.applyUpdate(data);
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
                        addMessage({tags: [{text: clientData.name},{type: "info", text: "PM to " + args[1]}], text: args[2]});
                    } else {
                        info("Usage: /msg [name] [message]");
                    }
                } else {
                    info("Unknown command.");
                }
            } else {
                // Send the message as a message
                socket.emit("message", {text: text});
                plain(clientData.name, text);
            }
        }
        
        function setName(name) {
            clientData.name = name;
        }
        
        function createElement(message) {
            // Create an element for the message
            var element = $("<p></p>");
            
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
    
    /* Utility methods */
    // Returns whether this client is the leader
    function isLeader() {
        if(currentLobby === null) {
            return false;
        }
        return currentLobby.leader === clientData.name;
    }
    
    function toggleJoinType() {
        socket.emit("togglejointype");
    }
    
    // Given a pixel on the canvas, finds the corresponding tile on the map
    function getMapTileByPixel(pixel) {
        var canvas = $("#gameCanvas");
        var size = Math.min(canvas.width() / game.map.cols, canvas.height() / game.map.rows);
        
        return {
            row: Math.floor((pixel.y - (canvas.height() - size * game.map.rows) / 2) / size),
            col: Math.floor((pixel.x - (canvas.width() - size * game.map.cols) / 2) / size)
        };
    }
    
    function moveSelectedUnit(dir) {
        if(selectedUnit !== null) {
            var unit = game.unitById(selectedUnit);
            
            var unitPos = {row: unit.row, col: unit.col};
            if(unit.moveQueue.length > 0) {
                unitPos = unit.moveQueue[unit.moveQueue.length - 1];
            }
        
            var dr = 0;
            var dc = 0;
            
            if(dir === "left") {
                dc = -1;
            }
            if(dir === "right") {
                dc = 1;
            }
            if(dir === "up") {
                dr = -1;
            }
            if(dir === "down") {
                dr = 1;
            }
            
            var target = {row: unitPos.row + dr, col: unitPos.col + dc};
            
            var action = {
                type: "move",
                unitId: unit.id,
                target: target
            };
            
            // Make sure the move is valid
            if(game.validAction(action, clientData.id) === "valid") {
                game.makeAction(action, clientData.id);
                socket.emit("makeaction", action);
            }
        }
    }
    
    /* UI Input methods */
    $("#messageBox").keydown(function(e) {
        var k = e.which;
        
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
    
    function lobbyPlayerButtonClick() {
        var target = $(this).parent().attr("player-target");
        var action = $(this).attr("action");
        
        socket.emit("leaderaction", {target: target, action: action});
    }
    
    $("#leaveLobbyButton").click(function() {
        socket.emit("leavegame");
        setGameView("List");
    });
    
    $("#createGameButton").click(function() {
        setGameView("Create");
    });
    
    $("#createGamePlayers button").click(function() {
        $("#createGamePlayers button").removeClass("active");
        $(this).addClass("active");
    });
    
    $("#cancelCreateButton").click(function() {
        setGameView("List");
    });
    
    $("#createButton").click(function() {
        var gameName = $("#createGameName").val();
        var gameMap = $("#createGameMap").val();
        var playerCount = parseInt($("#createGamePlayers .active").html());
        
        socket.emit("creategame", {name: gameName, map: gameMap, playerCount: playerCount});
    });
    
    $("#startGameButton").click(function() {
        socket.emit("startgame");
    });
    
    $(document).keydown(function(e) {
        var k = e.which;
        
        if(k === 70 && e.shiftKey) { // Shift-F
            $(".game-holder").toggleClass("fullscreen");
        }
        
        if(game && currentView === "Canvas") {
            if(k === 65) { // A (left)
                moveSelectedUnit("left");
            } else if(k === 68) { // D (right)
                moveSelectedUnit("right");
            } else if(k === 83) { // S (down)
                moveSelectedUnit("down");
            } else if(k === 87) { // W (up)
                moveSelectedUnit("up");
            }
        }
    });
    
    $("#gameCanvas").mousemove(function(e) {
        var offset = $(this).offset();
    
        var pixel = {
            x: e.pageX - offset.left,
            y: e.pageY - offset.top
        };
        
        var tile = getMapTileByPixel(pixel);
        
        if(game.onMap(tile)) {
            var unit = game.unitAt(tile);
            if(unit !== null && unit.player === clientData.id) {
                selectedUnit = unit.id;
            }
        }
    });
    
    /* UI Update methods */
    // Sets the current game view
    function setGameView(view) {
        if(currentView === view) {
            return;
        }
        
        currentView = view;
        
        $(".game-view").hide();
        
        $("#gameView" + view).show();
        
        if(view === "Canvas") {
            // Hide the game-holder
            $("#gameHolder").hide();
            
            // Start the rendering loop
            window.requestAnimationFrame(renderGame);
        } else {
            // Show the game-holder
            $("#gameHolder").show();
        }
    }
    
    // Makes a Join/Spectate button for the game list for the given game id
    function makeGameListButton(id, onlySpectate) {
        var buttonDiv = $("<div class=\"btn-group btn-group-justified\"></div>");
        var joinButtonGroup = $("<div class=\"btn-group\"><button type=\"button\" class=\"btn btn-default\">Join</button></div>");
        var specButtonGroup = $("<div class=\"btn-group\"><button type=\"button\" class=\"btn btn-default\">Spectate</button></div>");
        
        var joinButton = joinButtonGroup.find("button");
        var specButton = specButtonGroup.find("button");
        
        joinButton.attr("game", id);
        specButton.attr("game", id);
        
        joinButton.attr("action", "join");
        specButton.attr("action", "spectate");
        
        if(onlySpectate) {
            joinButton.prop("disabled", true);
        }
        
        buttonDiv.append(joinButtonGroup);
        buttonDiv.append(specButtonGroup);
        
        return buttonDiv;
    }
    
    // Makes a Kick/Leader button group for the given player
    function makeLeaderButtons(name) {
        var buttons = $("<div class=\"btn-group btn-group-xs pull-right\" player-target=\"" + name + "\"></div>");
            buttons.append("<button type=\"button\" class=\"btn btn-default\" action=\"kick\">Kick</button>");
            buttons.append("<button type=\"button\" class=\"btn btn-default\" action=\"leader\">Leader</button>");
            
        return buttons;
    }
    
    function updateGameList() {
        var list = $("#gameList");
        list.html("");
        
        // Add rows
        $.each(gameList, function(i, game) {
            var row = $("<tr></tr>");
            
            // Button column
            var buttonCol = $("<td></td>");
            buttonCol.append(makeGameListButton(game.id, game.started));
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
        
        if(gameList.length === 0) {
            list.append("<tr><td colspan=\"5\" class=\"text-center\">No games available</td></tr>");
        }
        
        // Add button listeners
        $("#gameList button").click(gameListButtonClick);
    }
    
    function updateGameLobby() {
        if(currentLobby === null) {
            return;
        }
        
        var listItem;
        
        $("#lobbyName").html(currentLobby.name);
        $("#lobbyMap").html(currentLobby.map);
        
        var pList = $("#lobbyPlayerList");
        pList.html("");
        
        $.each(currentLobby.players, function(i, obj) {
            listItem = $("<li class=\"list-group-item\">" + obj.name + "</li>");
            if(obj.name === currentLobby.leader) {
                listItem.append("<span class=\"label label-primary pull-right\">Leader</span>");
            } else if(isLeader()) {
                listItem.append(makeLeaderButtons(name));
            }
            pList.append(listItem);
        });
        // Add empty slots
        for(var i = 0; i < currentLobby.playerCount - currentLobby.players.length; i++) {
            if(i === 0 && joinType !== "player") {
                listItem = $("<li class=\"list-group-item\">\
                    <button type=\"button\" class=\"btn btn-sm btn-default center-block\">\
                    Switch to Player</a></li>");
                listItem.find("button").click(toggleJoinType);
                pList.append(listItem);
            } else {
                pList.append("<li class=\"list-group-item\">&nbsp;</li>");
            }
        }
        
        var sList = $("#lobbySpectatorList");
        sList.html("");
        if(currentLobby.spectators.length > 0) {
            $.each(currentLobby.spectators, function(i, obj) {
                listItem = $("<li class=\"list-group-item\">" + obj.name + "</li>");
                if(obj.name === currentLobby.leader) {
                    listItem.append("<span class=\"label label-primary pull-right\">Leader</span>");
                } else if(isLeader()) {
                    listItem.append(makeLeaderButtons(name));
                }
                sList.append(listItem);
            });
        }
        if(joinType !== "spectator") {
            listItem = $("<li class=\"list-group-item\">\
                <button type=\"button\" class=\"btn btn-sm btn-default center-block\">\
                Switch to Spectator</a></li>");
            listItem.find("button").click(toggleJoinType);
            sList.append(listItem);
        }
        
        // Enabled/disable the start game button
        $("#startGameButton").prop("disabled",
            !isLeader() || currentLobby.players.length < currentLobby.playerCount);
            
        // Add listeners for player kicking and leader-ing
        $("[player-target] button").click(lobbyPlayerButtonClick);
    }
    
    function renderGame(timestamp) {
        // Timestamp stuff not needed for actual game mechanics
        // Will possibly be used for timestamp
        if(lastFrame === null) {
            lastFrame = timestamp;
        }
        var delta = timestamp - lastFrame;
        lastFrame = timestamp;
        
        // Get the canvas and context
        var canvas = $("#gameCanvas");
        canvas[0].width = canvas.parent().width(); // Ensure element size matches style size
        canvas[0].height = canvas.parent().height();
        var ctx = canvas[0].getContext("2d");
        
        // Clear the canvas
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width(), canvas.height());
        
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText("FPS: " + Math.round(1000 / delta / 10) * 10, 20, 20);
        
        ctx.fillText("Step: " + game.step, 20, 50);
        
        // Draw the map
        var size = Math.min(canvas.width() / game.map.cols, canvas.height() / game.map.rows);
        var mapImage = getMapImage(size);
        drawUnits(mapImage, size);
        ctx.drawImage(mapImage, (canvas.width() - size * game.map.cols) / 2, (canvas.height() - size * game.map.rows) / 2);
        
        // Do the next frame
        if(currentView === "Canvas") {
            window.requestAnimationFrame(renderGame);
        }
    }
    
    // Returns an image of the map where size is the size of a tile
    function getMapImage(size) {
        var map = game.map;
        var canvas = document.createElement("canvas");
        canvas.width = map.cols * size;
        canvas.height = map.rows * size;
        var ctx = canvas.getContext("2d");
        
        ctx.strokeStyle = "#222222";
        for(var r = 0; r < map.rows; r++) {
            for(var c = 0; c < map.cols; c++) {
                if(map.data[r][c] === 0) { // Wall
                    ctx.fillStyle = "#222222";
                } else if(map.data[r][c] === 1) { // Floor
                    ctx.fillStyle = "#DDDDDD";
                }
                ctx.fillRect(c * size, r * size, size, size);
                ctx.strokeRect(c * size, r * size, size, size);
            }
        }
        
        return canvas;
    }
    
    // Draws units on top of a map image where size is the size of a tile
    function drawUnits(mapImage, size) {
        var ctx = mapImage.getContext("2d");
    
        for(var i = 0; i < game.units.length; i++) {
            var u = game.units[i];
            var color = game.playerColors[u.player];
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            
            if(selectedUnit === u.id) {
                ctx.strokeStyle = "#FFFF00";
            }
            
            if(u.type === 1) { // Moving unit
                ctx.beginPath();
                ctx.arc(size * u.col + size / 2, size * u.row + size / 2, size / 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if(u.type === 2) { // Base
                ctx.fillRect(size * u.col + size / 6, size * u.row + size / 6, size * 2 / 3, size * 2 / 3);
                ctx.strokeRect(size * u.col + size / 6, size * u.row + size / 6, size * 2 / 3, size * 2 / 3); 
            }
        }
        
        // Draw the selected unit's path
        if(selectedUnit !== null) {
            var unit = game.unitById(selectedUnit);
            
            if(unit === null) {
                selectedUnit = null;
            } else {
                if(unit.moveQueue.length > 0) {
                    ctx.fillStyle = "#FF0000";
                    
                    for(var i = 0; i < unit.moveQueue.length; i++) {
                        var p = unit.moveQueue[i];
                        
                        ctx.beginPath();
                        ctx.arc(size * p.col + size / 2, size * p.row + size / 2, size / 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
    }
});