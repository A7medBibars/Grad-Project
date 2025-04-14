import jwt from 'jsonwebtoken'
/**
 * Generates a jwt token based on the given payload and secretKey.
 *
 * @param {{ payload: Object, secretKey?: string, expiresIn?: string }} options
 * @param {Object} options.payload - The payload to be encoded in the token.
 * @param {string} [options.secretKey='hambozo'] - The secret key to sign the token.
 * @param {string} [options.expiresIn='24h'] - The expiration time for the token.
 * @returns {string} The generated jwt token
 */
export const generateToken = ({ payload, secretKey = 'hambozo', expiresIn = '24h' }) => {
    return jwt.sign(payload, secretKey, { expiresIn })
}

export const verifyToken = ({ token, secretKey = 'hambozo' }) => {
    try {
        return jwt.verify(token, secretKey)
    } catch (error) {
        return { message: error.message }
    }
}