const bcrypt = require('bcrypt');
const usermodel = require('../models/userModel');
const jwt = require('jsonwebtoken');


exports.login = (req, res, next) => {
    let username = req.body.username;
    let family = req.body.family;
    let password = req.body.password;

    usermodel.lookup(username, family, (err, user) => {
        if (err) {
            console.log("error looking up user", err);
            return res.redirect('/login?error=invalid');
        }
        if (!user) {
            console.log("user ", username, " not found");
            return res.redirect('/login?error=invalid');
        }

        // compare provided password with stored password
        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                let payload = { username: user.user, userrole: user.role, userfamily: user.familyId };
                let accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET);
                res.cookie("jwt", accessToken, { httpOnly: true, path: '/' });
                next();
            } else {
                return res.redirect('/login?error=invalid');
            }
        });
    });
};

exports.verify = (req, res, next) => {

    let accessToken = req.cookies.jwt;
    if (!accessToken) {
        return res.status(403).send();
    }

    let payload;
    try {
        payload = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        req.user = payload.username;
        req.role = payload.userrole;
        req.family = payload.userfamily;
        next();
    }
    catch (e) {
        res.status(401).send();
    }
};
exports.verifyAdmin = function (req, res, next) {
    let accessToken = req.cookies.jwt;
    let payload = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

    if (payload.userrole != "administrator" && payload.userrole != "organiser") {
        return res.status(403).send();
    }
    try {
        req.user = payload.username;
        req.role = payload.userrole;
        req.family = payload.userfamily;
        next();
    } catch (e) {
        //if an error occured return request unauthorized error
        res.status(401).send();
    }
};