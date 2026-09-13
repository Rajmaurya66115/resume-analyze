const nodemailer = require('nodemailer');

const getTransporter = () => {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  if (!user || !pass) {
    throw new Error('EMAIL_USER or EMAIL_PASS environment variable is missing.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass,
    },
  });
};

// 1. Contact Form Email Notifications
const sendContactEmails = async ({ name, email, subject, message }) => {
  const transporter = getTransporter();
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || '').trim();

  const adminMailOptions = {
    from: `"ResumeReview System" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `[New Inquiry] ${subject || 'Customer Query'} from ${name || email}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
        <h2 style="color: #0f766e;">New Customer Query Received</h2>
        <p><strong>Name:</strong> ${name || 'N/A'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject || 'General'}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p><strong>Message:</strong></p>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
          ${(message || '').replace(/\n/g, '<br/>')}
        </div>
      </div>
    `,
  };

  const customerMailOptions = {
    from: `"ResumeReview Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `We've received your inquiry: ${subject || 'Support Request'}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #1e293b; max-width: 550px;">
        <h2 style="color: #0f766e;">Thank You for Reaching Out!</h2>
        <p>Hi ${name || 'there'},</p>
        <p>We received your inquiry regarding <strong>"${subject || 'Support'}"</strong>. Our team will review your message and reply promptly.</p>
        <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; border: 1px solid #bbf7d0; margin: 16px 0;">
          <p style="margin: 0; font-size: 13px; color: #166534;"><strong>Your Message:</strong></p>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #334155;">${(message || '').replace(/\n/g, '<br/>')}</p>
        </div>
        <p style="font-size: 12px; color: #64748b;">Warm regards,<br/>ResumeReview Support Team</p>
      </div>
    `,
  };

  return Promise.all([
    transporter.sendMail(adminMailOptions),
    transporter.sendMail(customerMailOptions),
  ]);
};

// 2. Password Reset Email
const sendPasswordResetEmail = async (email, resetUrl) => {
  const transporter = getTransporter();

  const mailOptions = {
    from: `"ResumeReview Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request - ResumeReview',
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #1e293b; max-width: 550px;">
        <h2 style="color: #0f766e;">Password Reset Request</h2>
        <p>You requested a password reset for your ResumeReview account.</p>
        <p>Click the button below to choose a new password. This link is valid for 1 hour:</p>
        <div style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendContactEmails, sendPasswordResetEmail };