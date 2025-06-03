import Record from '../models/Record.js';
import ApiResponse from '../utils/ApiResponse.js';

// IPFS gateway URL for retrieving files
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

const recordController = {
  /**
   * Get all records
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllRecords: async (req, res) => {
    try {
      const records = await Record.find().populate('createdBy', 'username email');
      
      // Transform records to include file URLs
      const transformedRecords = records.map(record => {
        const recordObj = record.toObject();
        
        // Add IPFS gateway URLs to files
        if (recordObj.files && recordObj.files.length > 0) {
          recordObj.files = recordObj.files.map(file => ({
            ...file,
            url: `${IPFS_GATEWAY}${file.cid}`,
          }));
        }
        
        return recordObj;
      });
      
      return ApiResponse.success(
        res,
        { records: transformedRecords },
        'Records retrieved successfully'
      );
    } catch (error) {
      console.error('Error retrieving records:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  },
  
  /**
   * Get a record by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getRecordById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const record = await Record.findById(id).populate('createdBy', 'username email');
      if (!record) {
        return ApiResponse.error(res, 'Record not found', 404);
      }
      
      // Transform record to include file URLs
      const recordObj = record.toObject();
      
      // Add IPFS gateway URLs to files
      if (recordObj.files && recordObj.files.length > 0) {
        recordObj.files = recordObj.files.map(file => ({
          ...file,
          url: `${IPFS_GATEWAY}${file.cid}`,
        }));
      }
      
      return ApiResponse.success(
        res,
        { record: recordObj },
        'Record retrieved successfully'
      );
    } catch (error) {
      console.error('Error retrieving record:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  },
  
  /**
   * Create a new record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createRecord: async (req, res) => {
    try {
      const { patientName, diagnosis, treatment, txHash } = req.body;
      
      // Create new record
      const record = new Record({
        patientName,
        diagnosis,
        treatment,
        txHash,
        createdBy: req.user._id,
      });
      
      await record.save();
      
      return ApiResponse.success(
        res,
        { record },
        'Record created successfully',
        201
      );
    } catch (error) {
      console.error('Error creating record:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  },
  
  /**
   * Update a record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateRecord: async (req, res) => {
    try {
      const { id } = req.params;
      const { patientName, diagnosis, treatment } = req.body;
      
      const record = await Record.findById(id);
      if (!record) {
        return ApiResponse.error(res, 'Record not found', 404);
      }
      
      // Update record fields
      if (patientName) record.patientName = patientName;
      if (diagnosis) record.diagnosis = diagnosis;
      if (treatment) record.treatment = treatment;
      
      await record.save();
      
      return ApiResponse.success(
        res,
        { record },
        'Record updated successfully'
      );
    } catch (error) {
      console.error('Error updating record:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  },
  
  /**
   * Delete a record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteRecord: async (req, res) => {
    try {
      const { id } = req.params;
      
      const record = await Record.findByIdAndDelete(id);
      if (!record) {
        return ApiResponse.error(res, 'Record not found', 404);
      }
      
      return ApiResponse.success(
        res,
        null,
        'Record deleted successfully'
      );
    } catch (error) {
      console.error('Error deleting record:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  },
};

export default recordController;
