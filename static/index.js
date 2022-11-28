'use strict';

function debug(e) {
    $(".error").text(e || "");
}

function n(i, x) { return Array.from(Array(i), () => x); }
class Rng {
    Random() { return Math.random(); }
    flip(p) { return this.Random() < (p||0.5); }
    randInt(min, max) { return Math.floor(this.randFloat(min, max+1)); } // Inclusive
    randFloat(min, max) { return this.Random()*(max-min)+min; }
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
class GameKeys {
    bindings = {
        65: "left", 87: "up", 68: "right", 83: "down", // WASD
        37: "left", 38: "up", 39: "right", 40: "down", // Arrow keys
        90: "z", 88: "x", 67: "c", // Action keys
    }
    pressed = {} // was pressed this tick
    down = {}
    constructor(element = document) {
        document.addEventListener("keydown", e => {
            this.pressed[e.keyCode] = this.down[e.keyCode] = true
            if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) e.preventDefault(); // Don't scroll
        });
        document.addEventListener("keyup", e => this.down[e.keyCode] = false);
    }
    keys() {
        const output = {}
        for (const [code, name] of Object.entries(this.bindings))
            if (this.pressed[code]) output[name] = true;
        //this.pressed = {...this.down}; // Clear old pressed keys, but allow holding
        this.pressed = {}; // Don't allow holding.
        return output;
    }
    oneKey() {
        const keys = this.keys();
        for (let key in keys)
            if (keys[key]) return key;
        return "nothing";
    }
}

class Tile { // Static, non-animated tile
    constructor(image, pixel, xindex, yindex) {
        this.offset = { x: xindex*pixel, y: yindex*pixel };
        this.size = { width: pixel, height: pixel };
        this.image = image;
    }
    get tile() { return this; }
}
class AnimatedTile {
    constructor(tiles) {
        this.tiles = tiles;
        this.ticks = 0;
    }
    get tile() { // Just make sure to call this once per tick exactly!
        return this.tiles[this.ticks++ % this.tiles.length];
    }
}

const Farm = document.getElementById("farm");

const TILE = {
    grass: new Tile(Farm, 16, 1, 1),
    grassTop: new Tile(Farm, 16, 1, 0),
    grassTopLeft: new Tile(Farm, 16, 0, 0),
    grassTopRight: new Tile(Farm, 16, 2, 0),
    grassBottom: new Tile(Farm, 16, 1, 2),
    grassBottomLeft: new Tile(Farm, 16, 0, 2),
    grassBottomRight: new Tile(Farm, 16, 2, 2),
    grassLeft: new Tile(Farm, 16, 0, 1),
    grassRight: new Tile(Farm, 16, 2, 1),
    player_left_standing: new Tile(Farm, 16, 0, 9),
    player_right_standing: new Tile(Farm, 16, 0, 8),
    player_left_walking: new AnimatedTile([
        new Tile(Farm, 16, 0, 9),
        new Tile(Farm, 16, 1, 9),
        new Tile(Farm, 16, 2, 9),
        new Tile(Farm, 16, 3, 9),
    ]),
    player_right_walking: new AnimatedTile([
        new Tile(Farm, 16, 0, 8),
        new Tile(Farm, 16, 1, 8),
        new Tile(Farm, 16, 2, 8),
        new Tile(Farm, 16, 3, 8),
    ]),
    X: new Tile(Farm, 16, 0, 3),
    dirt: new Tile(Farm, 16, 5, 0),
    potatoSeed: new Tile(Farm, 16, 4, 8),
    tomatoSeed: new Tile(Farm, 16, 4, 9),
    potato: new Tile(Farm, 16, 11, 8),
    tomato: new Tile(Farm, 16, 11, 9),
}
for (let r=0; r<5; r++)
    for (let c=0; c<4; c++)
        TILE[`shed${r}${c}`] = new Tile(Farm, 16, 0+c, 3+r);
for (let s=0; s<6; s++) TILE[`potatoGrowth${s}`] = new Tile(Farm, 16, 5+s, 8);
for (let s=0; s<6; s++) TILE[`tomatoGrowth${s}`] = new Tile(Farm, 16, 5+s, 9);

class Item {
    constructor(tile) {
        this.tile = tile
    }
    isAfter(ticks, earlyTile) {
        const early = new Item(earlyTile);
        early.ticksRemaining = ticks;
        early.replacement = this;
        return early;
    }
}

class Game {
    static potato = new Item("potatoGrowth5")
        .isAfter(10, "potatoGrowth4")
        .isAfter(10, "potatoGrowth3")
        .isAfter(10, "potatoGrowth2")
        .isAfter(10, "potatoGrowth1")
        .isAfter(10, "potatoGrowth0");
    static tomato = new Item("tomatoGrowth5")
        .isAfter(10, "tomatoGrowth4")
        .isAfter(10, "tomatoGrowth3")
        .isAfter(10, "tomatoGrowth2")
        .isAfter(10, "tomatoGrowth1")
        .isAfter(10, "tomatoGrowth0");
    static initState = { // [y, x] or [r, c] where x=0 is the left, and y=0 is the top
        boardSize: [11,10],
        // Background you walk over (Layer 0). Immutable.
        landscape: [
            // What the hell javascript, why is ["the"] + ["dog"] equal to "thedog".
            ["grassTopLeft", ...n(8, "grassTop"), "grassTopRight"], 
            ...n(8, ["grassLeft", ... n(8, "grass"), "grassRight"]), // These are copies of the same thing, but it's immutable so it's ok
            ["grassBottomLeft", ...n(8, "grassBottom"), "grassBottomRight"],
            n(10, null)
        ],
        // Foreground you can't interact with or walk on (Layer 1). Immutable.
        buildings: [
            ["", "shed00", "shed01", "shed02", "shed03", ...n(5, "")],
            ["", "shed10", "shed11", "shed12", "shed13", ...n(5, "")],
            ["", "shed20", "shed21", "shed22", "shed23", ...n(5, "")],
            ["", "shed30", "shed31", "shed32", "shed33", ...n(5, "")],
            ["", "shed40", "shed41", "shed42", "shed43", ...n(5, "")],
            ...n(5, n(10, "")),
            n(10, "X")
        ],
        // Objects that exist and you can interact with (Layer 2). Mutable.
        items: Array.from(Array(11), ()=>new Array(10)), 
        // Player. (Layer 3). Mutable.
        playerTile: "player_right_standing",
        // Status bar at the bottom. (Layer 4) Immutable.
        statusBar: ["potato", "", "", "", "tomato", "", "", "", "", ""],//dirt"],
        // Inventory at the bottom. (Layer 5). Mutable.
        inventoryTile: "potatoSeed",

        player: [5,5], // Player position (Layer 3)
        playerDir: [1,0], // Player facing right
        score: {
            "potato": 0,
            "tomato": 0,
        },
        playerFacing: "right",
        playerWalking: 0,
        inventory: ["potatoSeed", "tomatoSeed", "X"],
        inventorySelected: 0,
    }
    static clone(state) {
        const x = JSON.parse(JSON.stringify(state))
        if (!x) debugger;
        //if (!state.landscape[0][0]) debugger;
        return x;
    }
    static layers(state) {
        // Layer 0: Background
        // Layer 1: Buildings
        // Layer 2: Items
        // Layer 3: Player
        // Layer 4: Status Bar (+ inventory background)
        // Layer 5: Inventory
        const emptyLayer = ()=>Array.from(Array(state.boardSize[0]), ()=>new Array(state.boardSize[1]));
        const layers = Array.from(Array(6), emptyLayer);
        for (let r=0; r<state.boardSize[0]; r++) {
            for (let c=0; c<state.boardSize[1]; c++) {
                layers[0][r][c] = TILE[state.landscape[r][c]];
                layers[1][r][c] = TILE[state.buildings[r][c]];
                const item = state.items[r][c];
                if (item) layers[2][r][c] = TILE[item.tile];
            }
        }
        layers[3][state.player[0]][state.player[1]] = TILE[state.playerTile];
        for (let c=0; c<state.boardSize[1]; c++) {
            layers[4][state.boardSize[0]-1][c] = TILE[state.statusBar[c]];
        }
        layers[5][state.boardSize[0]-1][state.boardSize[1]-1] = TILE[state.inventoryTile];
        return layers;
    }
    static newState(rng) {
        return Game.clone(Game.initState);
    }
    static tick(state, rng, key) {
        // state, rng -> state
        const s = Game.clone(state);

        // Helper functions
        const between = (l, x, m) => (l <= x) && (x < m);
        const inBounds = (t) => between(0, t[0], s.boardSize[0]) && between(0, t[1], s.boardSize[1]);
        const move = (t, d) => [t[0]+d[0], t[1]+d[1]];
        const same = (t1, t2) => t1[0]==t2[0] && t1[1]==t2[1];
        const place = (t, i) => s.items[t[0]][t[1]] = i;
        const remove = () => place(targetTile, null)
        const get = (t) => s.items[t[0]][t[1]]
        const eachTile = function(f) {
            for (let r=0; r<s.boardSize[0]; r++)
                for (let c=0; c<s.boardSize[1]; c++) f([r,c]);
        }


        function walkable([i,j]) {
            if (state.buildings[i][j]) return false;
            const item = state.items[i][j];
            if (item && !item.walkable) return false;
            return true;
        }

        // Keyboard input
        const inputDir = { "left": [0, -1], "right": [0, 1], "up": [-1, 0], "down": [1, 0] }[key];

        // Rotate
        s.playerDir = inputDir || s.playerDir;
        s.playerFacing = { "left": "left", "right": "right" }[key] || s.playerFacing;
        // Move
        const dir = inputDir || [0,0];
        const newTile = move(state.player, dir);
        if (inBounds(newTile) && walkable(newTile) && !same(newTile, s.player)) {
            s.player = newTile;
            s.walking = 5; // Walk a few ticks, then stop walking
        } else if (s.walking) s.walking--;
        s.playerTile = `player_${s.playerFacing}${s.walking ? "_walking" : "_standing"}`;

        // See what we're looking at now
        const targetTile = move(state.player, s.playerDir);
        const targetItem = inBounds(targetTile) ? get(targetTile) : null;
        let item = s.inventory[s.inventorySelected];
        if (key=="z" && targetItem) { // Pick up
            const action = {
                "potatoGrowth5": () => { s.score.potato++; remove() },
                "tomatoGrowth5": () => { s.score.tomato++; remove() },
            }[targetItem.tile]
            if (action) action();
        } else if (key=="x") { // Use
            if (item == "potatoSeed" && !targetItem) place(targetTile, Game.clone(Game.potato));
            if (item == "tomatoSeed" && !targetItem) place(targetTile, Game.clone(Game.tomato));
        } else if (key=="c") { // Cycle inventory
            s.inventorySelected = (s.inventorySelected + 1) % s.inventory.length;
            item = s.inventory[s.inventorySelected];
        }
        s.inventoryTile = item;

        // Grow crops
        eachTile(t => {
            const tickItem = get(t);
            if (!tickItem) return;
            if (tickItem.ticksRemaining > 0) {
                tickItem.ticksRemaining--;
                if (tickItem.ticksRemaining == 0) place(t, tickItem.replacement);
            }
        })

        return s;
    }
    static render(div, state) {
        // div, state -> none(
        const height = $(div).height(), width = $(div).width();
        div = d3.select(div)
        div.style("position", "relative");

        const maxTileHeight = (height-20)/state.boardSize[0];
        const maxTileWidth = width/state.boardSize[1];
        const maxTileSize = Math.min(maxTileWidth, maxTileHeight);
        const size = Math.pow(2, Math.floor(Math.log(maxTileSize)/Math.log(2))); // 16-pixel, 32-pixel, or 64-pixel? Scale smoothly.
        const gap = { 64: 1, 32: 1, 16: 0 }[size] || 0;
        
        const layers = Game.layers(state);
        let tiles = [];
        for (let layer = 0; layer<layers.length; layer++) { // Order 0..3 is important
            for (let r=0; r<state.boardSize[0]; r++) {
                for (let c=0; c<state.boardSize[0]; c++) {
                    if (!layers[layer][r][c]) continue; // Don't draw blank tiles
                    const tile = layers[layer][r][c].tile; // Animate tiles
                    tiles.push({tile, layer, r, c});
                }
            }
        }

        const gameHeight = size*state.boardSize[0]+gap*(state.boardSize[0]-1);
        const gameWidth = size*state.boardSize[1]+gap*(state.boardSize[1]-1);
        const margin = {
            top: 20,
            bottom: (height-gameHeight-20),
            left: (width-gameWidth)/2,
            right: (width-gameWidth)/2,
        }

        function makeUpdate(c, t, f) {
            [c.enter().append(t), c].forEach(f);
            //c.exit().remove();
        }

        makeUpdate(div.selectAll(".tile").data(tiles), "div", (d) => d.attr("class", "tile")
            .style("position", "absolute")
            .style("left", d => `${margin.left + d.c*(size+gap)}px`)
            .style("top", d => `${margin.top + d.r*(size+gap)}px`)
            .style("width", d => `${d.tile.size.width}px`)
            .style("height", d => `${d.tile.size.height}px`)
            .style("background-image", d => `url(${d.tile.image.src})`)
            .style("background-position", d=> `top ${-d.tile.offset.y}px left ${-d.tile.offset.x}px`)
            .style("transform", d=> `scale(${size/d.tile.size.width})`)
            .style("transform-origin", "top left")
        );

        // Score
        const scores = [
            { score: state.score.potato, x: 1, y: state.boardSize[0]-1 },    
            { score: state.score.tomato, x: 5, y: state.boardSize[0]-1 },    
        ];
        makeUpdate(div.selectAll(".score").data(scores), "div", (d) => d.attr("class", "score")
            .style("color", "black")
            .style("position", "absolute")
            .style("top", d=> `${margin.top + (size+gap)*d.y}px`)
            .style("left", d=> `${margin.left + (size+gap)*d.x}px`)
            .style("height", `${size}px`)
            .style("line-height", `${size}px`)
            .style("text-align", "center")
            .text(d => `x ${d.score}`)
        );
        makeUpdate(div.selectAll(".label").data([null]), "div", (d) => d.attr("class", "label")
            .style("color", "black")
            .style("position", "absolute")
            .style("display", "block")
            .style("width", "100%")
            .style("text-align", "center")
            .style("font-family", "monospace")
            .text("hack-a-walk")
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

function main() {
    // Main game loop
    let state;
    const gameKeys = window.gameKeys = new GameKeys();
    const rng = new Rng();
    let autorun = false; // Run automatically, instead of tick-by-tick1
    function display() {
        Game.render($("#game")[0], state);
    }
    function restart() {
        state = window.state = Game.newState();
        display();
    }
    function step() { // Execute and display one tick
        const key = gameKeys.oneKey();
        state = window.state = Game.tick(state, rng, key);
        display();
    }
    function load(slot) {
        const text = localStorage.getItem(slot);
        if (text) return JSON.parse(text);
    }

    // UI buttons
    $(".btn").toggleClass("full", !!load(1));
    if (!!load(1)) Game.render($(".preview")[0], load(1));

    const action = {
        restart, step,
        run: function() {
            autorun = true;
            $(".run").hide();
            $(".pause").show();
        },
        pause: function() {
            autorun = false;
            $(".run").show();
            $(".pause").hide();
        },
        clear: function() {
            localStorage.removeItem(1);
            $(".preview").empty();
            $(".btn").toggleClass("full", false);
        },
        save: function() {
            localStorage.setItem(1, JSON.stringify(state));
            Game.render($(".preview")[0], state);
            $(".btn").toggleClass("full", true);
        },
        load: function() {
            state = window.state = load(1);
            display();
        },

    }
    $(".save").on("click", action.save);
    $(".load").on("click", action.load);
    $(".clear").on("click", action.clear);
    $(".run").on("click", action.run);
    $(".pause").on("click", action.pause);
    $(".step").on("click", action.step);
    $(".restart").on("click", action.restart);

    let started=false;
    $(document).on("keydown", (ev) => {
        if (ev.keyCode == 82) action.restart(); // R = restart
        if (!started) action.run(); // Automatically start on user input
    })

    // Main loop
    setInterval(() => { if (autorun) step() }, 200);
    restart();
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

