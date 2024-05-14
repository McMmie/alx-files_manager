import sha1 from 'sha1';
import Queue from 'bull/lib/queue';
import dbClient from '../utils/db';

// Queue for email sending
const userQueue = new Queue('email sending');

/**
 * Controller class for managing user-related operations.
 */
export default class UsersController {
  /**
   * Creates a new user.
   * @param {Request} req - The Express request object.
   * @param {Response} res - The Express response object.
   * @returns {Response} - The Express response indicating success or failure.
   */
  static async postNew(req, res) {
    // Extract email and password from request body
    const email = req.body?.email;
    const password = req.body?.password;

    // Check for missing email or password
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      // Check if user already exists
      const existingUser = await dbClient.usersCollection().findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Insert new user into database
      const insertionInfo = await dbClient.usersCollection().insertOne({
        email,
        password: sha1(password), // Hash the password
      });
      const userId = insertionInfo.insertedId.toString();

      // Add user to the email sending queue
      userQueue.add({ userId });

      // Return success response
      return res.status(201).json({ email, id: userId });
    } catch (error) {
      console.error('Error creating new user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Retrieves information about the authenticated user.
   * @param {Request} req - The Express request object.
   * @param {Response} res - The Express response object.
   * @returns {Response} - The Express response containing user information.
   */
  static async getMe(req, res) {
    // Extract user information from request object
    const { user } = req;

    // Return user information
    return res.status(200).json({ email: user.email, id: user._id.toString() });
  }
}

