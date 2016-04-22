var queryLi = require("./queryLi.js");
var fs = require("fs");

String.prototype.replaceAll = function(search, replacement) {
        var target = this;
            return target.replace(new RegExp(search, 'g'), replacement);
};

//var fen = "r1bqkb1r/3pnppp/p1n1p3/1Np5/B2PP3/5N2/PPP2PPP/R1BQK2R%20b%20KQkq%20-%200%207";
var fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201";

queryLi.getStats(fen, function(stats) {
    console.log("Stats for fen: ", fen);
    console.log(JSON.stringify(stats));
    fs.writeFile(fen.replaceAll("/","_"), JSON.stringify(stats), function(err,data){if(err){return console.log(err);}console.log(data);});
});

