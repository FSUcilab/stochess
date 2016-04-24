//Play a game with random moves until game_ver
//starting from startFen
//returns the winner of the game
function simulate(startFen){
    var game = new Chess(startFen);
    var winner = 'd';
    while (!game.game_over()){
        var possibleMoves = game.moves();
        //play random move
        var randomMoveIdx = Math.floor(Math.random() * possibleMoves.length);
        var moveToPlay = possibleMoves[randomMoveIdx];
        game.move(moveToPlay);

        if (game.in_checkmate()){
            var loser = game.turn();
            //if white lost, then black won.
            //otherwise, white won
            loser == 'w' ? winner = 'b' : winner = 'w';
        }
    }
    return winner;
}
