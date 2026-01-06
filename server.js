const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

/* paths */
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const CLAIMED_FILE = path.join(DATA_DIR, 'claimed_items.json');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SUBMITTED_DIR = path.join(UPLOADS_DIR, 'submitted');
const CLAIMED_DIR = path.join(UPLOADS_DIR, 'claimed');

/* files */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function ensureFile(file) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
}

ensureDir(DATA_DIR);
ensureDir(UPLOADS_DIR);
ensureDir(SUBMITTED_DIR);
ensureDir(CLAIMED_DIR);
ensureFile(ITEMS_FILE);
ensureFile(CLAIMED_FILE);

/* middleware*/
app.use(express.json());
app.use(express.static('public'));
// Ensure uploads are served so images show up
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve models for face-api.js
app.use('/models', express.static(path.join(__dirname, 'models')));  // Add this line

/* backend */
const submitUpload = multer({
    storage: multer.diskStorage({
        destination: SUBMITTED_DIR,
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + file.originalname);
        }
    })
});

const claimUpload = multer({
    storage: multer.diskStorage({
        destination: CLAIMED_DIR,
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-claimer-' + file.originalname);
        }
    })
});

/* helpers */
function readJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return [];
    }
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* routes */

// submit
app.post('/api/submit', submitUpload.single('photo'), (req, res) => {
    const items = readJSON(ITEMS_FILE);
    const newItem = {
        id: Date.now(),
        studentNumber: req.body.studentNumber,
        password: req.body.password,
        name: req.body.itemName,
        category: req.body.category,
        location: req.body.location,
        photo: req.file ? `/uploads/submitted/${req.file.filename}` : '',
        dateSubmitted: new Date().toISOString()
    };
    items.push(newItem);
    writeJSON(ITEMS_FILE, items);
    res.json(newItem);
});

// GET AVAILABLE ITEMS
app.get('/api/items', (req, res) => {
    res.json(readJSON(ITEMS_FILE));
});

app.put('/api/items/:id', (req, res) => {
    const itemId = Number(req.params.id);
    const updatedFields = req.body;
    let items = readJSON(ITEMS_FILE);
    
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) {
        return res.status(404).json({ error: 'Item not found' });
    }

    // Merge updates
    items[index] = {
        ...items[index],
        name: updatedFields.name,
        category: updatedFields.category,
        location: updatedFields.location
    };

    writeJSON(ITEMS_FILE, items);
    res.json({ success: true });
});

// GET CLAIMED ITEMS
app.get('/api/claimed-items', (req, res) => {
    res.json(readJSON(CLAIMED_FILE));
});

// CLAIM ITEM
app.post('/api/claim/:id', claimUpload.single('photo'), (req, res) => {
    const itemId = Number(req.params.id);
    const { claimerStudent, claimerName } = req.body;
    let items = readJSON(ITEMS_FILE);
    let claimed = readJSON(CLAIMED_FILE);

    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return res.status(404).json({ error: 'Item not found' });

    const item = items[index];
    
    // Build Claim Record
    const claimedItem = {
        ...item,
        claimId: Date.now(),
        claimerStudent,
        claimerName,
        claimerPhoto: req.file ? `/uploads/claimed/${req.file.filename}` : '',
        claimDate: new Date().toISOString()
    };

    items.splice(index, 1);
    claimed.push(claimedItem);
    writeJSON(ITEMS_FILE, items);
    writeJSON(CLAIMED_FILE, claimed);
    res.json(claimedItem);
});

/* server start */
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
