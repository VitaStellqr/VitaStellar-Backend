import multer from 'multer';
import ApiResponse from '../utils/ApiResponse.js';

// Configure multer storage to use memory storage
const storage = multer.memoryStorage();

// File filter to allow only JPEG and PNG files
const fileFilter = (req, file, cb) => {
  // Accept only jpeg, jpg, and png files
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG and PNG files are allowed'), false);
  }
};

// Configure multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Middleware to handle file upload errors
const handleUpload = (req, res, next) => {
  const uploadSingle = upload.single('file');
  
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      if (err.code === 'LIMIT_FILE_SIZE') {
        return ApiResponse.error(res, 'File size exceeds the 5MB limit', 400);
      }
      return ApiResponse.error(res, err.message, 400);
    } else if (err) {
      // An unknown error occurred
      return ApiResponse.error(res, err.message, 400);
    }
    
    // Everything went fine
    next();
  });
};

export default handleUpload;
