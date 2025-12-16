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

// Submit Score
app.post('/api/score', (req, res) => {
    const { name, score, level } = req.body;

    if (!name || score === undefined || !level) {
        res.status(400).json({ error: "Missing required fields" });
        return;
    }

    const sql = `INSERT INTO scores (name, score, level) VALUES (?, ?, ?)`;
    const params = [name, score, level];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: "success",
            id: this.lastID
        });
    });
});

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
