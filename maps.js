var fs = require("fs");
var path = require("path");

var mapList = [];

fs.readdirSync(path.join(__dirname, "maps")).forEach(function(file) {
    var cont = fs.readFileSync(path.join(__dirname, "maps", file), {encoding: "utf8"}).split("\n");
    var map = {};
    map.name = file.split(".")[0];
    
    // Get dimensions
    var dim = cont[0].split(" ");
    map.rows = parseInt(dim[0]);
    map.cols = parseInt(dim[1]);
    map.data = [];
    map.spawns = [];
    
    for(var r = 0; r < map.rows; r++) {
        map.data[r] = [];
        for(var c = 0; c < map.cols; c++) {
            var tile = cont[r + 1][c];
            if(tile === "#") {
                map.data[r][c] = 0;
            } else if(tile === ".") {
                map.data[r][c] = 1;
            } else if(tile === "+") {
                map.data[r][c] = 1;
                map.spawns.push({row: r, col: c});
            }
        }
    }
    
    mapList.push(map);
});

var Maps = {};

Maps.exists = function(name) {
    for(var i = 0; i < mapList.length; i++) {
        if(mapList[i].name === name) {
            return true;
        }
    }
    return false;
};

Maps.get = function(name) {
    for(var i = 0; i < mapList.length; i++) {
        if(mapList[i].name === name) {
            return mapList[i];
        }
    }
    return null;
};

Maps.names = function() {
    var nameList = [];
    for(var i = 0; i < mapList.length; i++) {
        nameList.push(mapList[i].name);
    }
    return nameList;
};

// Returns a random map name
Maps.random = function() {
    return mapList[Math.floor(Math.random() * mapList.length)].name;
};

module.exports = Maps;