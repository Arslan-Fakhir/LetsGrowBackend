const express = require('express');
const User = require('../models/userModel')
const responseFunction = require('../utils/responseFunction');
const dotenv = require('dotenv');
dotenv.config();
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authTokenHandler = require('../middlewares/checkAuthToken');


router.post('/register', async (req, res) => {
    const { name, email, password,conPassword, role } = req.body;
    if (!name || !email || !password || !conPassword || !role) {
        return responseFunction(res, 400, 'All fields are required', null, false);
    }

    if (password.length < 6) {
        return responseFunction(res, 400, 'Password should be at least 6 characters long', null, false);
    }
    try {
        let user = await User.findOne({ email });

        if (user) {
            return responseFunction(res, 400, 'User already exists', null, false);
        }

        user = new User({
            name,
            email,
            password,
            role,
        });

        await user.save();


        const authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET_KEY, { expiresIn: '10d' });

        res.cookie('authToken', authToken, { httpOnly: true, secure: true, sameSite: 'none' });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'none' });

        user.password = undefined;
        return responseFunction(res, 200, 'Registered successfully', { user, authToken, refreshToken }, true);

    }
    catch (err) {
        return responseFunction(res, 500, 'Internal server error', err, false);
    }
})

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return responseFunction(res, 400, 'Invalid credentials', null, false);
        }
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {

            return responseFunction(res, 400, 'Invalid credentials', null, false);
        }
        const authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '1d' })
        const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET_KEY, { expiresIn: '10d' })


        user.password = undefined;

        res.cookie('authToken', authToken, { httpOnly: true, secure: true, sameSite: 'none' })
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'none' })

        return responseFunction(res, 200, 'Logged in successfully', { user, authToken, refreshToken }, true);

    }
    catch (err) {
        return responseFunction(res, 500, 'Internal server error', err, false);
    }
})


router.get('/checklogin', authTokenHandler, async (req, res, next) => {
    console.log('check login',req.message)
    res.json({
        ok: req.ok,
        message: req.message,
        userId: req.userId
    })
}
)


router.get('/getuser', authTokenHandler, async (req, res, next) => {

    try {
        const user = await User.findById(req.userId).select('-password');


        if (!user) {
            return responseFunction(res, 400, 'User not found', null, false);
        }
        return responseFunction(res, 200, 'User found', user, true);

    }
    catch (err) {
        return responseFunction(res, 500, 'Internal server error', err, false);
    }
})


router.get('/logout', authTokenHandler, async (req, res, next) => {
    res.clearCookie('authToken');
    res.clearCookie('refreshToken');

    res.json({
        ok: true,
        message: 'Logged out successfully'
    })
})

module.exports = router;