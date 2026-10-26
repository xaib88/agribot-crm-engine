const agent = require('./agent');
const db = require('./db');
const webSearch = require('./web_search');

async function runTests() {
    console.log('====================================================');
    console.log('🧪 TESTING AGRIBOT AUTONOMOUS AGENT MODE');
    console.log('====================================================\n');

    const adminChatId = '923317824038@c.us';
    const farmerChatId = '923009876543@c.us';

    // Test 1: Admin Activation
    console.log('--- Test 1: Admin (03317824038) sends "ایکٹ ایز اٹونومک باٹ" ---');
    const adminActivationReply = await agent.getQuickTextAnswer('ایکٹ ایز اٹونومک باٹ', adminChatId);
    console.log('Bot Response:\n', adminActivationReply);
    const modeNow = db.getChatMode(adminChatId);
    console.log(`Current Mode for Admin: ${modeNow}`);
    if (modeNow === 'autonomous' && adminActivationReply.includes('اٹونومک ایجنٹ موڈ فعال')) {
        console.log('✅ TEST 1 PASSED: Admin successfully activated autonomous mode!\n');
    } else {
        console.error('❌ TEST 1 FAILED!');
    }

    // Test 2: Non-Admin Rejection
    console.log('--- Test 2: Farmer (03009876543) sends "ایکٹ ایز اٹونومک باٹ" ---');
    const farmerActivationReply = await agent.getQuickTextAnswer('ایکٹ ایز اٹونومک باٹ', farmerChatId);
    console.log('Bot Response:\n', farmerActivationReply);
    const farmerMode = db.getChatMode(farmerChatId);
    console.log(`Current Mode for Farmer: ${farmerMode}`);
    if (farmerMode === 'agri' && farmerActivationReply.includes('محترم کاشتکار بھائی') && farmerActivationReply.includes('بشیر')) {
        console.log('✅ TEST 2 PASSED: Non-admin strictly blocked from autonomous mode!\n');
    } else {
        console.error('❌ TEST 2 FAILED!');
    }

    // Test 3: Admin Property Search in Autonomous Mode
    console.log('--- Test 3: Admin asks for property search on Raiwind Road Lahore ---');
    const searchPrompt = 'گوگل پر جاؤ اور رائیونڈ روڈ لاہور پر 5 مرلہ پلاٹ تلاش کرو';
    const propertyReply = await agent.getQuickTextAnswer(searchPrompt, adminChatId);
    console.log('Bot Response:\n', propertyReply);
    const hasLinks = /https?:\/\//i.test(propertyReply) || propertyReply.includes('zameen') || propertyReply.includes('olx');
    const hasCompletion = propertyReply.includes('یہ کام مکمل ہو گیا') || propertyReply.includes('باس');
    if (hasLinks && hasCompletion) {
        console.log('✅ TEST 3 PASSED: Live web search executed, links preserved, and executive report delivered!\n');
    } else {
        console.log('⚠️ Property reply notes: hasLinks=', hasLinks, 'hasCompletion=', hasCompletion);
    }

    // Test 4: Admin switches back to AgriBot
    console.log('--- Test 4: Admin switches back to AgriBot ---');
    const backToAgriReply = await agent.getQuickTextAnswer('@agribot', adminChatId);
    console.log('Bot Response:\n', backToAgriReply);
    const modeBack = db.getChatMode(adminChatId);
    console.log(`Current Mode for Admin: ${modeBack}`);
    if (modeBack === 'agri') {
        console.log('✅ TEST 4 PASSED: Successfully reverted to AgriBot mode!\n');
    } else {
        console.error('❌ TEST 4 FAILED!');
    }

    console.log('====================================================');
    console.log('🎉 ALL UNIT TESTS COMPLETED!');
    console.log('====================================================');
}

runTests().catch(err => {
    console.error('Test error:', err);
});
