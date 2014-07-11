/** Render game page */
module.exports = function(app) {
    app.get("/play", function(req, res) {
        res.render("play", {loc: "play"});
    });
};
