import { BaseGame } from "./baseGame.js";

export class CoopDiceGame extends BaseGame {
    constructor(roomId, options = {}) {
        super(roomId, "coopdice");
        this.reset();
    }

    reset() {
        this.state = {
            board: this.generateBoard(),
            players: {
                he: { pos: { x: 0, y: 0 }, currentRoll: null, frozen: false, bonuses: [] },
                she: { pos: { x: 0, y: 0 }, currentRoll: null, frozen: false, bonuses: [] },
            },
            currentTurn: "he",
            turnsLeft: 30, // Reset to 30 for balanced gameplay on 6x6 grid
            gameStatus: "playing", // playing, won, lost
            activePuzzle: null,
            logs: ["Welcome to the Jungle Playground! �"],
        };
        this.winner = null;
    }

    generateBoard() {
        // 6x6 Grid = 36 Tiles
        // 0,0 is Start (Index 0). 5,5 is End (Index 35).
        const tiles = [];
        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 6; x++) {
                tiles.push({
                    type: "normal",
                    id: y * 6 + x,
                    x: x,
                    y: y
                });
            }
        }

        // Pool of all content
        const allPuzzles = [
            // Riddles
            { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", a: "echo" },
            { q: "The more of this there is, the less you see. What is it?", a: "darkness" },
            { q: "I have keys but no locks. I have a space but no room. You can enter, but can’t go outside. What am I?", a: "keyboard" },
            { q: "What has to be broken before you can use it?", a: "egg" },
            { q: "I’m tall when I’m young, and I’m short when I’m old. What am I?", a: "candle" },
            { q: "What comes once in a minute, twice in a moment, but never in a thousand years?", a: "m" },
            { q: "I am not alive, but I grow; I don't have lungs, but I need air; I don't have a mouth, but water kills me. What am I?", a: "fire" },
            { q: "What has many keys but can't open a single lock?", a: "piano" },
            { q: "What has a head and a tail but no body?", a: "coin" },
            { q: "What gets wetter as it dries?", a: "towel" },

            // Math
            { q: "Math: lim(x→3) (x² - 9) / (x - 3) = ?", a: "6" },
            { q: "Math: ∫(0 to 2) 3x² dx = ?", a: "8" },
            { q: "Math: log₂(32) = ?", a: "5" },
            { q: "Math: If f(x) = 2x + 1, what is f(3)?", a: "7" },
            { q: "Math: d/dx (sin x) at x=0. (cos 0) = ?", a: "1" },
            { q: "Math: √64 = ?", a: "8" },
            { q: "Math: 2³ = ?", a: "8" },
            { q: "Math: d/dx (x²) at x=3 = ?", a: "6" },
            { q: "Math: lim(x→∞) (4x + 1)/(x - 2) = ?", a: "4" },
            { q: "Math: 5! / 4! = ?", a: "5" },
            { q: "Math: sin(90°) = ?", a: "1" },
            { q: "Math: 7 mod 4 = ?", a: "3" },
            { q: "Math: | -9 | = ?", a: "9" },
            { q: "Math: 3² - 2³ = ?", a: "1" }
        ];

        const monsters = [
            "Swamp Beast 👹", "Venomous Snake 🐍", "Giant Spider 🕷️", "Ancient Treant 🌳",
            "Shadow Stalker 👻", "Jungle Guardian 🗿", "Rabid Wolf 🐺", "Poison Frog 🐸"
        ];

        // Shuffle Puzzles (Fisher-Yates)
        for (let i = allPuzzles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPuzzles[i], allPuzzles[j]] = [allPuzzles[j], allPuzzles[i]];
        }

        // Select random spots for puzzles (avoid Start 0,0 and End 5,5)
        // Start is index 0. End is index 35.
        const puzzleIndices = new Set();
        while (puzzleIndices.size < 15) { // Increase density for playground
            const idx = Math.floor(Math.random() * 34) + 1; // 1 to 34
            puzzleIndices.add(idx);
        }

        let pIdx = 0;
        puzzleIndices.forEach(idx => {
            if (pIdx < allPuzzles.length) {
                const monster = monsters[Math.floor(Math.random() * monsters.length)];
                tiles[idx] = {
                    type: "puzzle",
                    riddle: allPuzzles[pIdx].q,
                    answer: allPuzzles[pIdx].a,
                    id: idx,
                    monster: monster,
                    x: idx % 6,
                    y: Math.floor(idx / 6)
                };
                pIdx++;
            }
        });

        return tiles;
    }

    rollDice(role) {
        if (this.state.gameStatus !== "playing") return;
        if (this.state.currentTurn !== role) return;
        if (this.state.players[role].currentRoll !== null) return; // Already rolled

        if (this.state.players[role].frozen) {
            this.addLog(`${role === 'he' ? 'He' : 'She'} is frozen! Skip turn.`);
            this.state.players[role].frozen = false; // Unfreeze after skipping
            this.endTurn();
            return;
        }

        const roll = Math.floor(Math.random() * 6) + 1;
        this.state.players[role].currentRoll = roll;
        this.addLog(`${role === 'he' ? 'He' : 'She'} rolled a ${roll} 🎲`);

        this.updateState({ players: this.state.players });
    }

    move(role, targetId) {
        if (this.state.gameStatus !== "playing") return;
        if (this.state.currentTurn !== role) return;

        const player = this.state.players[role];
        const roll = player.currentRoll;

        if (roll === null) return; // Must roll first

        // Validate Move
        const targetTile = this.state.board.find(t => t.id === targetId);
        if (!targetTile) return;

        const currentPos = player.pos;
        const distance = Math.abs(targetTile.x - currentPos.x) + Math.abs(targetTile.y - currentPos.y);

        if (distance > roll) {
            // Invalid move (too far) - Frontend should prevent this, but backend check needed
            return;
        }

        // Move Player
        player.pos = { x: targetTile.x, y: targetTile.y };
        player.currentRoll = null; // Consume roll

        this.addLog(`${role === 'he' ? 'He' : 'She'} moved to (${targetTile.x}, ${targetTile.y})`);

        // Check Win (Both at 5,5)
        if (targetTile.x === 5 && targetTile.y === 5) {
            this.addLog(`${role === 'he' ? 'He' : 'She'} reached the extraction point! 🚁`);
            this.checkWin();
            this.endTurn();
            return;
        }

        // Handle Tile Effects
        if (targetTile.type === "puzzle") {
            this.state.activePuzzle = { ...targetTile, solver: role, attemptsLeft: 3 };
            this.addLog(`A ${targetTile.monster} blocks the path! 😱`);
        }

        this.updateState({ players: this.state.players, board: this.state.board, activePuzzle: this.state.activePuzzle });

        if (!this.state.activePuzzle) {
            this.endTurn();
        }
    }

    solvePuzzle(role, answer) {
        if (!this.state.activePuzzle) return;
        if (this.state.activePuzzle.solver !== role) return;

        if (answer.toLowerCase().trim() === this.state.activePuzzle.answer) {
            this.addLog(`${this.state.activePuzzle.monster} defeated! You survive. ⚔️`);
            this.state.activePuzzle = null;
            this.endTurn();
        } else {
            this.state.activePuzzle.attemptsLeft--;
            if (this.state.activePuzzle.attemptsLeft <= 0) {
                this.addLog(`The ${this.state.activePuzzle.monster} KILLED you! �`);
                this.addLog(`Respawning at start...`);
                this.updatePlayerPos(role, { x: 0, y: 0 }); // PERMADEATH: Back to 0,0
                this.state.activePuzzle = null;
                this.endTurn();
            } else {
                this.addLog(`Wrong! The monster growls. ${this.state.activePuzzle.attemptsLeft} attempts left. ⚠️`);
            }
        }
        this.updateState({ activePuzzle: this.state.activePuzzle, players: this.state.players });
    }

    updatePlayerPos(role, pos) {
        this.state.players[role].pos = pos;
    }

    endTurn() {
        this.state.turnsLeft--;
        if (this.state.turnsLeft <= 0) {
            this.state.gameStatus = "lost";
            this.addLog("Time ran out! Game Over 💔");
        } else {
            this.state.currentTurn = this.state.currentTurn === "he" ? "she" : "he";
        }
        this.updateState({
            currentTurn: this.state.currentTurn,
            turnsLeft: this.state.turnsLeft,
            gameStatus: this.state.gameStatus
        });
    }

    async handleAction(action, payload) {
        const { role, targetId, answer } = payload || {};

        switch (action) {
            case "roll":
                this.rollDice(role);
                break;
            case "move":
                this.move(role, targetId);
                break;
            case "solve":
                this.solvePuzzle(role, answer);
                break;
            case "reset":
                this.reset();
                this.updateState({
                    board: this.state.board,
                    players: this.state.players,
                    gameStatus: this.state.gameStatus,
                    activePuzzle: null,
                    logs: this.state.logs
                });
                break;
            default:
                console.warn(`Unknown action: ${action}`);
        }
        return { success: true };
    }

    checkWin() {
        const p = this.state.players;
        // End is at (5,5)
        if (p.he.pos.x === 5 && p.he.pos.y === 5 && p.she.pos.x === 5 && p.she.pos.y === 5) {
            this.state.gameStatus = "won";
            this.winner = "both"; // Cooperative win
            this.addLog("YOU BOTH MADE IT! VICTORY! 🏆💑");
            this.updateState({ gameStatus: "won", winner: "both" });
        }
    }

    toJSON() {
        return {
            ...super.toJSON(),
            ...this.state
        };
    }

    addLog(msg) {
        this.state.logs.unshift(msg);
        if (this.state.logs.length > 10) this.state.logs.pop();
        this.updateState({ logs: this.state.logs });
    }
}
