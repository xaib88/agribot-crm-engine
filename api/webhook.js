const waha = require('../waha_bridge');

module.exports = async (req, res) => {
    // Health check on GET
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'OK',
            service: 'AgriBot Vercel Serverless Webhook Engine',
            timestamp: new Date().toISOString()
        });
    }

    if (req.method === 'POST') {
        try {
            const event = req.body;
            console.log(`📡 [VERCEL WEBHOOK] Event: "${event?.event}" for session: "${event?.session}"`);
            if (event && event.event) {
                // Wait for the message to be processed and sent
                await waha.processWahaEvent(event);
            }
            return res.status(200).json({ status: 'OK', delivered: true });
        } catch (err) {
            console.error('Vercel Webhook error:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
