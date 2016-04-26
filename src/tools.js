var request = require('request');
var qs = require('qs');
var async = require('async');
var chessjs = require('../js/chess.min.js');

var exports = module.exports = {};

function pgnToFen(pgn, callback){
	var game = new chessjs.Chess();
	var history = pgn.split(" ").filter(function(s, i){
		return !(i % 3 == 0)
	});

	var history_fens = history.map(function(move){
		game.move(move);
		return game.fen();
	});

  //get FENs for all possible_moves
  var possible_fens = game.moves().map(function(move) {
    game.move(move);
    var fen = game.fen();
    game.undo();
    return fen;
  });

	callback(history_fens, possible_fens);
}

exports.pgnToFen = pgnToFen;

function queryEndGame(fen, callback) {
  var url = "https://syzygy-tables.info/api/v2";
  var params = {fen:fen}; 
  var query = url+"?"+qs.stringify(params); // form the query
  var game = new chessjs.Chess(fen);
  var turn = game.turn();
  var map = {'w': 'white', 'd': 'draws', 'b': 'black'};

  request.get(query,
    function (error, response, body) {
      var json = JSON.parse(body);
      if(error) {
        console.log("Error: ", error);
      }
      var outcome;
      if ( json.wdl > 0 ) {
        outcome = map[turn];  
      } else if ( json.wdl < 0 ) {
        turn == 'white' ? outcome = 'black' : outcome = 'white';
      } else {
        outcome = "draws";
      } 
      if (json.bestmove === null) {
        console.log("Checkmate! No best move...");
        var result = {
          "fen": fen,
          "bestmove": null,
          "outcome": outcome
        };
        callback(error, result);
      } else {
        var bestmove = json.moves[json.bestmove].san;
        game.move(bestmove);
        var bestMoveFEN = game.fen();
        var result = {
            "fen": fen,
            "bestmove": bestMoveFEN,
            "outcome": outcome
        };
        callback(error, result);
      }
  });
};

exports.queryEndGame = queryEndGame;

function getStats(fen, callback) {

    var game = new chessjs.Chess(fen);
    var masterURL = "http://expl.lichess.org/master"; // database of master games
    var masterParams = {fen:fen, moves:100}; // only want stats of this board position, no moves
    var masterQuery = masterURL+"?"+qs.stringify(masterParams); // form the query

    var liURL = "http://expl.lichess.org/lichess"; // much larger database of games
    var liParams = {fen:fen, moves:100, variant:"standard",  // params chosen to access
                    speeds:["classical","blitz","bullet"], // all games in the database
                    ratings:[1600,1800,2000,2200,2500]};
    var liQuery = liURL+"?"+qs.stringify(liParams); // form the query

    var queries = [masterQuery, liQuery];

    // Make all queries simultaneously. Each is performed via the httpQuery
    // routine. Then, once both queries are finished combine their stats into
    // one object and return it to the caller.
    async.map(queries, httpRequest, function(err, json) {
        var result = {};
        var moves0 = json[0].moves;
        for( var i=0, len=moves0.length; i<len; i++) {
          game.move(moves0[i].san);
          var newFen = game.fen();
          result[newFen] = {fen: newFen,
                            white: moves0[i].white,
                            draws: moves0[i].draws,
                            black: moves0[i].black}
          game.undo()
        }
        //console.log("result after moves0", result);
        var moves1 = json[1].moves;
        for( var i=0, len=moves1.length; i<len; i++) {
          game.move(moves1[i].san);
          var newFen = game.fen();
          if (result.hasOwnProperty(newFen)) {
            result[newFen].white += moves1[i].white;
            result[newFen].draws += moves1[i].draws;
            result[newFen].black += moves1[i].black;
          } else {
            result[newFen] = {fen: newFen,
                              white: moves1[i].white,
                              draws: moves1[i].draws,
                              black: moves1[i].black};
          }
          game.undo();
        }
        //console.log("result after moves1", result);
        callback(result);
    });
};

function httpRequest(query, cb) {
  request.get(query, function (error, response, body) {
    var json = JSON.parse(body);
    cb(error, json);
  });
}

exports.getStats = getStats;

//----------------------------------------------------------------------------------------------

if(require.main === module) {
  //var fen = "4k3/r7/8/8/8/7B/5K2/2R1B3 w - - 0 1";
  //var fen = "r1bqkb1r/3pnppp/p1n1p3/1Np5/B2PP3/5N2/PPP2PPP/R1BQK2R%20b%20KQkq%20-%200%207";
  var fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  getStats(fen, function(stats) {
    console.log(stats);
  });
  //queryEndGame(fen, function(error, stats) {
   //   console.log("EndGame for fen: ", fen);
    //  console.log(stats);
  //});

  //var pgn1 = "1. e4 g5 2. Qg4 e5 3. Bb5 Bd6 4. d4 h5 5. Qxg5 Ba3 6. Qxg8+ Rxg8 7. Nxa3 Rxg2 8. Bg5 Qf6 9. Bxf6 a6 10. dxe5 Nc6 11. Bxc6 Rg7 12. Bxg7 bxc6 13. O-O-O a5 14. e6 c5 15. exd7+ Bxd7 16. Nf3 f6 17. Bxf6 Rc8 18. Ne5 Bc6 19. Nxc6 Rd8 20. Rxd8+ Kf7 21. e5 a4 22. Rg1 Ke6 23. Nc4 Kf7 24. Bh8 a3 25. e6+ Kxe6 26. Re1+ Kf7 27. N4e5+ Ke6 28. Ng4+ Kf7 29. Re7+ Kg6 30. Nb4 axb2+ 31. Kxb2 h4 32. Na6 c6 33. Rc8 Kg5 34. Re5+ Kxg4 35. Re4+ Kg5 36. Rxc6 c4"
  //pgnToFen(pgn1, function(history, possible_moves) {
    //console.log("history = ", history);
    //console.log("possible_moves = ", possible_moves);
  //});
}
