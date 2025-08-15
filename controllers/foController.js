const familyorganiserDAO = require('../models/foModel');
const userDAO = require('../models/userModel.js');

const jwt = require('jsonwebtoken');
const db = new familyorganiserDAO("./data/events.db");
db.init();

exports.home_page = (req, res) => {

    db.getAllEvents().then((list) => {
        res.render("events", {
            'title': 'Family Organiser',
            'user': req.user,
        });
        console.log('promise resolved');
    })
        .catch((err) => {
            console.log('promise rejected');
        })
};

exports.registration_page = (req, res) => (
    res.render('user/register', {
        'title': 'Family Organiser',
    })
)
exports.handle_registration = (req, res) => {
    const user = req.body.username;
    const password = req.body.pass;
    const family = req.body.familyId;

    if (!user || !password) {
        res.send(401, "no user or no password");
        return;
    }
    userDAO.lookup(user, family, function (err, u) {
        if (u) {
            res.send(401, "User exists:", user);
            return;
        }
        userDAO.create(user, password, role = "administrator", family);
        res.redirect("/login");
    });
}


exports.new_event_entry = (req, res) => {
    userDAO.getAllUsersInFamily(req.family).then((users) => {
        const participantList = users.map(user => user.user)
        res.render('newEvent', {
            'title': 'Family Events',
            'user': req.user,
            'users': participantList
        })
    })
}
exports.post_new_event = (req, res) => {
    if (!req.body.organiser) {
        res.status(400).send("Events must be associated with an Organiser.");
        return;
    }
    db.addEvent(
        req.body.event,
        req.body.description,
        req.body.requiredItems,
        req.body.location,
        req.body.date,
        req.body.startTime,
        req.body.endTime,
        req.body.eventType,
        req.body.recurringPattern,
        req.user,
        req.family || 'family_1', // Default family if not provided
        req.body.participants,
    );
    res.redirect('/loggedIn');
}


exports.show_organiser_events = (req, res) => {
    const organiser = req.params.organiser;

    db.getEventsByUser(organiser).then((events) => {
        res.render('events', {
            title: `${organiser}'s Events - Brighter Family Events`,
            events: events,
            user: req.user,
        });
    })
        .catch((err) => {
            console.log('Error fetching events by organiser:', err);
            res.status(500).send('Error retrieving organiser events');
        });
};

exports.show_login_page = (req, res) => {
    const token = req.cookies.jwt;

    if (token) {
        try {
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            return res.redirect('/loggedIn');
        } catch { }
    }

    const error = req.query.error === 'invalid';
    res.render("user/login", {
        'title': 'Family Organiser- Login',
        error: error
    });
}

exports.handle_login = (req, res) => {
    const currentUser = req.body.username;
    const currentUserRole = req.body.role || 'member';
    const currentUserFamily = req.body.family;

    userDAO.lookup(currentUser, currentUserFamily, (err, user) => {
        if (err || !user) {
            return res.status(403).send('error or no user found');
        }
        db.getAllEvents().then((list) => {
            const events = list.filter(event => event.familyId === currentUserFamily);
            const eventsWithFlags = events.map(event => ({
                ...event,
                canEdit: event.organiser === currentUser
            }));
            res.render("events", {
                title: "Family Organiser",
                events: eventsWithFlags,
                user: user,
                role: currentUserRole,
                family: currentUserFamily
            });
        })
            .catch((err) => {
                console.log("promise rejected", err);
                res.status(500).send('Error retrieving events');
            });
    });
};

exports.logout = (req, res) => {
    res.clearCookie("jwt").status(200).redirect("/login");
}

exports.loggedIn_landing = (req, res) => {
    const currentUser = req.user;
    const currentUserRole = req.role;
    const currentUserFamily = req.family;

    userDAO.lookup(currentUser, currentUserFamily, (err, user) => {
        if (err || !user) {
            return res.status(403).send('error or no user found');
        }
        db.getAllEvents().then((list) => {
            const events = list.filter(event => event.familyId === currentUserFamily);
            const eventsWithFlags = events.map(event => ({
                ...event,
                canEdit: event.organiser === currentUser
            }));
            res.render("events", {
                title: "Family Organiser",
                events: eventsWithFlags,
                user: user,
                role: currentUserRole,
                family: currentUserFamily
            });
        })
            .catch((err) => {
                console.log("promise rejected", err);
                res.status(500).send('Error retrieving events');
            });
    });
}

// Show edit event form
exports.show_edit_event = (req, res) => {
    const eventId = req.params.id;
    const currentUser = req.user;
    const currentUserFamily = req.family;
    let familyMembers = [];

    userDAO.getAllUsersInFamily(currentUserFamily).then(
        (users) => {
            familyMembers = users.map(user => user.user)
        })

    userDAO.lookup(currentUser, currentUserFamily, (err, user) => {
        if (err || !user) return res.status(403).send('Error');
        db.getEventById(eventId).then((event) => {
            if (!event) {
                res.status(404).send('Event not found');
                return;
            }
            if (event.organiser !== currentUser) {
                return res.status(403).send('Forbidden');
            }
            // prepare flags for template selection
            const isAdhoc = event.eventType === 'ad-hoc';
            const isRecurring = event.eventType === 'recurring';
            res.render('editEvent', {
                title: 'Edit Event - Brighter Family Events',
                event: event,
                isAdhoc,
                isRecurring,
                user: user,
                participants: event.participants,
                familyMembers: familyMembers
            });
        })
            .catch((err) => {
                console.error('show_edit_event error:', err);
                res.status(500).send(`<pre>${err.stack}</pre>`);
            });
    });
};

// Update event
exports.update_event = (req, res) => {
    const eventId = req.params.id;
    const currentUser = req.user;

    userDAO.lookup(currentUser, req.family, (err, user) => {
        if (err || !user) return res.status(403).send('Forbidden');
        db.getEventById(eventId).then((event) => {
            if (!event) {
                res.status(404).send('Event not found');
                return;
            }
            if (event.organiser !== currentUser) {
                return res.status(403).send('Forbidden');
            }

            const updateData = {
                event: req.body.event,
                description: req.body.description,
                requiredItems: req.body.requiredItems,
                location: req.body.location,
                date: req.body.date,
                organiser: req.body.organiser,
                startTime: req.body.startTime,
                endTime: req.body.endTime,
                eventType: req.body.eventType,
                organiser: currentUser,
                familyId: event.familyId,
                participants: req.body.participants

            };
            db.updateEvent(eventId, updateData).then((numUpdated) => {
                if (numUpdated === 0) {
                    res.status(404).send('Event not found');
                    return;
                }
                res.redirect('/loggedIn');
            })
                .catch((err) => {
                    console.log('Error updating event:', err);
                    res.status(500).send('Error updating event');
                });
        })
            .catch((err) => {
                console.log('Error fetching event:', err);
                res.status(500).send('Error retrieving event');
            });
    });
};

// Delete event
exports.delete_event = (req, res) => {
    const eventId = req.params.id;
    const currentUser = req.user;
    userDAO.lookup(currentUser, req.family, (err, user) => {
        if (err || !user) return res.status(403).send('Forbidden');
        db.getEventById(eventId).then((event) => {
            if (!event) {
                res.status(404).send('Event not found');
                return;
            }
            if (event.organiser !== currentUser) {
                return res.status(403).send('Forbidden');
            }
            db.deleteEvent(eventId).then((numDeleted) => {
                if (numDeleted === 0) {
                    res.status(404).send('Event not found');
                    return;
                }
                res.redirect('/loggedIn');
            })
                .catch((err) => {
                    console.log('Error deleting event:', err);
                    res.status(500).send('Error deleting event');
                });
        })
            .catch((err) => {
                console.log('Error fetching event:', err);
                res.status(500).send('Error retrieving event');
            });
    });
};

// User Management Functions
exports.show_user_management = (req, res) => {
    userDAO.getAllUsers().then((users) => {
        familyUsers = users.filter(user => user.familyId === req.family);
        res.render('userManagement', {
            title: 'Manage Family Members',
            users: familyUsers,
            user: req.user
        });
    })
        .catch((err) => {
            console.log('Error fetching users:', err);
            res.status(500).send('Error retrieving users');
        });
}

exports.add_new_family_member = (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const role = req.body.role || 'member';
    family = req.family || 'family_1'; // Default family if not provided

    if (!username || !password) {
        res.status(400).send('Username and password required');
        return;
    }

    userDAO.lookup(username, family, (err, existingUser) => {
        if (existingUser && existingUser.familyId === family) {
            res.status(400).send(`User ${username} already exists`);
            return;
        }

        userDAO.addUser(username, password, role, family)
        res.redirect('/manage-users');
    })
}

exports.delete_user = (req, res) => {
    const username = req.params.user;

    userDAO.deleteUser(username).then((numDeleted) => {
        if (numDeleted === 0) {
            res.status(404).send('User not found');
            return;
        }
        res.redirect('/manage-users');
    })
        .catch((err) => {
            console.log('Error deleting user:', err);
            res.status(500).send('Error deleting user');
        });
}

// Show user details
exports.show_user_details = (req, res) => {
    const username = req.params.user;
    userDAO.lookup(username, req.family, (err, userDetails) => {
        if (err || !userDetails) {
            res.status(404).send('User not found');
            return;
        }
        res.render('editUser', {
            title: `User Details - ${username}`,
            user: userDetails,
        });
    });
};

exports.edit_user = (req, res) => {
    const userIdForEdit = req.params.id;

    const currentUser = req.user;
    userDAO.getUserById(userIdForEdit, (err, user) => {
        if (err || !currentUser) return res.status(403).send('Forbidden');
        if (!user) {
            res.status(404).send('User not found');
            return;
        }
        res.render('editUser', {
            title: 'Edit User',
            user: user
        });
    })
}

exports.update_user = (req, res) => {
    const userIdForEdit = req.params.id;
    const family = req.family;

    const updateData = {
        user: req.body.username,
        role: req.body.role,
        familyId: family,
        _id: userIdForEdit
    };

    userDAO.updateUser(userIdForEdit, updateData).then((numUpdated) => {
        if (numUpdated === 0) {
            res.status(404).send('User not updated');
            return;
        }
        res.redirect('/manage-users');
    })
        .catch((err) => {
            console.log('Error updating user:', err);
            res.status(500).send('Error updating event');
        });
}

exports.json_events_endpoint = (req, res) => {
    db.getAllEvents().then((list) => {
        res.json(list);
    })
}

exports.json_users_endpoint = (req, res) => {
    userDAO.getAllUsers().then((users) => {
        res.json(users);
    })
}