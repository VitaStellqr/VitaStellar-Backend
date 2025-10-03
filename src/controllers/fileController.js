import { create } from 'ipfs-http-client';
import Record from '../models/Record.js';
import ApiResponse from '../utils/apiResponse.js';

// Configure IPFS client
const ipfs = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
});

// IPFS gateway URL for retrieving files
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

const fileController = {
  /**
   * Upload a file to IPFS and store CID in the record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  uploadFile: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if record exists
      const record = await Record.findById(id);
      if (!record) {
        return ApiResponse.error(res, 'Record not found', 404);
      }

      // Check if file exists in request
      if (!req.file) {
        return ApiResponse.error(res, 'No file uploaded', 400);
      }

      // Upload file to IPFS
      const result = await ipfs.add(req.file.buffer);
      const cid = result.path;

      // Add file info to record
      record.files.push({
        cid,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
      });

      await record.save();

      return ApiResponse.success(
        res,
        {
          cid,
          url: `${IPFS_GATEWAY}${cid}`,
        },
        'File uploaded successfully',
        201
      );
    } catch (error) {
      console.error('Error uploading file to IPFS:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  },

  /**
   * Get all files for a record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getFiles: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if record exists
      const record = await Record.findById(id);
      if (!record) {
        return ApiResponse.error(res, 'Record not found', 404);
      }

      // Transform files to include gateway URLs
      const files = record.files.map(file => ({
        cid: file.cid,
        fileName: file.fileName,
        fileType: file.fileType,
        uploadedAt: file.uploadedAt,
        url: `${IPFS_GATEWAY}${file.cid}`,
      }));

      return ApiResponse.success(res, { files }, 'Files retrieved successfully');
    } catch (error) {
      console.error('Error retrieving files:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  },
};

export default fileController;
