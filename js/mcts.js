//Implementation of Monte Carlo Tree search


function MCTS(game, board){
  this.real_game = game;
  this.board = board;

  //Dictionary of move stats. Each entry in the dictionary holds:
  // 0. number of games white won
  // 1. number of games drawn
  // 2. number of games black won
  // 3. average rating of players that played the games
  this.move_stats = {};
  this.stat_idx = {"w":0, "d":1, "b":2};
  this.max_depth = 0
  this.max_calculation_time = 30*1000;  //in milliseconds
  this.max_moves = 1000
  this.exploration = 1.4

  //Updates the AI's game
  //the AI can't see what the other player plays if you don't update it
  this.update_game = function(game){
    this.real_game = game;
  };

  //calculates the best move
  this.get_best_move = function(){

    var possible_moves = this.real_game.moves();
    var player = this.real_game.turn();
    var simulated_game = new Chess(this.real_game.fen());

    //If there's no legal moves, or only one, return early
    if (possible_moves.length == 0){
      return 0;
    }
    if (possible_moves.length == 1){
      return possible_moves[0];
    }

    var possible_fens = new Array(possible_moves.length);

    //get FENs for all possible moves
    var all_moves_in_move_stats = true;
    for (var move_idx = 0; move_idx < possible_moves.length; move_idx++){
      simulated_game.move(possible_moves[move_idx]);
      possible_fens[move_idx] = simulated_game.fen();
      simulated_game.undo();
    }

    var num_simulations = 0;
    //run simulation for this.max_calculation_time
    start_calc_time = Date.now();
    while (Date.now() - start_calc_time < this.max_calculation_time){
      this.simulate_game();
      num_simulations++;
    }

    //get winrates for moves
    var win_rates = new Array(possible_fens.length);
    for (var fen_idx = 0; fen_idx < possible_fens.length; fen_idx++){
        if (!(possible_fens[fen_idx] in this.move_stats)){
            this.move_stats[possible_fens[fen_idx]] = [0,0,0];
        }
        var wins = this.move_stats[possible_fens[fen_idx]][this.stat_idx[player]];
        var num_games = this.move_stats[possible_fens[fen_idx]][0];
        num_games += this.move_stats[possible_fens[fen_idx]][1];
        num_games += this.move_stats[possible_fens[fen_idx]][2];

        if(num_games){
          win_rates[fen_idx] = wins/num_games;
        }
        else {
          win_rates[fen_idx] = 0;
        }
    }

    //find move with best winrates
    var max_win_rate_idx = Math.floor(Math.random() * possible_moves.length);
    for (var j = 0; j < win_rates.length; j++){
        if (win_rates[j] > win_rates[max_win_rate_idx]){
            max_win_rate_idx = j;
        }
    }

    return possible_moves[max_win_rate_idx];
  };

  //runs sumulations on the possible moves from current board state
  this.simulate_game = function(){
    var visited = new Set();
    var simulated_game = new Chess(this.real_game.fen());
    var current_player = simulated_game.turn();

    for (var i = 0; i < this.max_moves; i++){
      var possible_moves = simulated_game.moves();
      var possible_fens = new Array(possible_moves.length);

      //check if all of the moves are in this.move_stats
      //and get FENs for all possible moves

      var all_moves_in_move_stats = true;
      for (var move_idx = 0; move_idx < possible_moves.length; move_idx++){
        simulated_game.move(possible_moves[move_idx]);
        possible_fens[move_idx] = simulated_game.fen();
        if (!(possible_fens[move_idx] in this.move_stats)){
          simulated_game.undo();
          all_moves_in_move_stats = false;
          break;
        }
        simulated_game.undo();
      }



      //if all moves in this.move_stats
      if (all_moves_in_move_stats){
        //choose by UCT
        //sum of all simulated games of the possible FENs
        var sum_simulated_games = 0;
        for (var fen_idx = 0; fen_idx < possible_fens.length; fen_idx++){
            sum_simulated_games += this.move_stats[possible_fens[fen_idx]][0];
            sum_simulated_games += this.move_stats[possible_fens[fen_idx]][1];
            sum_simulated_games += this.move_stats[possible_fens[fen_idx]][2];
        }

        //calculate UCT values
        var ucts = new Array(possible_fens.length);
        for (var fen_idx = 0; fen_idx < possible_fens.length; fen_idx++){
            var num_wins = this.move_stats[possible_fens[fen_idx]][this.stat_idx[current_player]];
            var num_games = 0;
            num_games += this.move_stats[possible_fens[fen_idx]][0];
            num_games += this.move_stats[possible_fens[fen_idx]][1];
            num_games += this.move_stats[possible_fens[fen_idx]][2];
            ucts[fen_idx] = (num_wins/num_games)
            + this.exploration*(Math.sqrt(Math.log(sum_simulated_games)/num_games));
      }

        //find best move (highest UCT value)
        var max_uct_idx = ucts[0];
        for (var j = 0; j < ucts.length; j++){
            if (ucts[j] > ucts[max_uct_idx]){
                max_uct_idx = j;
            }
        }

        var move_to_play = possible_moves[max_uct_idx];

      } else {
        //play random move
        var random_move_idx = Math.floor(Math.random() * possible_moves.length);
        var move_to_play = possible_moves[random_move_idx];
      }
      simulated_game.move(move_to_play);
      visited.add(simulated_game.fen());


      //If game is over, get winner (white, black or draw)
      //TODO: what if game is not over in this.max_moves ???
      if (simulated_game.game_over()){
        if (simulated_game.in_checkmate()){
          if (simulated_game.turn() == 'w'){
            var winner = 'b';
          } else {
            var winner = 'w';
          }
        } else {
          var winner = 'd';
        }
        break;
      }

    }
    //update move_states with all of the visited moves
    for (let fen of visited){
      if (!(fen in this.move_stats)){
        this.move_stats[fen] = [0,0,0];
      }
      this.move_stats[fen][this.stat_idx[winner]]++;
    }
  }

}
