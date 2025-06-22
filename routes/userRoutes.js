const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const { cloudinary, storage } = require('../config/cloudinaryConfig');
const multer = require('multer');
const upload = multer({ storage });
const authTokenHandler = require('../middlewares/checkAuthToken');
const responseFunction = require('../utils/responseFunction');
const bcrypt = require('bcrypt');

// Get user profile
router.get('/profile', authTokenHandler, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return responseFunction(res, 404, 'User not found', null, false);
        }
        
        // If profileImage doesn't exist, set default
        if (!user.profileImage || !user.profileImage.url) {
            user.profileImage = {
                url: 'https://res.cloudinary.com/dziwmxkww/image/upload/v1621234567/default-profile.png'
            };
        }

        return responseFunction(res, 200, 'User profile retrieved', {
            id: user._id,
            fullName: user.name,
            name: user.name,
            email: user.email,
            cnic: user.cnic,
            contactNumber: user.contactNumber,
            contact: user.contactNumber,
            address: user.address,
            location: user.location,
            profileImage: user.profileImage,
            role: user.role
        }, true);
    } catch (error) {
        console.error('Error fetching profile:', error);
        return responseFunction(res, 500, 'Error retrieving profile', error.message, false);
    }
});

// Update user profile with image
router.put('/profile/image', authTokenHandler, upload.single('profileImage'), async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return responseFunction(res, 404, 'User not found', null, false);
        }

        // Delete old image from Cloudinary if it's not the default
        if (user.profileImage.public_id && user.profileImage.public_id !== 'default-profile') {
            await cloudinary.uploader.destroy(user.profileImage.public_id);
        }

        // Update with new image
        if (req.file) {
            user.profileImage = {
                public_id: req.file.filename,
                url: req.file.path
            };
            await user.save();
        }

        return responseFunction(res, 200, 'Profile image updated successfully', {
            profileImage: user.profileImage
        }, true);
    } catch (error) {
        console.error('Image upload error:', error);
        return responseFunction(res, 500, 'Error updating profile image', error.message, false);
    }
});

// ... (previous imports remain the same)

// Update user profile (general details)
router.put('/profile', authTokenHandler, async (req, res) => {
    try {
        const { name, contactNumber, cnic, address, city, country, currentPassword, newPassword } = req.body;
        const updates = {};
        
        // Basic info updates
        if (name !== undefined) updates.name = name;
        if (contactNumber !== undefined) updates.contactNumber = contactNumber;
        if (cnic !== undefined) updates.cnic = cnic;
        
        // Location updates
        const locationUpdates = {};
        if (address !== undefined) locationUpdates.address = address;
        if (city !== undefined) locationUpdates.city = city;
        if (country !== undefined) locationUpdates.country = country;
        
        if (Object.keys(locationUpdates).length > 0) {
            updates.location = locationUpdates;
        }

        // Handle password change if provided
        if (currentPassword && newPassword) {
            const user = await User.findById(req.userId);
            if (!user) {
                return responseFunction(res, 404, 'User not found', null, false);
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return responseFunction(res, 400, 'Current password is incorrect', null, false);
            }

            if (newPassword.length < 6) {
                return responseFunction(res, 400, 'Password must be at least 6 characters', null, false);
            }

            updates.password = newPassword;
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return responseFunction(res, 404, 'User not found', null, false);
        }

        return responseFunction(res, 200, 'Profile updated successfully', {
            id: user._id,
            name: user.name,
            email: user.email,
            cnic: user.cnic,
            contactNumber: user.contactNumber,
            profileImage: user.profileImage,
            location: user.location
        }, true);
    } catch (error) {
        console.error('Profile update error:', error);
        if (error.name === 'ValidationError') {
            const errors = {};
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
            return responseFunction(res, 400, 'Validation error', errors, false);
        }
        return responseFunction(res, 500, 'Error updating profile', error.message, false);
    }
});

// ... (rest of the file remains the same)

module.exports = router;