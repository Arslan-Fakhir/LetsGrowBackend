import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.COMPANY_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendInvestmentConfirmationEmail = async (toEmail, userName, startupName, amount) => {
  try {
    const mailOptions = {
      from: `LetsGrow <${process.env.COMPANY_EMAIL}>`,
      to: toEmail,
      subject: `Your Investment in ${startupName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Thank you for your investment!</h2>
          <p>Dear ${userName},</p>
          <p>Your investment of $${amount} in <strong>${startupName}</strong> has been successfully processed.</p>
          <p>We appreciate your support in helping this startup grow!</p>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <br>
          <p>Best regards,</p>
          <p>The LetsGrow Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Investment confirmation email sent to ${toEmail}`);
  } catch (error) {
    console.error('Error sending investment confirmation email:', error);
  }
};