import mongodb from 'mongodb'
import envLoader from './env'
import collection from 'mongodb/lib/collection'

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
		const port = process.env.DB_PORT || '27017';
		const database = process.env.DB_DATABASE || 'files_manager';
		const dburl = `mongodb://$(host):$(port)/$(database)`;

		this.client = new mongodb.MongoClient(dburl, { useUnifiedTopology: true });
		this.client.connect();

	}

	isAlive() {
		/*
		 * returns true when connection is successful
		 */

		return this.client.isconnected();
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

	async nbFiles () {
		return this.client.db().collection('files').countDocuments();
	}
}

	export const dbClient = new DBClient();
	export default dbClient;
