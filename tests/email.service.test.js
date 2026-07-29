const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({
   createTransport: mockCreateTransport
}));

const loadEmailService = (envOverrides = {}) => {
   jest.resetModules();
   jest.doMock('../src/config/env', () => ({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      EMAIL_FROM: 'noreply@example.com',
      ...envOverrides
   }));

   return require('../src/services/email.service');
};

describe('email.service', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockSendMail.mockResolvedValue({ messageId: 'msg_1' });
   });

   it('logs the reset link when SMTP is not configured', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const { sendPasswordResetEmail } = loadEmailService({
         SMTP_HOST: '',
         SMTP_USER: '',
         SMTP_PASS: ''
      });

      await sendPasswordResetEmail('user@example.com', 'https://reset.example/token');

      expect(mockCreateTransport).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Password reset link'));
      consoleSpy.mockRestore();
   });

   it('sends a password reset email through SMTP when configured', async () => {
      const { sendPasswordResetEmail } = loadEmailService();

      await sendPasswordResetEmail('user@example.com', 'https://reset.example/token');

      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
         to: 'user@example.com',
         subject: 'Reset your password',
         from: 'noreply@example.com'
      }));
   });

   it('logs the verification link when SMTP is not configured', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const { sendVerificationEmail } = loadEmailService({
         SMTP_HOST: '',
         SMTP_USER: '',
         SMTP_PASS: ''
      });

      await sendVerificationEmail('user@example.com', 'https://verify.example/token');

      expect(mockCreateTransport).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Email verification link'));
      consoleSpy.mockRestore();
   });

   it('sends a verification email through SMTP when configured', async () => {
      const { sendVerificationEmail } = loadEmailService();

      await sendVerificationEmail('user@example.com', 'https://verify.example/token');

      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
         to: 'user@example.com',
         subject: 'Verify your email',
         from: 'noreply@example.com'
      }));
   });
});
