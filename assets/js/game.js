/* Map reference:
 * 0 - Wall
 * 1 - Floor
 */

var Game = (function() {
    var unitIdCounter = 0;
    var colorList = [
        "#ff8000",
        "#ff0080",
        "#00ff80",
        "#80ff00",
        "#8000ff",
        "#0080ff"
    ];
        
    function Game() {
        // Create a new empty game object
        this.units = [];
        this.map = {rows: 0, cols: 0};
        this.playerColors = {};
    }
    
    // Timing helper function
    Game.millis = function() {
        return new Date().getTime();
    };
    
    // Unit constructor
    Game.Unit = function(data) {
        this.id = ++unitIdCounter;
        this.row = data.row;
        this.col = data.col;
        this.type = data.type || 1; // 1 is moving unit, 2 is base
        this.player = data.player;
        this.lastMove = Game.millis() - 1000;
    };
    
    Game.prototype.serialize = function() {
        var units = [];
        for(var i = 0; i < this.units.length; i++) {
            units.push({
                id: this.units[i].id,
                row: this.units[i].row,
                col: this.units[i].col,
                type: this.units[i].type,
                player: this.units[i].player,
                lastMove: this.units[i].lastMove - Game.millis()
            });
        }
        
        return {
            map: this.map,
            units: units,
            playerColors: this.playerColors
        };
    };
    
    Game.prototype.load = function(data) {
        this.map = data.map;
        this.playerColors = data.playerColors;
        
        this.units = data.units;
        for(var i = 0; i < data.units.length; i++) {
            this.units[i].lastMove += Game.millis();
            this.units[i].moves = [];
        }
    };
    
    Game.prototype.setup = function(map, players) {
        this.map = map;
        
        var spawns = map.spawns.slice(0);
        var colors = colorList.slice(0);
        
        this.units = [];
        for(var i = 0; i < players.length; i++) {
            // Choose a color
            var color = colors.splice(Math.floor(Math.random() * colors.length), 1)[0];
            this.playerColors[players[i] + ""] = color;
            
            // Choose a spawn location
            var spawn = spawns.splice(Math.floor(Math.random() * spawns.length), 1)[0];
            
            // Put a base at the spawn
            this.units.push(new Game.Unit({
                row: spawn.row,
                col: spawn.col,
                type: 2, // Base
                player: players[i]
            }));
            
            // Choose to spawn starting units horizontally or vertically
            var dr = Math.round(Math.random());
            var dc = 1 - dr;
            // First unit
            this.units.push(new Game.Unit({
                row: spawn.row + dr,
                col: spawn.col + dc,
                player: players[i]
            }));
            // Second unit
            this.units.push(new Game.Unit({
                row: spawn.row - dr,
                col: spawn.col - dc,
                player: players[i]
            }));
        }
    };
    
    Game.prototype.unitAt = function(pos) {
        for(var i = 0; i < this.units; i++) {
            var unit = this.units[i];
            if(unit.row === pos.row && unit.col === pos.col) {
                return unit;
            }
        }
        
        return null;
    };
    
    Game.prototype.unitById = function(id) {
        for(var i = 0; i < this.units; i++) {
            var unit = this.units[i];
            if(unit.id === id) {
                return unit;
            }
        }
        
        return null;
    };
    
    // Checks whether the given move is valid for the given player
    // Returns "valid" if the move is valid, returns error otherwise
    Game.prototype.validMove = function(move, player) {
        if(move.type === "move") {
            var unit = this.unitById(move.unitId);
            if(unit !== null) {
                if(unit.player === player) {
                    if(unit.type === 1) {
                        var dist = Math.abs(unit.row - move.target.row) + Math.abs(unit.col - move.target.col);
                        if(dist <= 1) {
                            return "valid";
                        } else {
                            return "invalidtarget"; // Target is too far away
                        }
                    } else {
                        return "invalidunittype"; // The piece wasn't a movable piece
                    }
                } else {
                    return "wrongplayer"; // Not correct controller
                }
            } else {
                return "invalidid"; // Invalid unit id
            }
        } else {
            return "invalidtype"; // Invalid move type
        }
    };
    
    // Makes the given move, and returns a list of unit updates
    // If the move was successful, the updates will probably just be the moved piece
    // If the move failed, the updates will include relevant corrections
    Game.prototype.makeMove = function(move, player) {
        var validity = this.validMove(move, player);
        
        if(validity === "valid") {
            var unit = this.unitById(move.unitId);
            
        } else {
            
        }
    };
    
    return Game;
}());

if(typeof module === "object" && typeof module.exports === "object") {
    module.exports = Game;
}