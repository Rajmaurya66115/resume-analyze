const express = require('express');
const { sendContactEmails } = require('../utils/mailer');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: 'missing_fields', message: 'Email and message are required.' });
    }

    try {
      await sendContactEmails({ name, email, subject, message });
    } catch (mailErr) {
      console.error('[Nodemailer Dispatch Error]:', mailErr.message);
      return res.status(500).json({
        error: 'mail_send_failure',
        message: 'Could not send email. Please check server email credentials.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Your inquiry has been delivered. A confirmation email was sent to your inbox.',
    });
  } catch (err) {
    console.error('[Contact Route Fatal]:', err);
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error while processing your message.',
    });
  }
});

module.exports = router;