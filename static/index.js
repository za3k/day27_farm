'use strict';

class Rng {
    Random() {
        return Math.random();
    }
    flip(p) {
        p ||= 0.5;
        return this.Random() < p;
    }
    randInt(min, max) { // inclusive
        return Math.floor(this.randFloat(min, max+1));
    }
    randFloat(min, max) {
        return this.Random()*(max-min)+min;
    }
    weighted(a) {
        let sum = 0;
        for (let i=0; i<a.length; i++) sum += a[i][0];
        let t = this.randInt(0, sum);
        for (let i=0; i<a.length; i++) {
            t-= a[i][0];
            if (t<=0) return a[i][1];
        }
    }
}

// Snake
class Game {
    static startState = {
        boardSize: [10,10],
        fruits: [[8, 8]],
        fruitColors: ["rgb(255,0,0)"],
        snake: [[5, 5]], // From tail to head
        snakeColors: ["rgb(50,200,50)"], // From head to tail
        snakeDir: [1, 0],
        snakeAlive: true,
        score: 0
    }
    static lost(game) {
        return !game.snakeAlive;
    }
    static snakeColor(rng) {
        return `rgb(${rng.randFloat(0,150)}, ${rng.randFloat(150,255)}, ${rng.randFloat(0,150)})`
    }
    static fruitColor(rng) {
        return `rgb(${rng.randFloat(100,255)}, ${rng.randFloat(0,100)}, ${rng.randFloat(0,100)})`
    }
    static clone(state) {
        return JSON.parse(JSON.stringify(state))
    }
    static newState(rng) {
        return Game.clone(Game.startState);
        // Snake
    }
    static tick(state, rng, keys) {
        // state, rng -> state
		keys = {left: false, right: false, down: false, up: false, z: false, x: false, c: false, ...keys};
        if (!state.snakeAlive) return state;
        const s = Game.clone(state);

        const is = (group, tile) => group.some(e => (e[0] == tile[0] && e[1] == newTile[1]));
        const find = (group, tile) => group.findIndex(e => e[0] == tile[0] && e[1] == newTile[1]);
        const isSnake = tile => is(s.snake, tile)
        const isFruit = tile => is(s.fruits, tile)
        const findFruit = tile => find(s.fruits, tile)
        const inBounds = tile => newTile[0] >= 0 && newTile[0] < s.boardSize[0] && newTile[1] >= 0 && newTile[1] < s.boardSize[1];
        const randomTile = () => [rng.randInt(0, s.boardSize[0]-1), rng.randInt(0, s.boardSize[1]-1)];
        const oppositeDir = (d1, d2) => d1[0]==-d2[0] && d1[1]==-d2[1];
        const snakeHead = s.snake[s.snake.length-1];
        const move = (t, d) => [t[0]+d[0], t[1]+d[1]];
        function addFruit() {
            let tile;
            do {
                tile = randomTile()
            } while (isSnake(tile) || isFruit(tile));
            s.fruits.push(tile);
            s.fruitColors.push(Game.fruitColor(rng));
        }

        // Randomize fruit colors every tick
        for (let i=0; i<s.fruits.length; i++) s.fruitColors[i] = Game.fruitColor(rng);

        // Simulate a random keypress
        //const key = ["left", "right", "down", "up"]
        const key = rng.weighted([ 
            [1, [-1, 0]],
            [1, [1, 0]],
            [1, [0, -1]],
            [1, [0, 1]],
            [6, s.snakeDir], // 80% chance to go the same way
        ])
        // Move
        if (!oppositeDir(key, s.snakeDir)) s.snakeDir = key;
        const newTile = move(snakeHead, s.snakeDir);

        // Evaluate the new square
        if (isSnake(newTile) || !inBounds(newTile)) {
            s.snakeAlive = false;
            return s;
        }
        s.score++;

        if (isFruit(newTile)) {
            const fruitIndex = findFruit(newTile);
            s.fruits.splice(fruitIndex,1);
            s.fruitColors.splice(fruitIndex,1);
            s.score += 100;
            s.snake.push(newTile);
            s.snakeColors.push(Game.snakeColor(rng));
            
            // Add new random fruit
            addFruit();
        } else {
            s.snake.shift();
            s.snake.push(newTile);
        }

        if (rng.flip(0.01)) addFruit(); // Sometimes add a new fruit at random


        return s;
    }
    static render(div, state) {
        // div, state -> none(
        const height = $(div).height(), width = $(div).width();
        div = d3.select(div)

        const size = 10;
        const gap = 1;
        let bits = [];
        for (let i=0; i<state.snake.length; i++) { // Head to tail
            const [x,y]=state.snake[state.snake.length-i-1], color=state.snakeColors[i];
            bits.push([x,y,color]);
        }
        for (let i=0; i<state.fruits.length; i++) {
            const [x,y]=state.fruits[i], color=state.fruitColors[i];
            bits.push([x,y,color]);
        }

        const gameWidth = size*state.boardSize[0]+gap*(state.boardSize[0]-1);
        const gameHeight = size*state.boardSize[1]+gap*(state.boardSize[1]-1);

        const margin = {
            top: 20,
            bottom: (height-gameHeight-20),
            left: (width-gameWidth)/2,
            right: (width-gameWidth)/2,
        }

        const dot = div.selectAll(".dot").data(bits);
        function makeUpdate(c, t, f) {
            [c.enter().append(t), c].forEach(f);
        }
        makeUpdate(dot, "rect", function(x) {
            x.attr("width", size)
            .attr("class", "dot")
            .attr("height", size)
            .attr("x", (d,i) => d[0]*(size+gap)+margin.left)
            .attr("y", (d,i) => d[1]*(size+gap)+margin.top)
            .style("fill", (d, i) => d[2]);
        })
        dot.exit().remove();

        makeUpdate(div.selectAll(".label").data([null]), "text", (d) => d.attr("class", "label")
            .attr("x", width/2)
            .attr("y", margin.top/2)
            .attr("font", "monospace")
            .attr("width", width)
            .attr("text-anchor", "middle")
            .style("alignment-baseline", "middle")
            .text("snek")
        );
        makeUpdate(div.selectAll(".score").data([null]), "text", (d) => d.attr("class", "score")
            .attr("x", width - 20)
            .attr("y", margin.top+gameHeight+margin.bottom/2+2)
            .attr("font", "monospace")
            .attr("width", width)
            .attr("text-anchor", "end")
            .style("alignment-baseline", "middle")
            .text(state.score)
        );
        makeUpdate(div.selectAll(".life").data([state.snakeAlive]), "text", d => d.attr("class", "life")
            .attr("x", 20)
            .attr("y", margin.top+gameHeight+margin.bottom/2+2)
            .attr("font", "monospace")
            .attr("width", width)
            .attr("text-anchor", "start")
            .style("alignment-baseline", "middle")
            .attr("fill", v => v ? "green" : "red")
            .text(v => v ? "ALIVE" : "DEAD")
        );
        div.selectAll(".border").data([null]).enter().append("rect").attr("class", "border")
            .attr("x", margin.left-1)
            .attr("y", margin.top-1)
            .attr("height", height-margin.bottom-margin.top+2)
            .attr("width", width-margin.left-margin.right+2)
            .attr("stroke-width", 2)
            .attr("stroke", "black")
            .style("fill", "none");
    }
}

function error(e) {
    $(".error").text(e || "");
}

function save(slot, state) {
    localStorage.setItem(slot, JSON.stringify(state));
}

function load(slot) {
    const text = localStorage.getItem(slot);
    if (text) return JSON.parse(text);
}
function clear(slot) {
    localStorage.removeItem(slot);
}

const game = new Game();
function main() {
    let state;
    const rng = new Rng();
    let autorun = false; // Run automatically, instead of tick-by-tick
    let autorestart = false; // Restart on death
    let autoreload = false; // Reload on death (from slot 1)
    let autoreloadSlot = 1;

    function restart() {
        state = window.state = Game.newState();
        Game.render($("#game")[0], state);
    }
    function step() {
        state = window.state = Game.tick(state, rng);
        Game.render($("#game")[0], state);
    }

    setInterval(() => { if (autorun) step(); }, 200);
    restart();

    $(".save").on("click", (ev) => {
		save(1, state);
		Game.render($(".preview"), previewState);
        $(".btn").toggleClass("full", true);
    });
    $(".load").on("click", (ev) => {
		state = window.state = load(1);
		Game.render($("#game")[0], state);
    });
    $(".clear").each((i, e) => {
		clear(1);
		$(".preview").empty();
        $(".btn").toggleClass("full", false);
    });
    $(".btn").toggleClass("full", !!load(1));

    $(".tick").on("click", step);
    $(".restart").on("click", restart);
    $(".run").on("click", () => {
        autorun = true;
        $(".run").hide();
        $(".pause").show();
    });
    $(".pause").on("click", () => {
        autorun = false;
        $(".run").show();
        $(".pause").hide();
    });
}

(function() {
    function docReady(fn) { // https://stackoverflow.com/questions/9899372/vanilla-javascript-equivalent-of-jquerys-ready-how-to-call-a-function-whe. Avoiding jquery because it's messing up error display
        // see if DOM is already available
        if (document.readyState === "complete" || document.readyState === "interactive") {
            // call on next available tick
            setTimeout(fn, 1);
        } else {
            document.addEventListener("DOMContentLoaded", fn);
        }
    }
    docReady(main);
})();

