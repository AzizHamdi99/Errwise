import { writeFileSync } from 'node:fs';
import { invitationEmail } from '../src/modules/invitations/emails/invitation-email';

const mail = invitationEmail({
  to: 'test@example.com',
  organizationName: 'ai errwise',
  inviterName: 'Aziz Hamdi',
  role: 'member',
  url: 'http://localhost:3000/invitations/accept?token=fake-token-for-preview-1234567890',
  ttlDays: 7,
});

writeFileSync('email-preview.html', mail.html);
console.log('Subject:', mail.subject);
console.log('Saved to email-preview.html');
