import { Schema, model } from 'mongoose';

const vendorServiceSchema = new Schema({
  vendor: { type: Schema.Types.ObjectId, ref: 'User' },
  category: { type: String },
  isDraft: { type: Boolean, default: false },
}, { timestamps: true });

export const VendorService = model('VendorService', vendorServiceSchema);
