const db = require('../db');

module.exports = async (req, res) => {
    try {
        db.clearAllHistory();
        return res.status(200).json({
            success: true,
            message: 'All chat history cleared successfully from memory and disk.'
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
