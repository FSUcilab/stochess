var chessjs = require("../js/chess.min.js");
var tools = require("./tools.js");
//Play a game with random moves until game_ver
//starting from startFen
//returns the winner of the game

var exports = module.exports = {};

function simulate(startFen, collection, callback){
  var game = new chessjs.Chess(startFen);
  var winner = 'draw';
  var material = startFen.split(" ")[0].match(/[a-z]/gi).length;
  var moves = 0;

  while (!game.game_over() && material > 6){
      var possibleMoves = game.moves();
      //play random move
      var randomMoveIdx = Math.floor(Math.random() * possibleMoves.length);
      var moveToPlay = possibleMoves[randomMoveIdx];
      var move = game.move(moveToPlay);
      if(move.captured) material -= 1;
      moves += 1;
  }
  console.log("Finished Random Simulation...");
  console.log("Simulation took ", moves, " moves...");

  if (game.in_checkmate()) {
      console.log("ended in checkmate!");
      var loser = game.turn();
      //if white lost, then black won.
      //otherwise, white won
      loser == 'w' ? winner = 'b' : winner = 'w';
      callback(winner);
  } else {
    console.log("game not in checkmate!");
      console.log("Looking for record in local database");
      console.log("collection = ", collection);
      var c = collection.find({"fen": startFen}).toArray(function (err, result) {
        if (err) console.log("Error!: ", err);
        else {
          if (result.length) {
            console.log("Endgame found in database...");
            console.log("The winner is... ", result[0].outcome);
            callback(result[0].outcome);
          } else {
            console.log("Endgame not found in database...");
            console.log("Querying online tablebase...");
            tools.queryEndGame(game.fen(), function(error, gameResult) {
              console.log("The best move is... ", gameResult);
              console.log("Inserting endgame record into local database...");
              collection.insert(gameResult, function(err, report) {
                if (err) console.log("Error inserting new record into database: ", err);
                else console.log(report);
                callback(gameResult.outcome);
              });
            });
          }
        }
      });
      console.log("\n\nCursor = ", c, "\n\n");
    }
}

exports.simulate = simulate;

if(require.main === module) {
  var fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  mongodb = require('mongodb');
  var MongoClient = mongodb.MongoClient;
  var url = 'mongodb://localhost:27017/stochess';
  var db = MongoClient.connect(url, 
    function (err, db) {
      if (err) console.log('Unable to connect to the mongoDB server. Error:', err);
      else console.log('Connection established to', url);
      simulate(fen, db, function(winner) {
        console.log("Winner = ", winner);
        db.close()
      });
    });

}
