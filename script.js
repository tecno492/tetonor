document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("Script loaded");
        const gridEl = document.getElementById('grid');
        const stripEl = document.getElementById('strip');
        const scoreEl = document.getElementById('score');
        const newGameBtn = document.getElementById('new-game-btn');
        const modal = document.getElementById('modal');
        const modalRestartBtn = document.getElementById('modal-restart-btn');
        const diffBtns = document.querySelectorAll('.diff-btn');

        if (!gridEl || !stripEl) {
            alert("Critical Error: Grid or Strip elements not found!");
            return;
        }

        let gridValues = []; // Stores { value: number, solved: boolean, type: 'sum' | 'product', pairId: number }
        let stripValues = []; // Stores { value: number, id: number, used: boolean }
        let selectedStripIndices = [];
        let pairsFound = 0;

        // Game Config
        let currentLevel = 'easy'; // easy, medium, hard, pro
        const TOTAL_PAIRS = 8;

        // Pro Mode State
        let selectedGridIndex = -1; // Index of the grid cell clicked in Pro mode

        const DIFFICULTY_RANGES = {
            'easy': { min: 1, max: 9 },
            'medium': { min: 2, max: 20 },
            'hard': { min: 5, max: 50 },
            'pro': { min: 5, max: 50 }
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
                updateScore();
                if (modal) modal.classList.add('hidden');

                // Remove input modal if exists
                const oldInputModal = document.getElementById('pro-input-modal');
                if (oldInputModal) oldInputModal.remove();

                const range = DIFFICULTY_RANGES[currentLevel];
                if (!range) throw new Error("Invalid level config: " + currentLevel);

                console.log("Generating Pairs for level:", currentLevel, range);

                // Generate Puzzle
                const pairs = [];
                for (let i = 0; i < TOTAL_PAIRS; i++) {
                    const a = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                    const b = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                    pairs.push([a, b, i]);
                }

                // Generate Grid Items
                const gridItems = [];
                pairs.forEach(pair => {
                    const [a, b, id] = pair;
                    gridItems.push({
                        value: a + b,
                        solved: false,
                        type: 'sum',
                        pairId: id,
                        solution: [a, b]
                    });
                    gridItems.push({
                        value: a * b,
                        solved: false,
                        type: 'product',
                        pairId: id,
                        solution: [a, b]
                    });
                });

                // Shuffle Grid Items
                gridValues = shuffleArray(gridItems);

                // Generate Strip Items
                const stripItems = [];
                pairs.forEach(pair => {
                    const [a, b, id] = pair;
                    stripItems.push({ value: a, pairId: id, used: false });
                    stripItems.push({ value: b, pairId: id, used: false });
                });

                stripItems.sort((x, y) => x.value - y.value);
                stripValues = stripItems;

                console.log("Render calling...", gridValues.length, stripValues.length);
                render();
            } catch (e) {
                console.error("Error in initGame:", e);
                alert("Game Error: " + e.message);
            }
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

                // In Pro Mode, clicking strip items might not do anything unless we drag/drop, OR 
                // maybe we use the strip to populate the inputs?
                // Let's stick to Standard Mode behavior: user clicks 2 strip items.
                // But Pro Mode requires selecting specific Grid Cell first? 
                // No, the requirement says "manual entries".
                // Let's implement: Click Grid Cell -> Dialog to enter 2 numbers -> Validation.
                // For now, let's keep strip clickable only for Standard modes.

                if (currentLevel !== 'pro') {
                    btn.onclick = () => handleStripClick(index);
                } else {
                    // In Pro mode, maybe clicking strip just highlights it?
                    // Or actually, let's allow "Click Grid Cell, Then Click 2 Strip Items" flow for Pro?
                    // That feels like "Manual Entry" but using the UI.
                    // Steps: 1. Click Grid Cell (target). 2. Select 2 numbers from strip. 3. Check.
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
                sumMatches[0].solved = true;
                prodMatches[0].solved = true;
                stripValues[idx1].used = true;
                stripValues[idx2].used = true;
                pairsFound += 2;
                updateScore();
                selectedStripIndices = [];
                checkWin();
            } else {
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
                // User hasn't selected a target grid cell yet
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
                // But wait, in Pro mode, finding ONE cell isn't enough?
                // "Manual entries" usually implies you fill the grid.
                // If I say "This 12 is 3x4", I am solving the 12. 
                // Should I also auto-solve the corresponding Sum (7)?
                // The user prompt said: "quadricula que require entradas manuales".
                // Let's assume verifying just this specific cell is enough for "Manual Entry".
                // OR: Standard Tetonor rules: checking a pair verifies BOTH.
                // Let's stick to: You identify the pair for this Number.
                // BUT, if you identify (3,4) for 12, you implicitly found the pair.

                // Check if the OTHER matching pair part exists in grid and is unsolved?
                // Actually, if I match 12 with 3 and 4, I effectively "used" 3 and 4.
                // So I should solve both standardly?
                // Let's say Pro mode just forces you to be EXPLICIT about which cell you are solving.
                // Standard: Pick 2 numbers -> System finds where they go.
                // Pro: Pick Cell -> Pick 2 numbers -> System verifies.

                targetCell.solved = true;

                // Should we mark the numbers as used?
                // If we mark them used, then we can't solve the corresponding pair (e.g. sum)?
                // Tetonor rule: "Each pair used twice".
                // So 3 and 4 are used for 12 AND 7.
                // So if I solve 12 with 3,4... 3 and 4 are NOT fully used yet?
                // Logic change needed for Tetonor correctness:
                // Strip numbers are used ONCE per PAIR of operations? 
                // "Each pair of numbers ... used twice: once for add, once for mult".
                // This implies the strip pair (3,4) is "consumed" only after BOTH 12 and 7 are found.

                // My Standard logic was: Pick 3,4 -> Find 12 & 7 -> Mark 3,4 used.
                // Pro logic: Pick 12 -> Pick 3,4 -> Solve 12. 
                // 3,4 are now "Half Used"?
                // Simplifying: In Pro mode, maybe we just mark the Cell as solved. 
                // We only mark Strip as used when BOTH associated Grid Cells are solved?
                // Let's try to find the pairID.

                // Let's stick to this simplified Pro Logic:
                // 1. Solve Target Cell.
                // 2. Check if the "Partner" cell is also solved? 
                //    If yes -> Mark strip numbers used.
                //    If no -> Keep strip numbers available.

                // Finding the partner cell is tricky because duplicates exist.
                // But we can check if there are OTHER grid cells that use these exact two values?
                // Actually, let's just use the `pairId` I added to the data structure!

                // targetCell.pairId
                const partnerType = targetCell.type === 'sum' ? 'product' : 'sum';
                const partnerCell = gridValues.find(g =>
                    g.pairId === targetCell.pairId &&
                    g.type === partnerType
                );

                if (partnerCell && partnerCell.solved) {
                    // Both parts of the pair are now solved!
                    stripValues[idx1].used = true;
                    stripValues[idx2].used = true;
                } else {
                    // Only one part solved. Just deselect strip items, don't mark used.
                    // Visual aid: Maybe show them as "partially used"? (Scope creep)
                }

                // Also, we need to handle the case where user picked 3,4 for a 12 (solved), 
                // but then picks 3,4 for a DIFFERENT 12? (Unlikely with random gen but possible).
                // Strict check: numbers must match targetCell.solution
                // I added `solution` field in INIT.

                // Let's re-verify solution just to be safe they didn't pick coincidental numbers?
                // (e.g. 2+6 = 8, 3+5=8. Target 8. Solution was 2,6. User picked 3,5. Valid?
                // In logic puzzles, ANY valid math path is usually accepted unless strict unicity is required.
                // Let's accept any valid math.

                pairsFound++; // Increments by 1 in Pro mode (per cell)
                updateScore();
                selectedGridIndex = -1;
                selectedStripIndices = [];
                checkWin();

            } else {
                failFeedback();
                // Deselect everything
                selectedStripIndices = [];
            }
            render();
        }

        // --- Helpers ---

        function checkWin() {
            // Total pairs found in Standard = 16 (incremented by 2).
            // In Pro, we increment by 1. Total grid cells = 16.
            if (gridValues.every(g => g.solved)) {
                setTimeout(() => {
                    const modalParams = document.querySelector('.modal-content p');
                    if (modalParams) modalParams.textContent = "Has completado el tablero.";
                    if (modal) modal.classList.remove('hidden');
                }, 500);
            }
        }

        function failFeedback() {
            const container = document.querySelector('.game-board-container');
            if (container) {
                container.classList.add('shake');
                setTimeout(() => container.classList.remove('shake'), 400);
            }

            if (selectedGridIndex !== -1) {
                // In pro mode, maybe shake specific cell?
                const cells = document.querySelectorAll('.grid-cell');
                if (cells[selectedGridIndex]) {
                    cells[selectedGridIndex].classList.add('error');
                    setTimeout(() => cells[selectedGridIndex].classList.remove('error'), 400);
                }
            }

            selectedStripIndices = [];
            render(); // clear selection
        }

        function updateScore() {
            if (scoreEl) scoreEl.textContent = pairsFound;
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
