/* eslint-disable prettier/prettier */
import { z } from 'zod';

const rowSchema = z.object({
  patientId: z.string().nonempty(),
  name: z.string().min(2),
  age: z.number().int().min(0),
  gender: z.enum(['male', 'female', 'other']),
  diagnosis: z.string().optional(),
});

function validateRow(record) {
  try {
    const parsed = rowSchema.parse({
      patientId: record.patientId,
      name: record.name,
      age: parseInt(record.age, 10),
      gender: record.gender,
      diagnosis: record.diagnosis,
    });
    return { success: true, data: parsed };
  } catch (err) {
    return { success: false, errors: err.errors.map(e => e.message) };
  }
}

export { validateRow };
