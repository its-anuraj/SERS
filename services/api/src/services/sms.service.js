/**
 * SMS Service — MSG91 (India) with Twilio fallback
 */

const logger = require('../config/logger');

const sendSMS = async (phone, message) => {
    // MSG91
    if (process.env.MSG91_AUTH_KEY) {
        return sendViaMSG91(phone, message);
    }
    // Twilio fallback
    if (process.env.TWILIO_ACCOUNT_SID) {
        return sendViaTwilio(phone, message);
    }
    // Mock for development
    logger.info('[SMS MOCK]', { to: phone, message });
    return { success: true, mock: true };
};

const sendViaMSG91 = async (phone, message) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://api.msg91.com/api/v5/flow/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authkey': process.env.MSG91_AUTH_KEY,
            },
            body: JSON.stringify({
                template_id: process.env.MSG91_TEMPLATE_ID,
                sender: process.env.MSG91_SENDER_ID || 'SERS',
                mobiles: phone.replace('+', ''),
                VAR1: message,
            }),
        });
        const data = await response.json();
        logger.info('SMS sent via MSG91', { phone, response: data });
        return data;
    } catch (error) {
        logger.error('MSG91 SMS failed', { phone, error: error.message });
        throw error;
    }
};

const sendViaTwilio = async (phone, message) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fetch = (await import('node-fetch')).default;

        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    To: phone,
                    From: process.env.TWILIO_PHONE_NUMBER,
                    Body: message,
                }),
            }
        );
        const data = await response.json();
        logger.info('SMS sent via Twilio', { phone, sid: data.sid });
        return data;
    } catch (error) {
        logger.error('Twilio SMS failed', { phone, error: error.message });
        throw error;
    }
};

module.exports = { sendSMS };
