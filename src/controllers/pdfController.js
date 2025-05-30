import PDFDocument from 'pdfkit';
import Record from '../models/Record.js';
import ApiResponse from '../utils/ApiResponse.js';

const pdfController = {
  generatePDF: async (req, res) => {
    try {
      const record = await Record.findById(req.params.id);
      
      if (!record) {
        return ApiResponse.error(res, 'Record not found', 404);
      }

      // Create a new PDF document
      const doc = new PDFDocument();
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="patient-record-${record._id}.pdf"`);
      
      // Pipe the PDF directly to the response
      doc.pipe(res);

      // Add content to the PDF
      doc.fontSize(25).text('Patient Medical Record', { align: 'center' });
      doc.moveDown();

      // Add patient information
      doc.fontSize(12);
      doc.text(`Patient Name: ${record.patientName}`);
      doc.text(`Date: ${record.date.toLocaleDateString()}`);
      doc.moveDown();

      // Add diagnosis
      doc.fontSize(14).text('Diagnosis:', { underline: true });
      doc.fontSize(12).text(record.diagnosis);
      doc.moveDown();

      // Add treatment
      doc.fontSize(14).text('Treatment:', { underline: true });
      doc.fontSize(12).text(record.treatment);
      doc.moveDown();

      // Add transaction hash
      doc.fontSize(14).text('Transaction Hash:', { underline: true });
      doc.fontSize(12).text(record.txHash);
      doc.moveDown();

      // Add footer
      doc.fontSize(10)
        .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

      // Finalize the PDF
      doc.end();
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
};

export default pdfController; 