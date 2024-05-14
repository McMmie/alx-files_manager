import mongodb from 'mongodb';
// eslint-disable-next-line no-unused-vars
import collection from 'mongodb/lib/collection';
import envLoader from './env';

/*
 * creates a client to mongodb
 */

class DBClient {
  /*
   * creates a client
   */

  constructor() {
    envLoader();
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const dburl = `mongodb://${host}:${port}/${database}`;

    this.client = new mongodb.MongoClient(dburl, { useUnifiedTopology: true });
    // this.client.connect();
  }

  /*
   * returns true when connection is successful
   */
  isAlive() {
    try {
      this.client.connect();
      return true;
    } catch (err) {
      return false;
    }
  }

  /*
   * returns the number of documents in the collection users
   */

  async nbUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  /*
   * returns the number of documents in the collection files
   */

  async nbFiles() {
    return this.client.db().collection('files').countDocuments();
  }
}

export const dbClient = new DBClient();
export default dbClient;
