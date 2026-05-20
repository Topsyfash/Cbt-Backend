const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cbt_questions',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 1200,quality: 'auto',fetch: 'auto',}],
  },
  params:async (req,file) => ({
  folder: 'cbt_questions',
  allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  transformation: [{ width: 1200, quality: 'auto', fetch: 'auto', }],
  public_id : `question_${Date.now()}`,
}),
});


const upload = multer({ storage });

module.exports = { cloudinary, upload };