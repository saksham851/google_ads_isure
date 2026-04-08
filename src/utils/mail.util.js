const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Creates a nodemailer transport using environment variables
 */
const createTransport = () => {
    return nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.MAIL_PORT) || 465,
        secure: process.env.MAIL_PORT == '465', // true for 465, false for other ports
        auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD
        }
    });
};

/**
 * Sends an email
 * @param {Object} options - { to, subject, html }
 */
const sendEmail = async (options) => {
    try {
        const transporter = createTransport();
        const mailOptions = {
            from: `"${process.env.MAIL_FROM_NAME || 'Support'}" <${process.env.MAIL_FROM_ADDRESS}>`,
            to: options.to,
            subject: options.subject,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error(`Error sending email to ${options.to}:`, error);
        throw error;
    }
};

module.exports = {
    sendEmail
};
