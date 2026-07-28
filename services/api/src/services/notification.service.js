/**
 * Push Notification Service (Firebase Cloud Messaging - V1 API)
 */

const logger = require('../config/logger');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let isInitialized = false;

try {
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        const certFn = admin?.credential?.cert || admin?.default?.credential?.cert;
        if (certFn) {
            admin.initializeApp({
                credential: certFn(serviceAccount)
            });
            isInitialized = true;
            logger.info('Firebase Admin SDK initialized successfully (V1 API ready).');
        } else {
            logger.warn('Firebase credential loader unavailable. Notifications running in MOCK mode.');
        }
    } else {
        logger.warn('firebase-service-account.json not found. Notifications will run in MOCK mode.');
    }
} catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', { error: error.message });
}

const sendPushNotification = async (fcmToken, title, body, data = {}) => {
    if (!fcmToken) return;
    
    if (!isInitialized) {
        logger.info('[FCM MOCK]', { fcmToken: fcmToken.substring(0, 20) + '...', title, body });
        return { success: true, mock: true };
    }

    try {
        const message = {
            token: fcmToken,
            notification: { title, body },
            data: data,
            android: {
                priority: 'high',
                notification: { channelId: 'sers_emergency', sound: 'emergency_alert' }
            },
            apns: {
                headers: { 'apns-priority': '10' },
                payload: { aps: { sound: 'emergency_alert' } }
            }
        };

        const response = await admin.messaging().send(message);
        logger.info('FCM notification sent', { title, response });
        return { success: true, response };
    } catch (error) {
        logger.error('FCM notification failed', { error: error.message });
        throw error;
    }
};

/**
 * Send to multiple tokens (bulk)
 */
const sendPushToMultiple = async (fcmTokens, title, body, data = {}) => {
    const validTokens = fcmTokens.filter(Boolean);
    if (validTokens.length === 0) return [];

    if (!isInitialized) {
        validTokens.forEach(t => logger.info('[FCM MOCK BULK]', { fcmToken: t.substring(0, 20) + '...', title, body }));
        return validTokens.map(() => ({ status: 'fulfilled', value: { success: true, mock: true } }));
    }

    try {
        const message = {
            tokens: validTokens,
            notification: { title, body },
            data: data,
            android: {
                priority: 'high',
                notification: { channelId: 'sers_emergency', sound: 'emergency_alert' }
            }
        };
        const response = await admin.messaging().sendMulticast(message);
        logger.info(`FCM bulk sent. Success: ${response.successCount}, Failed: ${response.failureCount}`);
        return response;
    } catch (error) {
        logger.error('FCM bulk notification failed', { error: error.message });
        throw error;
    }
};

module.exports = { sendPushNotification, sendPushToMultiple };
