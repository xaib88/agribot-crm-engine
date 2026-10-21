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

        // Strictly process 'message.any' (ignore 'message' to eliminate dual webhook duplicate replies)
        if (event && event.event === 'message.any') {
            try {
                await waha.processWahaEvent(event);
            } catch (err) {
                console.error('Vercel Webhook error:', err.message);
            }
        } else if (event && event.event === 'message') {
            console.log('Skipping duplicate event type "message" (already handled by "message.any")');
        }
        return res.status(200).json({ status: 'OK', processed: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
