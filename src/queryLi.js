var request = require('request');
var qs = require('qs');
var async = require('async');

var exports = module.exports = {};

function getStats(fen, callback) {
    var masterURL = "http://expl.lichess.org/master"; // database of master games
    var masterParams = {fen:fen, moves:0}; // only want stats of this board position, no moves
    var masterQuery = masterURL+"?"+qs.stringify(masterParams); // form the query

    var liURL = "http://expl.lichess.org/lichess"; // much larger database of games
    var liParams = {fen:fen, moves:0, variant:"standard",  // params chosen to access
                    speeds:["classical","blitz","bullet"], // all games in the database
                    ratings:[1600,1800,2000,2200,2500]};
    var liQuery = liURL+"?"+qs.stringify(liParams); // form the query

    var queries = [masterQuery, liQuery];

    // Make all queries simultaneously. Each is performed via the httpQuery
    // routine. Then, once both queries are finished combine their stats into
    // one object and return it to the caller.
    async.map(queries, httpQuery, function(err, stats) {
        var totWhite = 0;
        var totDraws = 0;
        var totBlack = 0;
        var totGames = 0;
        var num = 0;
        for(var i = 0, len = stats.length; i < len; i++) { 
            totWhite += stats[i].white;
            totDraws += stats[i].draws;
            totBlack += stats[i].black;
            gamesi = stats[i].white + stats[i].draws + stats[i].black;
            num += gamesi * stats[i].averageRating;
            totGames += gamesi;
        }
        var result = {
            white: totWhite,
            draws: totDraws,
            black: totBlack,
            averageRating: parseInt(num/totGames, 10)  // weighted average of ratings
        };
        callback(result);
    });
};

function httpQuery(query, callback) {

    request.get(query,
        function (error, response, body) {
            var json = JSON.parse(body);
            var stats = {
                "white": json.white,
                "draws": json.draws,
                "black": json.black,
                "averageRating": json.averageRating
            };
            return callback(error, stats);
        });
};

exports.getStats = getStats;

//----------------------------------------------------------------------------------------------

var main = function() {
    //var fen = "r1bqkb1r/3pnppp/p1n1p3/1Np5/B2PP3/5N2/PPP2PPP/R1BQK2R%20b%20KQkq%20-%200%207";
    var fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201";
    getStats(fen, function(stats) {
        console.log("Stats for fen: ", fen);
        console.log(stats);
    });
};

if(require.main === module) {
    main();
}
