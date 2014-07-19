var path = require("path");

var express = require("express");
var app = express();

// Set up templating
var ejs = require("ejs");
app.engine(".html", ejs.__express);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "html");

// Set up static directory
app.use("/assets", express.static(__dirname + "/assets"));

// Require routes
require("./routes")(app);

// Start listening
var server = app.listen(5000, function() {
    console.log("Listening on port %d", server.address().port);
});

require("./socket")(server);