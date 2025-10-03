const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const fileService = require('../services/fileService');
const { queueVirusScan } = require('../services/scanService');

// POST /files/signed-upload - Generate signed upload URL
router.post('/signed-upload', authenticate, async (req, res) => {
  try {
    const { filename, contentType, size } = req.body;

    // Validation
    if (!filename || !contentType || !size) {
      return res.status(400).json({
        error: 'Missing required fields: filename, contentType, size',
      });
    }

    // File size limit (100MB)
    const maxSize = 100 * 1024 * 1024;
    if (size > maxSize) {
      return res.status(400).json({
        error: `File size exceeds maximum allowed size of ${maxSize} bytes`,
      });
    }

    // Allowed content types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({
        error: 'File type not allowed',
      });
    }

    // Generate signed URL
    const { uploadUrl, key, expiresIn } = await fileService.generateSignedUploadUrl(
      req.userId,
      filename,
      contentType,
      size
    );

    // Create file record
    const file = new File({
      userId: req.userId,
      key,
      filename,
      contentType,
      size,
      status: 'pending',
    });

    await file.save();

    res.json({
      uploadUrl,
      fileId: file._id,
      key,
      expiresIn,
      message: 'Upload the file using PUT request to the uploadUrl',
    });
  } catch (err) {
    console.error('Error generating signed upload URL:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// POST /files/:fileId/confirm - Confirm upload completion and trigger scan
router.post('/:fileId/confirm', authenticate, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.fileId,
      userId: req.userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.status !== 'pending') {
      return res.status(400).json({ error: 'File already confirmed' });
    }

    // Update status and queue for scanning
    file.status = 'scanning';
    await file.save();

    // Queue virus scan job
    await queueVirusScan(file._id);

    res.json({
      fileId: file._id,
      status: file.status,
      message: 'File uploaded successfully and queued for scanning',
    });
  } catch (err) {
    console.error('Error confirming upload:', err);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

// GET /files/:fileId - Get file metadata
router.get('/:fileId', authenticate, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.fileId,
      userId: req.userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      id: file._id,
      filename: file.filename,
      contentType: file.contentType,
      size: file.size,
      status: file.status,
      uploadedAt: file.uploadedAt,
      scanResult: file.scanResult,
    });
  } catch (err) {
    console.error('Error fetching file:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// GET /files/:fileId/download - Get signed download URL
router.get('/:fileId/download', authenticate, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.fileId,
      userId: req.userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check file status
    if (file.status === 'infected' || file.status === 'quarantined') {
      return res.status(403).json({
        error: 'File is quarantined due to security concerns',
        status: file.status,
      });
    }

    if (file.status === 'scanning' || file.status === 'pending') {
      return res.status(202).json({
        error: 'File is still being processed',
        status: file.status,
        message: 'Please try again in a few moments',
      });
    }

    // Generate signed download URL
    const downloadUrl = await fileService.generateSignedDownloadUrl(file.key);

    // Update last accessed timestamp
    file.lastAccessedAt = new Date();
    await file.save();

    res.json({
      downloadUrl,
      filename: file.filename,
      contentType: file.contentType,
      expiresIn: fileService.downloadTTL,
    });
  } catch (err) {
    console.error('Error generating download URL:', err);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// GET /files - List user's files
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userId: req.userId };
    if (status) {
      query.status = status;
    }

    const files = await File.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await File.countDocuments(query);

    res.json({
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// DELETE /files/:fileId - Delete file
router.delete('/:fileId', authenticate, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.fileId,
      userId: req.userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from S3
    await fileService.deleteFile(file.key);

    // Delete from database
    await file.deleteOne();

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
