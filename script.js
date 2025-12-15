document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("Script loaded");
        const gridEl = document.getElementById('grid');
        const stripEl = document.getElementById('strip');
        const currentScoreEl = document.getElementById('current-score');
        const highScoreEl = document.getElementById('high-score');
        const mistakesEl = document.getElementById('mistakes');
        const newGameBtn = document.getElementById('new-game-btn');
        const modal = document.getElementById('modal');
        const modalRestartBtn = document.getElementById('modal-restart-btn');
        const diffBtns = document.querySelectorAll('.diff-btn');

        if (!gridEl || !stripEl) {
            alert("Critical Error: Grid or Strip elements not found!");
            return;
        }

        let gridValues = [];
        let stripValues = [];
        let selectedStripIndices = [];

        // Game State
        let pairsFound = 0;
        let currentRoundScore = 0;
        let mistakes = 0;
        let startTime = 0;
        let foundExtraSolutions = new Set(); // Store hashes of found extra solutions to prevent farming

        // Game Config
        let currentLevel = 'easy';
        const TOTAL_PAIRS = 8;
        const MAX_MISTAKES = 3;

        const DIFFICULTY_RANGES = {
            'easy': { min: 1, max: 12, multi: 1 },
            'medium': { min: 1, max: 20, multi: 2 },
            'hard': { min: 1, max: 50, multi: 4 }
        };

        function initGame() {
            try {
                console.log("Initializing Game...");
                // Reset state
                gridValues = [];
                stripValues = [];
                selectedStripIndices = [];
                pairsFound = 0;
                currentRoundScore = 0;
                mistakes = 0;
                foundExtraSolutions = new Set();

                updateUI();
                if (modal) modal.classList.add('hidden');

                const range = DIFFICULTY_RANGES[currentLevel];
                if (!range) throw new Error("Invalid level config: " + currentLevel);

                // Load High Score
                loadHighScore();

                console.log("Generating Pairs for level:", currentLevel, range);

                // Generate Puzzle with Relaxed Repair Strategy
                gridValues = [];
                stripValues = [];
                let attempts = 0;
                let currentPairs = [];

                // Initial generation
                for (let i = 0; i < TOTAL_PAIRS; i++) {
                    currentPairs.push(generateRandomPair(range, i));
                }

                while (attempts < 100) {
                    attempts++;

                    const tempGrid = [];
                    const tempStrip = [];

                    currentPairs.forEach(pair => {
                        const [a, b, id] = pair;
                        tempGrid.push({ value: a + b, type: 'sum', pairId: id, solved: false, solution: [a, b] });
                        tempGrid.push({ value: a * b, type: 'product', pairId: id, solved: false, solution: [a, b] });
                        tempStrip.push({ value: a, pairId: id, used: false, id: tempStrip.length });
                        tempStrip.push({ value: b, pairId: id, used: false, id: tempStrip.length + 1 });
                    });

                    // Validate
                    const conflictPairIds = findConflicts(tempStrip, tempGrid);

                    if (conflictPairIds.length === 0) {
                        // Perfect puzzle
                        console.log(`Puzzle Generated Cleanly after ${attempts} attempts.`);
                        gridValues = shuffleArray(tempGrid);
                        tempStrip.sort((x, y) => x.value - y.value);
                        stripValues = tempStrip;
                        break;
                    }

                    // If we reached max attempts, ACCEPT the puzzle even with conflicts
                    if (attempts >= 100) {
                        console.warn("Max attempts reached. Accepting puzzle with potential Ghost Solutions.");
                        gridValues = shuffleArray(tempGrid);
                        tempStrip.sort((x, y) => x.value - y.value);
                        stripValues = tempStrip;
                        break;
                    }

                    // Repair: Replace ONE of the conflicting pairs
                    const badId = conflictPairIds[0];
                    const index = currentPairs.findIndex(p => p[2] === badId);
                    if (index !== -1) {
                        currentPairs[index] = generateRandomPair(range, badId);
                    }
                }

                if (gridValues.length === 0) {
                    throw new Error("Game Generation Failed.");
                }

                console.log("Render calling...", gridValues.length, stripValues.length);
                startTime = Date.now();
                render();
            } catch (e) {
                console.error("Error in initGame:", e);
                alert("Game Error: " + e.message);
            }
        }

        function generateRandomPair(range, id) {
            const a = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
            const b = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
            return [a, b, id];
        }

        function findConflicts(strip, grid) {
            const conflicts = new Set();
            for (let i = 0; i < strip.length; i++) {
                for (let j = i + 1; j < strip.length; j++) {
                    const item1 = strip[i];
                    const item2 = strip[j];
                    if (item1.pairId === item2.pairId) continue;

                    const sum = item1.value + item2.value;
                    const prod = item1.value * item2.value;

                    const hasSum = grid.some(g => g.value === sum && g.type === 'sum');
                    const hasProd = grid.some(g => g.value === prod && g.type === 'product');

                    if (hasSum && hasProd) {
                        conflicts.add(item1.pairId);
                        conflicts.add(item2.pairId);
                        return Array.from(conflicts);
                    }
                }
            }
            return Array.from(conflicts);
        }

        function render() {
            // Render Grid
            gridEl.innerHTML = '';
            gridValues.forEach((item, index) => {
                const cell = document.createElement('div');
                let className = `grid-cell ${item.solved ? 'solved' : ''}`;

                cell.className = className;
                cell.textContent = item.value;
                gridEl.appendChild(cell);
            });

            // Render Strip
            stripEl.innerHTML = '';
            stripValues.forEach((item, index) => {
                const btn = document.createElement('div');
                let className = 'strip-item';
                if (item.used) className += ' disabled';
                if (selectedStripIndices.includes(index)) className += ' selected';

                btn.className = className;
                btn.textContent = item.value;
                btn.onclick = () => handleStripClick(index);

                stripEl.appendChild(btn);
            });
        }

        function handleStripClick(index) {
            if (stripValues[index].used) return;

            const selectionIdx = selectedStripIndices.indexOf(index);
            if (selectionIdx > -1) {
                selectedStripIndices.splice(selectionIdx, 1);
            } else {
                if (selectedStripIndices.length < 2) {
                    selectedStripIndices.push(index);
                }
            }

            render();

            if (selectedStripIndices.length === 2) {
                setTimeout(checkPair, 300);
            }
        }

        function checkPair() {
            const idx1 = selectedStripIndices[0];
            const idx2 = selectedStripIndices[1];
            const val1 = stripValues[idx1].value;
            const val2 = stripValues[idx2].value;

            // Sort selected values for comparison
            const selectedVals = [val1, val2].sort((a, b) => a - b);
            const pairHash = `${selectedVals[0]}-${selectedVals[1]}`;

            const sum = val1 + val2;
            const prod = val1 * val2;

            console.log("--- DEBUG CHECK PAIR ---");
            console.log(`Selected: ${val1} and ${val2}`);
            console.log(`Calculated -> Sum: ${sum}, Product: ${prod}`);
            console.log("Current Grid State:", JSON.parse(JSON.stringify(gridValues)));

            // Find Grid cells that match the math
            const sumMatches = gridValues.filter(g => !g.solved && g.value === sum && g.type === 'sum');
            const prodMatches = gridValues.filter(g => !g.solved && g.value === prod && g.type === 'product');

            console.log("Math Matches (Sum):", sumMatches);
            console.log("Math Matches (Product):", prodMatches);

            if (sumMatches.length > 0 && prodMatches.length > 0) {
                // Math is valid. Now check if it's the "Intended" solution for any of these cells.

                let targetSumCell = null;
                let targetProdCell = null;

                // Find a matching pair where the solution matches our values
                for (const sCell of sumMatches) {
                    const sol = [...sCell.solution].sort((a, b) => a - b);
                    console.log(`Checking Sum Cell [${sCell.value}]: Expects [${sol.join(',')}] vs Selected [${selectedVals.join(',')}]`);

                    if (sol[0] === selectedVals[0] && sol[1] === selectedVals[1]) {
                        // Found a Sum cell that wants specific values matching ours.
                        const pCell = prodMatches.find(p => p.pairId === sCell.pairId);
                        if (pCell) {
                            targetSumCell = sCell;
                            targetProdCell = pCell;
                            console.log("-> MATCH FOUND! This is the intended pair.");
                            break;
                        }
                    } else {
                        console.log("-> Value mismatch. Math works, but not the intended numbers for this specific cell.");
                    }
                }

                if (targetSumCell && targetProdCell) {
                    // CORRECT SOLUTION (Intended)
                    targetSumCell.solved = true;
                    targetProdCell.solved = true;
                    stripValues[idx1].used = true;
                    stripValues[idx2].used = true;
                    pairsFound += 2;

                    calculateScore(false); // Normal Score
                    selectedStripIndices = [];
                    checkWin();
                } else {
                    // EXTRA SOLUTION (Ghost found!)
                    console.log("-> No Exact Match found. Treating as Ghost/Extra Solution.");

                    if (!foundExtraSolutions.has(pairHash)) {
                        foundExtraSolutions.add(pairHash);
                        showFloatingFeedback("¡Solución Extra! +50pts");
                        calculateScore(true); // Bonus Score
                    } else {
                        showFloatingFeedback("Ya encontrada");
                    }

                    selectedStripIndices = [];
                }
            } else {
                console.log("-> No Math matches found.");
                handleMistake();
                failFeedback();
            }
            render();
        }

        function calculateScore(isBonus) {
            const now = Date.now();
            const timeTaken = (now - startTime) / 1000;
            startTime = now;

            const multiplier = DIFFICULTY_RANGES[currentLevel].multi;

            if (isBonus) {
                // Fixed bonus for extra solutions
                currentRoundScore += 50 * multiplier;
            } else {
                const basePoints = 100;
                let timeBonus = Math.max(0, 50 - (timeTaken * 2));
                currentRoundScore += Math.round((basePoints + timeBonus) * multiplier);
            }
            updateUI();
        }

        function handleMistake() {
            mistakes++;
            updateUI();
            if (mistakes >= MAX_MISTAKES) {
                setTimeout(() => {
                    alert("¡Juego Terminado! Has cometido 3 errores.");
                    currentRoundScore = 0;
                    initGame();
                }, 500);
            }
        }

        function checkWin() {
            if (gridValues.every(g => g.solved)) {
                setTimeout(() => {
                    saveHighScore(currentRoundScore);
                    const modalParams = document.querySelector('.modal-content p');
                    if (modalParams) modalParams.textContent = `Has completado el tablero. Puntuación: ${currentRoundScore}`;
                    if (modal) modal.classList.remove('hidden');
                }, 500);
            }
        }

        function saveHighScore(score) {
            const key = `tetonor_highscore_${currentLevel}`;
            const currentHigh = parseInt(localStorage.getItem(key) || '0');
            if (score > currentHigh) {
                localStorage.setItem(key, score);
                loadHighScore();
            }
        }

        function loadHighScore() {
            const key = `tetonor_highscore_${currentLevel}`;
            const high = localStorage.getItem(key) || '0';
            if (highScoreEl) highScoreEl.textContent = high;
        }

        function updateUI() {
            if (currentScoreEl) currentScoreEl.textContent = currentRoundScore;
            if (mistakesEl) mistakesEl.textContent = `${mistakes}/${MAX_MISTAKES}`;
        }

        function failFeedback() {
            const container = document.querySelector('.game-board-container');
            if (container) {
                container.classList.add('shake');
                setTimeout(() => container.classList.remove('shake'), 400);
            }
            selectedStripIndices = [];
            render();
        }

        function showFloatingFeedback(text) {
            const feedback = document.createElement('div');
            feedback.className = 'floating-feedback';
            feedback.textContent = text;
            document.body.appendChild(feedback);

            // Position near the strip or center
            // Let's just center it for now or make it fixed css

            setTimeout(() => feedback.remove(), 1500);
        }

        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        diffBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                diffBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentLevel = btn.dataset.level;
                initGame();
            });
        });

        if (newGameBtn) newGameBtn.addEventListener('click', initGame);
        if (modalRestartBtn) modalRestartBtn.addEventListener('click', initGame);

        initGame();

    } catch (globalError) {
        alert("Global Script Error: " + globalError.message);
        console.error(globalError);
    }
});
