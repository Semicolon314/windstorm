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
        this.step = 0; // Current game step
    }
    
    // Game constants
    Game.STEPS_PER_SECOND = 30;
    Game.UNIT_COOLDOWN = 30;
    
    // Unit constructor
    Game.Unit = function(data) {
        this.id = ++unitIdCounter;
        this.row = data.row;
        this.col = data.col;
        this.type = data.type || 1; // 1 is moving unit, 2 is base
        this.player = data.player;
        this.lastMove = -Game.UNIT_COOLDOWN;
        this.moveQueue = [];
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
                lastMove: this.units[i].lastMove
            });
        }
        
        return {
            map: this.map,
            units: units,
            playerColors: this.playerColors,
            step: this.step
        };
    };
    
    Game.prototype.load = function(data) {
        this.map = data.map;
        this.playerColors = data.playerColors;
        this.step = data.step;
        
        this.units = data.units;
        for(var i = 0; i < data.units.length; i++) {
            this.units[i].moveQueue = [];
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
    
    // Checks whether the given position is on the map
    Game.prototype.onMap = function(pos) {
        return pos.row >= 0 && pos.col >= 0 &&
                pos.row < this.map.rows &&
                pos.col < this.map.cols;
    };
    
    Game.prototype.unitAt = function(pos) {
        for(var i = 0; i < this.units.length; i++) {
            var unit = this.units[i];
            if(unit.row === pos.row && unit.col === pos.col) {
                return unit;
            }
        }
        
        return null;
    };
    
    Game.prototype.unitById = function(id) {
        for(var i = 0; i < this.units.length; i++) {
            var unit = this.units[i];
            if(unit.id === id) {
                return unit;
            }
        }
        
        return null;
    };
    
    // Returns a list of units next to (not on) the given position
    Game.prototype.adjacentUnits = function(pos) {
        var list = [];
        
        for(var dr = -1; dr <= 1; dr++) {
            for(var dc = -1; dc <= 1; dc++) {
                if(Math.abs(dr) + Math.abs(dc) === 1) {
                    var target = {row: pos.row + dr, col: pos.col + dc};
                    if(this.onMap(target)) {
                        var unit = this.unitAt(target);
                        if(unit !== null) {
                            list.push(unit);
                        }
                    }
                }
            }
        }
        
        return list;
    };
    
    // Checks whether the given action is valid for the given player
    // Returns "valid" if the move is valid, returns error otherwise
    Game.prototype.validAction = function(action, player) {
        if(action.type === "move") {
            var unit = this.unitById(action.unitId);
            if(unit !== null) {
                if(unit.player === player) {
                    if(unit.type === 1) {
                        var lastPos = unit.moveQueue.length > 0 ? unit.moveQueue[unit.moveQueue.length - 1] : {row: unit.row, col: unit.col};
                        
                        var dist = Math.abs(lastPos.row - action.target.row) + Math.abs(lastPos.col - action.target.col);
                        if(dist <= 1) {
                            if(this.map.data[action.target.row][action.target.col] === 1) {
                                return "valid";
                            } else {
                                return "invalidtile"; // Tile is not walkable
                            }
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
    
    // Makes the given action, and returns an update
    // If the action failed, the update will include relevant corrections
    Game.prototype.makeAction = function(action, player) {
        var validity = this.validAction(action, player);
        var unit;
        var updates = [];
        
        if(validity === "valid") {
            if(action.type === "move") {
                unit = this.unitById(action.unitId);
                unit.moveQueue.push(action.target);
            }
        } else {
            if(validity === "invalidtype") {
                return []; // No updates
            } else if(action.type === "move") {
                if(validity === "invalidid") {
                    // The unit is probably dead
                    updates.push({
                        id: action.unitId,
                        remove: true
                    });
                } else if(validity === "wrongplayer") {
                    // Tell them the correct player
                    updates.push({
                        id: action.unitId,
                        player: this.unitById(action.unitId).player
                    });
                } else if(validity === "invalidunittype") {
                    // Tell them the correct unit type
                    updates.push({
                        id: action.unitId,
                        type: this.unitById(action.unitId).type
                    });
                } else if(validity === "invalidtarget") {
                    // Tell them the correct unit position and clear moveQueue
                    unit = this.unitById(action.unitId);
                    updates.push({
                        id: action.unitId,
                        row: unit.row,
                        col: unit.col,
                        moveQueue: []
                    });
                } else if(validity === "invalidtile") {
                    // Resend the map
                    // For now, do nothing
                }
            }
        }
        
        return {
            step: this.step,
            updates: updates
        };
    };
    
    // Removes a unit with the given id
    Game.prototype.removeUnit = function(id) {
        for(var i = 0; i < this.units.length; i++) {
            if(this.units[i].id === id) {
                this.units.splice(i, 1);
                return;
            }
        }
    };
    
    // Performs a single step and returns an update
    Game.prototype.doStep = function() {
        this.step += 1;
        
        var updates = [];
        var i, unit;
        
        for(i = 0; i < this.units.length; i++) {
            unit = this.units[i];
            if(unit.moveQueue.length > 0 && this.step - unit.lastMove > Game.UNIT_COOLDOWN) {
                // See if the target is an okay place to move
                var targetUnit = this.unitAt(unit.moveQueue[0]);
                if(targetUnit === null) {
                    unit.row = unit.moveQueue[0].row;
                    unit.col = unit.moveQueue[0].col;
                    unit.lastMove = this.step;
                    unit.moveQueue = unit.moveQueue.slice(1);
                    
                    updates.push({
                        id: unit.id,
                        row: unit.row,
                        col: unit.col,
                        lastMove: unit.lastMove
                    });
                } else {
                    // Clear the unit's move queue and send current position
                    unit.moveQueue = [];
                    
                    updates.push({
                        id: unit.id,
                        row: unit.row,
                        col: unit.col,
                        moveQueue: []
                    });
                }
            }
        }
        
        // Kill off dead units
        var deadList = [];
        for(i = 0; i < this.units.length; i++) {
            unit = this.units[i];
            var adj = this.adjacentUnits(unit);
            
            var enemies = 0;
            for(var j = 0; j < adj.length; j++) {
                if(adj[j].player !== unit.player) {
                    enemies += 1;
                }
            }
            
            if(enemies >= 2) {
                deadList.push(unit.id);
                updates.push({
                    id: unit.id,
                    remove: true
                });
            }
        }
        for(i = 0; i < deadList.length; i++) {
            this.removeUnit(deadList[i]);
        }
        
        return {
            step: this.step,
            updates: updates
        };
    };
    
    Game.prototype.applyUpdate = function(updateData) {
        this.step = updateData.step;
        
        if(updateData.updates) {
            for(var i = 0; i < updateData.updates.length; i++) {
                var update = updateData.updates[i];
                var unit = this.unitById(update.id);
                
                if(unit === null) {
                    unit = new Game.Unit();
                    unit.id = update.id;
                    this.units.push(unit);
                }
                
                if(update.remove) {
                    this.removeUnit(update.id);
                } else {
                    unit.row = update.row || unit.row;
                    unit.col = update.col || unit.col;
                    unit.type = update.type || unit.type;
                    unit.player = update.player || unit.player;
                    unit.lastMove = update.lastMove || unit.lastMove;
                    unit.moveQueue = update.moveQueue || unit.moveQueue;
                    
                    if(unit.moveQueue.length > 0) {
                        if(unit.row === unit.moveQueue[0].row &&
                                unit.col === unit.moveQueue[0].col) {
                            unit.moveQueue = unit.moveQueue.slice(1);
                        }
                    }
                }
            }
        }
    };
    
    return Game;
}());

if(typeof module === "object" && typeof module.exports === "object") {
    module.exports = Game;
}