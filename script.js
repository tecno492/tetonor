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
        let currentRoundScore = 0; // Accumulated score for this round
        let totalScore = 0; // Total score if we allowed multiple rounds (but requirements say "update when complete panel")
        // We will use this to track the "pending" score that gets committed to High Score?
        let mistakes = 0;
        let startTime = 0; // Timestamp when pair selection started (or game started)

        // Game Config
        let currentLevel = 'easy';
        const TOTAL_PAIRS = 8;
        let selectedGridIndex = -1;
        const MAX_MISTAKES = 3;

        const DIFFICULTY_RANGES = {
            'easy': { min: 1, max: 15, multi: 1 },
            'medium': { min: 1, max: 20, multi: 2 },
            'hard': { min: 1, max: 50, multi: 3 },
            'pro': { min: 1, max: 50, multi: 3.5 }
        };

        function initGame() {
            try {
                console.log("Initializing Game...");
                // Reset state
                gridValues = [];
                stripValues = [];
                selectedStripIndices = [];
                selectedGridIndex = -1;
                pairsFound = 0;
                currentRoundScore = 0;
                mistakes = 0;

                updateUI();
                if (modal) modal.classList.add('hidden');

                const oldInputModal = document.getElementById('pro-input-modal');
                if (oldInputModal) oldInputModal.remove();

                const range = DIFFICULTY_RANGES[currentLevel];
                if (!range) throw new Error("Invalid level config: " + currentLevel);

                // Load High Score
                loadHighScore();

                console.log("Generating Pairs for level:", currentLevel, range);

                // Generate Puzzle with Smart Repair Strategy
                gridValues = [];
                stripValues = [];
                let attempts = 0;
                let currentPairs = [];

                // Initial generation
                for (let i = 0; i < TOTAL_PAIRS; i++) {
                    currentPairs.push(generateRandomPair(range, i));
                }

                while (attempts < 1000000) {
                    attempts++;

                    // Build temporary structures for validation
                    const tempGrid = [];
                    const tempStrip = [];

                    currentPairs.forEach(pair => {
                        const [a, b, id] = pair;
                        tempGrid.push({ value: a + b, type: 'sum', pairId: id, solved: false });
                        tempGrid.push({ value: a * b, type: 'product', pairId: id, solved: false });
                        tempStrip.push({ value: a, pairId: id, used: false, id: tempStrip.length });
                        tempStrip.push({ value: b, pairId: id, used: false, id: tempStrip.length + 1 });
                    });

                    // Validate
                    const conflictPairIds = findConflicts(tempStrip, tempGrid);

                    if (conflictPairIds.length === 0) {
                        // Success!
                        console.log(`Puzzle Generated successfully after ${attempts} repairs.`);
                        gridValues = shuffleArray(tempGrid);
                        tempStrip.sort((x, y) => x.value - y.value);
                        stripValues = tempStrip;
                        break;
                    }

                    // Repair: Replace ONE of the conflicting pairs
                    // Pick the first conflicting pair ID
                    const badId = conflictPairIds[0];
                    const index = currentPairs.findIndex(p => p[2] === badId);
                    if (index !== -1) {
                        currentPairs[index] = generateRandomPair(range, badId);
                    }
                }

                if (gridValues.length === 0) {
                    // Fallback: If strict validation fails (unlikely with 500 repairs), 
                    // just use what we have but warn. Or maybe reduce pair count?
                    // Let's just throw for now, but 500 iterations should be plenty.
                    throw new Error("Could not generate a unique layout. Please try again.");
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
            // Returns a list of pairIds that are causing conflicts (ghost solutions)
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
                        // Conflict found involves these two items.
                        // Mark BOTH pairs as problematic.
                        conflicts.add(item1.pairId);
                        conflicts.add(item2.pairId);
                        // We can return early if we just want to fix one at a time
                        return Array.from(conflicts);
                    }
                }
            }
            return Array.from(conflicts);
        }

        function unused_validatePuzzle(strip, grid) {
            // ... deprecated ...
            return true;
        }

        function render() {
            // Render Grid
            gridEl.innerHTML = '';
            gridValues.forEach((item, index) => {
                const cell = document.createElement('div');
                let className = `grid-cell ${item.solved ? 'solved' : ''}`;
                if (currentLevel === 'pro' && !item.solved) className += ' pro-mode';
                if (index === selectedGridIndex) className += ' selected';

                cell.className = className;
                cell.textContent = item.value;

                if (currentLevel === 'pro' && !item.solved) {
                    cell.onclick = () => handleProGridClick(index);
                }

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

                if (currentLevel !== 'pro') {
                    btn.onclick = () => handleStripClick(index);
                } else {
                    btn.onclick = () => handleProStripClick(index);
                }

                stripEl.appendChild(btn);
            });
        }

        // --- Standard Mode Logic ---

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
                setTimeout(checkStandardPair, 300);
            }
        }

        function checkStandardPair() {
            const idx1 = selectedStripIndices[0];
            const idx2 = selectedStripIndices[1];
            const val1 = stripValues[idx1].value;
            const val2 = stripValues[idx2].value;

            const sum = val1 + val2;
            const prod = val1 * val2;

            const sumMatches = gridValues.filter(g => !g.solved && g.value === sum && g.type === 'sum');
            const prodMatches = gridValues.filter(g => !g.solved && g.value === prod && g.type === 'product');

            if (sumMatches.length > 0 && prodMatches.length > 0) {
                // Correct Match
                sumMatches[0].solved = true;
                prodMatches[0].solved = true;
                stripValues[idx1].used = true;
                stripValues[idx2].used = true;
                pairsFound += 2; // Tracking solved cells (16 total)

                calculateScore();

                selectedStripIndices = [];
                checkWin();
            } else {
                handleMistake();
                failFeedback();
            }
            render();
        }

        // --- Pro Mode Logic ---

        function handleProGridClick(index) {
            if (selectedGridIndex === index) {
                selectedGridIndex = -1; // Deselect
            } else {
                selectedGridIndex = index;
                selectedStripIndices = []; // Clear previous strip selections
            }
            render();
        }

        function handleProStripClick(index) {
            if (selectedGridIndex === -1) {
                alert("En modo Pro, primero selecciona una casilla del tablero.");
                return;
            }
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
                setTimeout(checkProPair, 300);
            }
        }

        function checkProPair() {
            if (selectedGridIndex === -1) return;

            const idx1 = selectedStripIndices[0];
            const idx2 = selectedStripIndices[1];
            const val1 = stripValues[idx1].value;
            const val2 = stripValues[idx2].value;

            const targetCell = gridValues[selectedGridIndex];

            // Validate
            let isMatch = false;

            if (targetCell.type === 'sum') {
                if (val1 + val2 === targetCell.value) isMatch = true;
            } else if (targetCell.type === 'product') {
                if (val1 * val2 === targetCell.value) isMatch = true;
            }

            if (isMatch) {
                targetCell.solved = true;

                const partnerType = targetCell.type === 'sum' ? 'product' : 'sum';
                const partnerCell = gridValues.find(g =>
                    g.pairId === targetCell.pairId &&
                    g.type === partnerType
                );

                if (partnerCell && partnerCell.solved) {
                    stripValues[idx1].used = true;
                    stripValues[idx2].used = true;
                }

                pairsFound++;

                // In Pro mode, we calculate score per cell solved? 
                // Or maybe half score? Let's just give points for progress.
                calculateScore();

                selectedGridIndex = -1;
                selectedStripIndices = [];
                checkWin();

            } else {
                handleMistake();
                failFeedback();
                selectedStripIndices = [];
            }
            render();
        }

        // --- Scoring & Game Logic Helpers ---

        function calculateScore() {
            const now = Date.now();
            const timeTaken = (now - startTime) / 1000; // seconds
            startTime = now; // Reset timer for next pair

            // Base Score per action
            const basePoints = 100;

            // Level Multiplier
            const multiplier = DIFFICULTY_RANGES[currentLevel].multi;

            // Time Bonus: e.g. Max 50 bonus points, decreasing by 5 per second taken?
            // If checking fast (within 5s) -> High bonus.
            let timeBonus = Math.max(0, 50 - (timeTaken * 2));

            const points = Math.round((basePoints + timeBonus) * multiplier);
            currentRoundScore += points;

            updateUI();
        }

        function handleMistake() {
            mistakes++;
            updateUI();

            if (mistakes >= MAX_MISTAKES) {
                setTimeout(() => {
                    alert("¡Juego Terminado! Has cometido 3 errores.");
                    // Reset Score to 0
                    currentRoundScore = 0;
                    initGame();
                }, 500);
            }
        }

        function checkWin() {
            if (gridValues.every(g => g.solved)) {
                setTimeout(() => {
                    // Update High Score ONLY on full panel completion
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
                loadHighScore(); // Refresh UI
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

            if (selectedGridIndex !== -1) {
                const cells = document.querySelectorAll('.grid-cell');
                if (cells[selectedGridIndex]) {
                    cells[selectedGridIndex].classList.add('error');
                    setTimeout(() => cells[selectedGridIndex].classList.remove('error'), 400);
                }
            }
            // For standard mode, maybe shake the selected strip items?
            // Already handled by container shake visually.

            selectedStripIndices = [];
            render();
        }

        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        // Config Handlers
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

        // Initial Start
        initGame();

    } catch (globalError) {
        alert("Global Script Error: " + globalError.message);
        console.error(globalError);
    }
});
