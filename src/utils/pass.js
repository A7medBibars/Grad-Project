import bcrypt from "bcrypt";
/**
 * @description
 * Hashes the given password with the given saltRounds to be used for
 * storing in the database.
 * @param {{ password: string, saltRound: number }} options - options object
 * @param {string} options.password - the password to hash
 * @param {number} [options.saltRound=8] - the number of rounds to use for hashing
 * @returns {string} - the hashed password
 */
export const hashPassword = ({ password, saltRound = 8 }) => {
  return bcrypt.hashSync(password, saltRound);
};

export const comparePassword = ({ password, hashPassword }) => {
  return bcrypt.compareSync(password, hashPassword);
};
