

/**
 * Generates a one-time password (OTP) as a 6-digit number.
 *
 * @returns {number} A 6-digit OTP.
 */
export const generateOTP = () => {
    return Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
  };
  