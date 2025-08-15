const express = require('express');
const controller = require('../controllers/foController');
const { login } = require('../auth/auth');
const { verify } = require('../auth/auth')
const { verifyAdmin } = require('../auth/auth')
const router = express.Router();

router.get("/", controller.home_page);

router.get("/register", controller.registration_page);
router.post("/register", controller.handle_registration);


router.get('/events', verify, controller.loggedIn_landing);

router.get('/new-event-entry', verify, controller.new_event_entry);
router.post('/new-event-entry', verify, controller.post_new_event);

router.get('/events/:organiser', controller.show_organiser_events);

router.get('/edit-event/:id', verify, controller.show_edit_event);
router.post('/edit-event/:id', verify, controller.update_event);
router.get('/delete-event/:id', verify, controller.delete_event);

router.get('/manage-users', verifyAdmin, controller.show_user_management);
router.post('/add-user', verifyAdmin, controller.add_new_family_member);
router.get('/edit-user/:user', verifyAdmin, controller.show_user_details);
router.post('/edit-user/:id', verifyAdmin, controller.update_user);
router.get('/delete-user/:user', verifyAdmin, controller.delete_user);


router.get('/manage-individual-user', verify, controller.show_user_details);

router.get('/login', controller.show_login_page);
router.post('/login', login, controller.handle_login);

router.get("/loggedIn", verify, controller.loggedIn_landing);

router.get('/logout', controller.logout);

router.get('/all-events', controller.json_events_endpoint);
router.get('/all-users', controller.json_users_endpoint);

router.use((req, res) => {
    res.status(404);
    res.type('text/plain');
    res.send('404 Not found');
});

// router.use((err, req, res, next) => {
//     res.status(500);
//     res.type('text/plain');
//     res.send("Internal Server Error.");
// })


module.exports = router;