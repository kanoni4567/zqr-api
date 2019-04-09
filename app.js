const express = require("express");
const app = express();
const jwt = require("express-jwt");
const jwks = require("jwks-rsa");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const axios = require("axios");

const userZombies = require("./data/userZombies");
const userOpponents = require("./data/userOpponents");
const Battle = require("./battle/battle");
const bodies = require("./data/bodies");

const port = process.env.PORT || 8080;

const jwtCheck = jwt({
  secret: jwks.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: "https://zombie-qr.auth0.com/.well-known/jwks.json"
  }),
  audience: "https://www.zombie-qr-api.com",
  issuer: "https://zombie-qr.auth0.com/",
  algorithms: ["RS256"]
});

app.use(jwtCheck);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(morgan("dev"));
app.use((req, res, next) => {
  let token = req.headers["x-access-token"] || req.headers["authorization"];
  if (token.startsWith("Bearer ")) {
    token = token.slice(7, token.length);
  }
  // console.log(token)
  let config = {
    headers: {
      authorization: "Bearer " + token
    }
  };
  axios.get("https://zombie-qr.auth0.com/userinfo", config).then(result => {
    (req.user = result.data), (req.user.id = result.data.sub), next();
  });
});

app.get("/authorized", function(req, res) {
  console.log(req.user);
  console.log(req.userinfo);
  res.send("Secured Resource");
});

// Home index handle-er
app.get("/", (request, response) => {
  // console.log(request.user);
  let user = request.user;
  let zombie = userZombies.getZombieByUserId(user.id);
  response.json(zombie);
});

// Battle page handle-er
app.get("/battle", (req, res) => {
  let user = req.user;
  let opponents = userOpponents.getOpponentsByUserId(user.id);
  // console.log(opponents);

  res.json(opponents.humans);
});

// results page handle-er. Also starts a battle object and returns battle results
app.get("/battle/result/:index", async (req, res) => {
  let user = req.user;
  let zombie = userZombies.getZombieByUserId(user.id);
  let opponents = userOpponents.getOpponentsByUserId(user.id);
  let target = opponents.humans[req.params.index];
  let battle = new Battle();
  let url = null;
  battle.initialize({
    ally: zombie,
    foe: target
  });
  result = await battle.start();
  // console.log('result' + result);
  // console.log(battle);
  if (result.winner) {
    url = bodies.generateBody(zombie, target);
    userOpponents.deleteOpponentsForUser(req.user.id);
  } else {
    userZombies.deleteZombieForUser(req.user.id);
  }
  console.log(result.log.split("\n"));
  res.json({ log: result.log, winner: result.winner, url });
});

// bodies page handle-er
app.get("/bodies", (req, res) => {
  let user = req.user;
  let bodyCollection = bodies.getBodyCollectionByUserId(user.id);
  res.json(bodyCollection.bodies);
});

// claimbody page handle-er
app.get("/body/:id", (req, res) => {
  let bodyFound = bodies.getBodyById(req.params.id);
  if (bodyFound) {
    res.json(bodyFound);
  } else {
    res.json({ err: "No body found!" });
  }
});

// claim body logic handle-er
app.post("/body", (req, res) => {
  // console.log(req.body);
  let bodyFound = bodies.getBodyById(req.body.bodyId);
  if (bodyFound) {
    userZombies.replaceZombieForUserWithBody(req.user.id, bodyFound);
    bodies.deleteBodyById(bodyFound.id);
    res.json({ result: "success" });
  } else {
    res.json({ err: "No body found!" });
  }
});

app.get("/jsonaccounts", function(req, res) {
  var file = __dirname + "/data/accounts.json";
  res.download(file);
});

app.get("/jsonzombies", function(req, res) {
  var file = __dirname + "/data/zombies.json";
  res.download(file);
});

app.get("/jsonbodies", function(req, res) {
  var file = __dirname + "/data/bodies.json";
  res.download(file);
});

app.get("/jsonopponents", function(req, res) {
  var file = __dirname + "/data/opponents.json";
  res.download(file);
});

app.listen(port);
