describe('passport Google strategy', () => {
   const mockUse = jest.fn();
   const mockDone = jest.fn();
   const mockFindOne = jest.fn();
   const mockCreate = jest.fn();
   const mockLoggerError = jest.fn();

   const loadPassportModule = () => {
      jest.resetModules();
      jest.doMock('passport', () => ({ use: mockUse }));
      jest.doMock('passport-google-oauth20', () => ({
         Strategy: jest.fn().mockImplementation((config, callback) => ({
            config,
            callback
         }))
      }));
      jest.doMock('../src/config/env', () => ({
         GOOGLE_CLIENT_ID: 'client-id',
         GOOGLE_CLIENT_SECRET: 'client-secret',
         GOOGLE_CALLBACK_URL: 'http://localhost/callback'
      }));
      jest.doMock('../src/config/logger', () => ({
         error: mockLoggerError
      }));
      jest.doMock('../src/models/user.model', () => ({
         findOne: mockFindOne,
         create: mockCreate
      }));

      const passport = require('../src/config/passport');
      const strategy = mockUse.mock.calls[0][0];
      const callback = strategy.callback;

      return { passport, callback };
   };

   beforeEach(() => {
      jest.clearAllMocks();
      mockFindOne.mockReset();
      mockCreate.mockReset();
   });

   it('registers a GoogleStrategy with the expected config', () => {
      const { callback } = loadPassportModule();
      expect(mockUse).toHaveBeenCalledTimes(1);
      const strategy = mockUse.mock.calls[0][0];
      expect(strategy.config).toEqual({
         clientID: 'client-id',
         clientSecret: 'client-secret',
         callbackURL: 'http://localhost/callback'
      });
      expect(typeof callback).toBe('function');
   });

   it('rejects a Google profile with no email', async () => {
      const { callback } = loadPassportModule();
      await callback('token', 'refresh', { emails: [] }, mockDone);

      expect(mockDone).toHaveBeenCalledWith(new Error('Google account has no email'), null);
   });

   it('rejects a Google account whose email is not verified', async () => {
      const { callback } = loadPassportModule();
      await callback('token', 'refresh', {
         id: 'google-123',
         emails: [{ value: 'user@example.com' }],
         _json: { email_verified: false }
      }, mockDone);

      expect(mockDone).toHaveBeenCalledWith(new Error('Google email not verified'), null);
   });

   it('merges a Google account into an existing local user and saves avatar when missing', async () => {
      const { callback } = loadPassportModule();
      const user = {
         _id: 'user-1',
         email: 'user@example.com',
         googleId: undefined,
         isEmailVerified: false,
         avatar: '',
         save: jest.fn().mockResolvedValue(true)
      };

      mockFindOne.mockResolvedValue(user);

      await callback('token', 'refresh', {
         id: 'google-123',
         emails: [{ value: 'user@example.com' }],
         _json: { email_verified: true },
         photos: [{ value: 'https://avatar' }]
      }, mockDone);

      expect(mockFindOne).toHaveBeenCalledWith({ email: 'user@example.com' });
      expect(user.googleId).toBe('google-123');
      expect(user.isEmailVerified).toBe(true);
      expect(user.avatar).toBe('https://avatar');
      expect(user.save).toHaveBeenCalledTimes(1);
      expect(mockDone).toHaveBeenCalledWith(null, user);
   });

   it('creates a new user when Google signs in with an email that does not exist yet', async () => {
      const { callback } = loadPassportModule();
      const createdUser = {
         _id: 'new-user',
         email: 'created@example.com',
         username: 'created'
      };

      mockFindOne.mockResolvedValue(null);
      mockCreate.mockResolvedValue(createdUser);

      await callback('token', 'refresh', {
         id: 'google-999',
         displayName: 'Created User',
         emails: [{ value: 'created@example.com' }],
         _json: { email_verified: true },
         photos: [{ value: 'https://avatar-new' }]
      }, mockDone);

      expect(mockFindOne).toHaveBeenCalledWith({ email: 'created@example.com' });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockDone).toHaveBeenCalledWith(null, createdUser);
   });

   it('rejects an existing user when Google account IDs do not match', async () => {
      const { callback } = loadPassportModule();
      mockFindOne.mockResolvedValue({
         email: 'user@example.com',
         googleId: 'other-google-id',
         save: jest.fn()
      });

      await callback('token', 'refresh', {
         id: 'google-123',
         emails: [{ value: 'user@example.com' }],
         _json: { email_verified: true }
      }, mockDone);

      expect(mockDone).toHaveBeenCalledWith(new Error('Google account mismatch'), null);
   });

   it('creates a new user and retries if the generated username collides', async () => {
      const { callback } = loadPassportModule();
      const createdUser = {
         _id: 'new-user',
         email: 'new-user@example.com',
         username: 'john1'
      };

      mockCreate
         .mockRejectedValueOnce({ code: 11000, message: 'username duplicate', keyPattern: { username: true } })
         .mockResolvedValueOnce(createdUser);

      await callback('token', 'refresh', {
         id: 'google-123',
         displayName: 'John Doe',
         emails: [{ value: 'new-user@example.com' }],
         _json: { email_verified: true },
         photos: [{ value: 'https://avatar' }]
      }, mockDone);

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockDone).toHaveBeenCalledWith(null, createdUser);
   });

   it('returns an error when the username generation loop exhausts attempts', async () => {
      const { callback } = loadPassportModule();
      mockFindOne.mockResolvedValue(null);
      mockCreate.mockRejectedValue({ code: 11000, message: 'username duplicate', keyPattern: { username: true } });

      await callback('token', 'refresh', {
         id: 'google-123',
         displayName: 'John Doe',
         emails: [{ value: 'new-user@example.com' }],
         _json: { email_verified: true }
      }, mockDone);

      expect(mockDone).toHaveBeenCalledWith(
         new Error('Failed to generate a unique username after maximum attempts.'),
         null
      );
   });

   it('logs and forwards unexpected errors from Google OAuth callback processing', async () => {
      const { callback } = loadPassportModule();
      mockFindOne.mockRejectedValue(new Error('db exploded'));

      await callback('token', 'refresh', {
         id: 'google-123',
         emails: [{ value: 'user@example.com' }],
         _json: { email_verified: true }
      }, mockDone);

      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockDone).toHaveBeenCalledWith(new Error('db exploded'), null);
   });
});
