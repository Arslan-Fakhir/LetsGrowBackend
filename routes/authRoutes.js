
const express = require('express');
const User = require('../models/userModel')
const Verification = require('../models/verificationModel');
const responseFunction = require('../utils/responseFunction');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authTokenHandler = require('../middlewares/checkAuthToken');



const mailer = async (recieveremail, code) => {
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: process.env.COMPANY_EMAIL,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });

    let info = await transporter.sendMail({
        from: "Team Let's Grow",
        to: recieveremail,
        subject: "OTP for Let's Grow",
        text: `Your OTP is ${code} (valid for 10 minutes)`,
        html: `<b>Your OTP is ${code} (valid for 10 minutes)</b>`,
    });

    console.log("Message sent: %s", info.messageId);
    return !!info.messageId;
};

router.get('/', (req, res) => {
    res.json({
        message: 'Auth route home'
    })
})

router.post('/sendotp', async (req, res) => {
    const { email } = req.body;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return responseFunction(res, 400, "Valid email is required", null, false);
    }

    try {
        // Delete existing OTPs for this email
        await Verification.deleteMany({ email });

        // Generate secure OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode = await bcrypt.hash(code, 10);

        // Save OTP with expiration (10 minutes)
        const newVerification = new Verification({
            email,
            code: code,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });
        await newVerification.save();

        // Send OTP email
        const isSent = await mailer(email, code);
        if (!isSent) {
            await Verification.deleteOne({ email });
            return responseFunction(res, 500, "Failed to send OTP email", null, false);
        }

        return responseFunction(res, 200, "OTP sent successfully", null, true);
    } catch (err) {
        console.error("OTP Error:", err);
        return responseFunction(res, 500, "Error processing OTP request", null, false);
    }
});

router.post('/register', async (req, res) => {
    const { name, email, password, otp, role } = req.body;
    if (!name || !email || !password || !otp || !role) {
        return responseFunction(res, 400, 'All fields are required', null, false);
    }

    if (password.length < 6) {
        return responseFunction(res, 400, 'Password should be at least 6 characters long', null, false);
    }
    try {
        let user = await User.findOne({ email });
        let verificationQueue = await Verification.findOne({ email });

        if (user) {
            return responseFunction(res, 400, 'User already exists', null, false);
        }

        if (!verificationQueue) {
            return responseFunction(res, 400, 'Please send OTP first', null, false);
        }
        const isMatch = await bcrypt.compare(otp, verificationQueue.code);

        if (!isMatch) {
            return responseFunction(res, 400, 'Invalid OTP', null, false);
        }

        user = new User({
            name,
            email,
            password,
            role,
        });

        await user.save();
        await Verification.deleteOne({ email });


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
        userId: req.userId,
        role: req.role
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


/////////////////////////////////////////////////////////////////////////








// ... rest of your authRoutes.js remains the same ...





module.exports = router;
