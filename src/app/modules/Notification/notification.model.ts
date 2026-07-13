import { Schema, model, Types } from 'mongoose';

const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: [
      'general', 'vendor_approved', 'vendor_rejected', 'profile_score_changed',
      'profile_visibility_changed', 'new_review', 'vendor_application',
      'new_vendor_registered', 'vendor_verification', 'availability_update',
      'booking_update', 'new_quote', 'new_quote_request', 'counter_offer',
      'quote_accepted', 'quote_declined', 'quote_won', 'quote_lost',
      'quote_milestone', 'lead_alert', 'price_drop', 'profile_score_nudge',
      'new_inspiration', 'advisor_offer', 'new_requirement',
      'request_cancelled', 'request_closed'
    ], 
    default: 'general' 
  },
  isRead: { type: Boolean, default: false },
  /** Optional structured payload for deep-linking and client logic */
  data: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export const NotificationModel = model('Notification', notificationSchema);