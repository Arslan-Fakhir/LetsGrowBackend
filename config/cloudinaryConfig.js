const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// User profile storage
const userStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'user-profiles',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{quality: 'auto', fetch_format: 'auto'}, {width: 500, height: 500, crop: 'fill', gravity: 'auto'}]
  }
});

// Startup image storage
const startupStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'startup-images',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{quality: 'auto', fetch_format: 'auto'}, {width: 800, height: 600, crop: 'fill', gravity: 'auto'}],
    resource_type: 'image'
  }
});

module.exports = { 
  cloudinary, 
  userStorage, 
  startupStorage,
  CloudinaryStorage 
};