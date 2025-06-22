const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: { 
        required: true, 
        type: String 
    },
    email: { 
        required: true, 
        type: String, 
        unique: true
    },
    password: { 
        required: true, 
        type: String 
    },
    role: { 
        type: String, 
        enum: ['entrepreneur', 'investor', 'admin'],
        required: true 
    },
    cnic: {
        type: String,
        required: false,
        unique: true,
        validate: {
            validator: function(v) {
                return /^\d{5}-\d{7}-\d{1}$/.test(v);
            },
            message: props => `${props.value} is not a valid CNIC format! Use XXXXX-XXXXXXX-X`
        }
    },
    contactNumber: {
        type: String,
        required: false,
        validate: {
            validator: function(v) {
                return /^(\+92|0)[0-9]{10}$/.test(v);
            },
            message: props => `${props.value} is not a valid Pakistani phone number!`
        }
    },
    profileImage: {
        public_id: {
            type: String,
            default: 'default-profile'
        },
        url: {
            type: String,
            default: 'https://res.cloudinary.com/your-cloud-name/image/upload/v1621234567/default-profile.png'
        }
    },
    location: {  // New nested field
        address: {
            type: String,
            trim: true,
            maxlength: [200, 'Address cannot exceed 200 characters']
        },
        city: {
            type: String,
            required: false  // Optional: Set to false if city is not mandatory
        },
        country: {
            type: String,
            required: false,
        }
    }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    const user = this;
    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 10);
    }
    next();
});

module.exports = mongoose.model('User', userSchema);