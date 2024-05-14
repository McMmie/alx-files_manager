import dbClient from '../utils/db'
import redisClient from '../utils/redis'

export default class AppController {
  getStatus(req, res) {

    req.status(200).json(
      { "redis": redisClient.isAlive(),
        "db": dbClient.isAlive()
      })

  }
 
  getStats(req, res) {

    req.status(200).json(
      { "users": dbClient.nbUsers(),
        "files": dbClient.nbFiles()
      })

  }
}
