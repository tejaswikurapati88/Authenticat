const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server is running at http://localhost:3000'),
    )
  } catch (e) {
    console.log(`DB Error ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

const convertIntoCamel = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const isIfusernameRegistered = `select * from user where username = "${username}";`
  const userD = await db.get(isIfusernameRegistered)
  if (userD !== undefined) {
    const comparePassword = await bcrypt.compare(password, userD.password)
    if (comparePassword === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'fwrg24rfdfgethgfc')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

const authenticatToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'fwrg24rfdfgethgfc', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT token')
      } else {
        next()
      }
    })
  }
}

app.get('/states', authenticatToken, async (request, response) => {
  const getQuery = `
  SELECT * FROM state;`
  const dbResponse = await db.all(getQuery)
  response.send(dbResponse.map(eachObj => convertIntoCamel(eachObj)))
})

app.get('/states/:stateId/', authenticatToken, async (request, response) => {
  const {stateId} = request.params
  const getAStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};`
  const stateResponse = await db.get(getAStateQuery)
  response.send(convertIntoCamel(stateResponse))
})

app.post('/districts/', authenticatToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const insertQuery = `
  INSERT INTO district (district_name, state_id, cases, cured, active, deaths) 
  VALUES 
  ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`
  await db.run(insertQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticatToken,
  async (request, response) => {
    const {districtId} = request.params
    const getQuery = `
  SELECT * FROM district WHERE district_id = ${districtId};`
    const districtResponse = await db.get(getQuery)
    response.send(convertIntoCamel(districtResponse))
  },
)

app.delete(
  '/districts/:districtId/',
  authenticatToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `
  DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(deleteQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticatToken,
  async (request, response) => {
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const {districtId} = request.params
    const updateQuery = `
  UPDATE district 
  SET 
  
  district_name= "${districtName}",
  state_id= ${stateId},
  cases= ${cases},
  cured= ${cured},
  active= ${active},
  deaths= ${deaths}
   WHERE district_id = ${districtId};`
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticatToken,
  async (request, response) => {
    const {stateId} = request.params
    const statsQuery = `
  SELECT sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive,
  sum(deaths) as totalDeaths FROM district WHERE state_id = ${stateId};`
    const resultStats = await db.get(statsQuery)
    response.send(resultStats)
  },
)

module.exports = app
