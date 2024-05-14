import envLoader from './utils/env.js'
/*
 * creates an express server
 */

const express = require('express')
const app = express()

envLoader()
const port = process.env.PORT || 5000

const apiRouter = require('./routes/index')

app.listen(5000, () => console.log("server started"))
