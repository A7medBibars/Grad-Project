import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./config/.env" });

/**
 * @description
 * Sends an email using nodemailer.
 * @param {Object} options - the options to send the email with
 * @param {string} options.to - the recipient of the email
 * @param {string} options.subject - the subject of the email
 * @param {string} options.html - the html body of the email
 * @returns {Promise<void>}
 */
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;
    
    if (!EMAIL_USER || !EMAIL_PASS) {
      throw new Error("Email credentials not found in environment variables");
    }
    
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
    
    await transporter.sendMail({
      from: `"GradProject" <${EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error("Failed to send email:", error.message);
    throw new Error("Failed to send email. Please try again later.");
  }
};
