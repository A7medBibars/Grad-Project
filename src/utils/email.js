import nodemailer from "nodemailer";


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
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "ahmed.bebars2001@gmail.com",
      pass: "shuogwdtabjliabi",
    },
  });
  await transporter.sendMail({
    from: " '<test>' ahmed.bebars2001@gmail.com",
    to,
    subject,
    html,
  });
};
