var Maps = require("../maps");

var mapNames = Maps.names();

/** Render game page */
module.exports = function(app) {
    app.get("/play", function(req, res) {
        res.render("play", {loc: "play", maps: mapNames});
    });
};
