import { BaseGame } from "./baseGame.js";

export class NumberGuessingGame extends BaseGame {
    constructor(roomId) {
        super(roomId, "numberguess");
        this.reset();
    }

    reset() {
        this.secretNumber = this.generateRandomNumber();
        this.guesses = []; // Array of { role, guess, hint, timestamp }
        this.gameOver = false;
        this.winner = null;
        this.feedback = "";
        this.hints = []; // Keep track of hints separately if needed, or derived from guesses
    }

    generateRandomNumber() {
        return Math.floor(Math.random() * 100) + 1;
    }

    // Helper functions for math logic (same as frontend)
    isPrime(num) {
        if (num <= 1) return false;
        for (let i = 2; i <= Math.sqrt(num); i++) {
            if (num % i === 0) return false;
        }
        return true;
    }

    getDivisors(num) {
        const divisors = [];
        for (let i = 2; i <= 9; i++) {
            if (num % i === 0) divisors.push(i);
        }
        return divisors;
    }

    getDigitSum(num) {
        return String(num)
            .split("")
            .reduce((acc, curr) => acc + parseInt(curr), 0);
    }

    gcd(a, b) {
        return b === 0 ? a : this.gcd(b, a % b);
    }

    hasSharedDigits(num1, num2) {
        const s1 = String(num1).split("");
        const s2 = String(num2).split("");
        return s1.some((d) => s2.includes(d));
    }

    generateSmartHint(userGuess, secret, attempt) {
        const hintsPool = [];

        // 1. Parity (Even/Odd)
        hintsPool.push(() => {
            const isEven = secret % 2 === 0;
            return `The secret number is ${isEven ? "Even" : "Odd"}.`;
        });

        // 2. Prime/Composite
        hintsPool.push(() => {
            return this.isPrime(secret)
                ? "The secret number is a Prime number!"
                : "The secret number is a Composite number (not prime).";
        });

        // 3. Divisibility
        hintsPool.push(() => {
            const divs = this.getDivisors(secret);
            if (divs.length > 0) {
                return `The secret number is divisible by ${divs[Math.floor(Math.random() * divs.length)]}.`;
            } else {
                return "The secret number is not divisible by any digit from 2 to 9.";
            }
        });

        // 4. Digit Sum Comparison
        hintsPool.push(() => {
            const secretSum = this.getDigitSum(secret);
            const guessSum = this.getDigitSum(userGuess);
            if (secretSum === guessSum) return "The digit sum is the same as your guess!";
            return `The digit sum of the secret number is ${secretSum > guessSum ? "higher" : "lower"} than ${guessSum}.`;
        });

        // 5. Distance Category
        hintsPool.push(() => {
            const diff = Math.abs(secret - userGuess);
            if (diff === 0) return "You got it!";
            if (diff <= 5) return "You are BURNING HOT! (Within 5)";
            if (diff <= 10) return "You are Very Close! (Within 10)";
            if (diff <= 25) return "You are Close. (Within 25)";
            return "You are Far away.";
        });

        // 6. Co-prime
        hintsPool.push(() => {
            const isCoprime = this.gcd(secret, userGuess) === 1;
            return isCoprime
                ? `The secret number and ${userGuess} are Co-prime (share no common factors).`
                : `The secret number and ${userGuess} share a common factor > 1.`;
        });

        // 7. Shared Digits
        hintsPool.push(() => {
            return this.hasSharedDigits(secret, userGuess)
                ? "The secret number shares at least one digit with your guess."
                : "The secret number does not share any digits with your guess.";
        });

        // 8. Modulo 7
        hintsPool.push(() => {
            return `The secret number % 7 is ${secret % 7}.`;
        });

        // 9. Range Narrowing (Strongest)
        hintsPool.push(() => {
            const lower = Math.max(1, secret - Math.floor(Math.random() * 5 + 1));
            const upper = Math.min(100, secret + Math.floor(Math.random() * 5 + 1));
            return `The number is between ${lower} and ${upper}.`;
        });

        let selectedHint = "";

        if (attempt === 1) {
            const idx = Math.random() < 0.5 ? 0 : 1;
            selectedHint = hintsPool[idx]();
        } else if (attempt === 2) {
            const idx = Math.random() < 0.5 ? 2 : 3;
            selectedHint = hintsPool[idx]();
        } else if (attempt === 3) {
            const idx = Math.random() < 0.5 ? 4 : 5;
            selectedHint = hintsPool[idx]();
        } else if (attempt === 4) {
            const idx = Math.random() < 0.5 ? 6 : 7;
            selectedHint = hintsPool[idx]();
        } else {
            selectedHint = hintsPool[8]();
        }

        return selectedHint;
    }

    makeGuess(role, guess) {
        if (this.gameOver) return { success: false, message: "Game is over" };

        const num = parseInt(guess);
        if (isNaN(num)) return { success: false, message: "Invalid number" };

        if (this.guesses.some(g => g.guess === num)) {
            return { success: false, message: "Number already guessed" };
        }

        const attemptsUsed = this.guesses.length + 1;
        let hint = "";
        let feedback = "";

        if (num === this.secretNumber) {
            this.winner = role;
            this.gameOver = true;
            feedback = "Correct! You found the number!";
        } else {
            if (attemptsUsed >= 5) {
                this.gameOver = true;
                feedback = `Game Over! The number was ${this.secretNumber}.`;
            } else {
                const dir = num < this.secretNumber ? "Higher ⬆️" : "Lower ⬇️";
                hint = this.generateSmartHint(num, this.secretNumber, attemptsUsed);
                feedback = dir;
            }
        }

        this.guesses.push({
            role,
            guess: num,
            hint,
            feedback,
            timestamp: Date.now()
        });

        this.feedback = feedback;

        return { success: true };
    }

    toJSON() {
        return {
            id: this.id,
            gameType: this.gameType,
            players: this.players,
            winner: this.winner,
            guesses: this.guesses,
            gameOver: this.gameOver,
            feedback: this.feedback,
            secretNumber: this.gameOver ? this.secretNumber : null
        };
    }
}
