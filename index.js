const express = require('express');
const app = express();
const path = require('path')
const bodyParser = require('body-parser');
const mustache = require('mustache-express');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cors = require('cors');
app.use(cors());

// importing the router from foRoutes that will start at root of application
const router = require('./routes/foRoutes')

const public = path.join(__dirname, 'public');
app.use(express.static(public));

// Middle ware for parsing the incoming request bodies
app.use(bodyParser.urlencoded({ extended: false }));

const cookieParser = require('cookie-parser')
app.use(cookieParser())

// Decode JWT if present and set req.user for all routes
app.use((req, res, next) => {
    const token = req.cookies.jwt;
    if (token) {
        try {
            const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            req.user = payload.username;
            req.role = payload.role;
            req.family = payload.family;
        } catch (e) {
            // invalid token, ignore
        }
    }
    next();
});

app.engine('mustache', mustache());
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

app.use('/', router);

app.listen(3000, () => {
    console.log('Server started on port 3000. Ctrl^c to quit.')
})