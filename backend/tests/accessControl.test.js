const { getPlans } = require('../src/config/plans');
const accessControl = require('../src/utils/accessControl');

jest.mock('../src/services/planCache.service', () => ({
   getAllPlans: jest.fn(() => [
      {
         planKey: 'pro',
         name: 'Pro',
         level: 1,
         isActive: true,
         features: { canDownload: true, maxDownloads: 10 },
         prices: [{ active: true, interval: 'monthly', stripePriceId: 'price_pro_month' }]
      },
      {
         planKey: 'max',
         name: 'Max',
         level: 2,
         isActive: true,
         features: { canDownload: true, maxDownloads: 100 },
         prices: [{ active: true, interval: 'monthly', stripePriceId: 'price_max_month' }]
      }
   ]),
   resolvePriceId: jest.fn(),
   resolvePlanFromPriceId: jest.fn()
}));

describe('accessControl', () => {
   it('treats missing or expired subscriptions as free-tier access', () => {
      expect(accessControl.isEntitled()).toBe(false);
      expect(accessControl.isEntitled({ status: 'canceled', expiresAt: new Date(Date.now() + 60000).toISOString() })).toBe(false);
      expect(accessControl.getEffectiveLevel({ subscription: { plan: 'free' } })).toBe(0);
   });

   it('promotes a trialing subscription to the paid effective level', () => {
      const user = {
         subscription: {
            plan: 'pro',
            status: 'trialing',
            expiresAt: new Date(Date.now() + 60000).toISOString()
         }
      };

      expect(accessControl.getEffectiveLevel(user)).toBe(1);
   });

   it('requires the minimum plan level and throws otherwise', () => {
      expect(() => accessControl.requirePlan({ subscription: { plan: 'free', status: 'active' } }, 'pro')).toThrow('This feature requires the pro plan or higher');
      expect(accessControl.requirePlan({ subscription: { plan: 'pro', status: 'active' } }, 'free')).toBe(true);
   });

   it('allows paid users to play unlimited songs and free users to play with a daily usage counter', () => {
      expect(accessControl.canPlaySong({ subscription: { plan: 'pro', status: 'active' } })).toEqual({ allowed: true, unlimited: true });
      expect(accessControl.canPlaySong({ subscription: { plan: 'free', status: 'active' } })).toEqual({ allowed: true, unlimited: false });
   });

   it('checks download permission via plan features rather than raw subscription status', () => {
      expect(accessControl.canDownloadSong({ subscription: { plan: 'pro', status: 'active' } })).toBe(true);
      expect(() => accessControl.canDownloadSong({ subscription: { plan: 'free', status: 'active' } })).toThrow('Downloads require the Pro plan or higher');
   });

   it('restricts upload to approved artists and blocks non-artists', () => {
      expect(accessControl.canUpload({ role: 'artist', artistVerification: { status: 'approved' } })).toBe(true);
      expect(() => accessControl.canUpload({ role: 'user', artistVerification: { status: 'approved' } })).toThrow('Only artists allowed');
      expect(() => accessControl.canUpload({ role: 'artist', artistVerification: { status: 'pending' } })).toThrow('Artist not approved');
   });

   it('restricts create-content access to artists with an approved verification status', () => {
      expect(accessControl.canCreateContent({ role: 'artist', artistVerification: { status: 'approved' } })).toBe(true);
      expect(() => accessControl.canCreateContent({ role: 'user', artistVerification: { status: 'approved' } })).toThrow('Artist access required');
      expect(() => accessControl.canCreateContent({ role: 'artist', artistVerification: { status: 'pending' } })).toThrow('Artist not verified');
   });

   it('returns the live plan metadata for the effective plan features', () => {
      const plans = getPlans();
      expect(plans.pro.features.canDownload).toBe(true);
      expect(accessControl.getPlanFeatures({ subscription: { plan: 'max', status: 'active' } }).maxDownloads).toBe(100);
   });
});
