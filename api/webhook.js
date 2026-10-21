const waha = require('../waha_bridge');

module.exports = async (req, res) => {
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'OK',
            service: 'AgriBot Vercel Serverless Webhook Engine',
            timestamp: new Date().toISOString()
        });
    }

    if (req.method === 'POST') {
        const event = req.body;
        console.log(`📡 [VERCEL WEBHOOK] Event: "${event?.event}" for session: "${event?.session}"`);

        if (event && (event.event === 'message' || event.event === 'message.any')) {
            try {
                await waha.processWahaEvent(event);
            } catch (err) {
                console.error('Vercel Webhook error:', err.message);
            }
        }
        return res.status(200).json({ status: 'OK', processed: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
