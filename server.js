const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'rankings.db');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files (html, css, js)

// Database Init
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL,
            level TEXT NOT NULL,
            date TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// API Routes

// Get Top 10 Scores per Level
app.get('/api/rankings/:level', (req, res) => {
    const level = req.params.level;
    const sql = `SELECT name, score FROM scores WHERE level = ? ORDER BY score DESC LIMIT 10`;

    db.all(sql, [level], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});

// Submit Score (Update if higher)
app.post('/api/score', (req, res) => {
    const { name, score, level } = req.body;

    if (!name || score === undefined || !level) {
        res.status(400).json({ error: "Missing required fields" });
        return;
    }

    // Check if user already has a score for this level
    const checkSql = `SELECT id, score FROM scores WHERE name = ? AND level = ?`;

    db.get(checkSql, [name, level], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (row) {
            // User exists, update ONLY if new score is higher
            if (score > row.score) {
                const updateSql = `UPDATE scores SET score = ?, date = CURRENT_TIMESTAMP WHERE id = ?`;
                db.run(updateSql, [score, row.id], function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: "Score updated", id: row.id, improved: true });
                });
            } else {
                // New score is not higher, ignore
                res.json({ message: "Score not higher, kept previous", id: row.id, improved: false });
            }
        } else {
            // New user for this level, insert
            const insertSql = `INSERT INTO scores (name, score, level) VALUES (?, ?, ?)`;
            db.run(insertSql, [name, score, level], function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: "New score created", id: this.lastID, improved: true });
            });
        }
    });
});

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
