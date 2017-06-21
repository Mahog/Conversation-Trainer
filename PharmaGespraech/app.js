var express = require("express");
var app     = express();
var path    = require("path");

app.use('/static', express.static(__dirname));

app.listen(3000);

console.log("Running at Port 3000");