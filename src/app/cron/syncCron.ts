import cron from 'node-cron';
import { expireOverduePromotions } from '../modules/Promotion/promotion.services';
import { expireOverdueBanners } from '../modules/Banner/banner.services';

// ══════════════════════════════════════════════
//  SCHEDULED CRON JOBS
//  Runs automatically every day at 12:00 AM
//  Admin can also trigger manually via API
// ══════════════════════════════════════════════

export const startCronJobs = () => {
  // ── Promotion Expiry: Every day at 00:00 ──
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ [CRON] Running promotion expiry check...');
    try {
      const result = await expireOverduePromotions();
      console.log(`✅ [CRON] Promotions expired: ${result.modifiedCount}`);
    } catch (error) {
      console.error('❌ [CRON] Promotion expiry error:', error);
    }
  });

  // ── Banner Expiry: Every day at 00:00 ──
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ [CRON] Running banner expiry check...');
    try {
      const result = await expireOverdueBanners();
      console.log(`✅ [CRON] Banners expired: ${result.modifiedCount}`);
    } catch (error) {
      console.error('❌ [CRON] Banner expiry error:', error);
    }
  });

  console.log('🟢 Cron jobs registered successfully');
};
