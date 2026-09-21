import { MAX_UPLOAD_MB } from '@/lib/constants';

export interface FaqCategory {
  id: string;
  label: string;
  items: { q: string; a: string }[];
}

export const CONTACT = {
  whatsappNumber: '+65 8996 8765',
  whatsappHref: 'https://wa.me/6589968765',
  email: 'support@groovesheet.net',
};

export const FAQ_DATA: FaqCategory[] = [
  {
    id: 'getting-started',
    label: 'Getting started',
    items: [
      {
        q: 'How do I sign up or sign in?',
        a: 'Hit Sign In on the top right and pick Email, Google, Apple, or Facebook. We create your account on first sign-in \u2014 there is no separate sign-up step.',
      },
      {
        q: 'How do I split a track into stems?',
        a: 'Upload your file, then choose Stem Splitter in the workspace. We separate drums, bass, piano, and vocals so you can process each segment on its own.',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        q: 'How do I edit my profile?',
        a: 'Open the account menu in the top right and choose Profile. You can change your display name, avatar, and email there.',
      },
      {
        q: 'How do I manage connected accounts?',
        a: 'Under Account → Connected accounts you can link or unlink Google, Apple, and Facebook. Keep at least one sign-in method connected.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Account → Delete account. This permanently removes your uploads, scores, and minute balance \u2014 it cannot be undone.',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & minutes',
    items: [
      {
        q: 'What does a “minute” mean?',
        a: 'One billed minute equals one minute of your source track length, rounded up \u2014 regardless of how many instruments you export from it.',
      },
      {
        q: 'How are minutes deducted?',
        a: 'Minutes come off your balance only when a job completes successfully. Jobs that fail cost nothing.',
      },
      {
        q: 'Do minutes expire?',
        a: 'Monthly plan minutes reset each billing cycle and do not roll over. One-time top-up minutes never expire.',
      },
      {
        q: 'What happens if a job fails?',
        a: 'You are not charged any minutes. Retry from your history \u2014 re-encoding the source file usually fixes it.',
      },
      {
        q: 'How do I add more minutes?',
        a: 'Buy a one-time top-up from the Pricing page, or upgrade your plan for a higher monthly allowance.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Unused top-up minutes are refundable within 14 days. See the Refund Policy for the full terms.',
      },
      {
        q: 'How do I change or cancel my plan?',
        a: 'Account → Billing → Manage plan. Changes apply on your next cycle; cancel anytime and keep access until the period ends.',
      },
    ],
  },
  {
    id: 'uploads',
    label: 'Uploads & formats',
    items: [
      { q: 'What is the maximum file size?', a: `Up to ${MAX_UPLOAD_MB} MB per file.` },
      { q: 'Which audio formats can I upload?', a: 'MP3, WAV, FLAC, and OGG.' },
      {
        q: 'What output formats do I get?',
        a: 'Every completed transcription gives you PDF, MusicXML, and MIDI.',
      },
    ],
  },
  {
    id: 'quality',
    label: 'Transcription quality',
    items: [
      {
        q: 'How do I get the cleanest notation?',
        a: 'Use studio-quality recordings, isolate the instrument where you can, and pick the right kit mapping before processing.',
      },
      {
        q: 'Do live recordings work?',
        a: 'They can, but results vary \u2014 studio-quality recordings produce the best notation.',
      },
      {
        q: 'Can it handle odd meters or tempo changes?',
        a: 'Yes. We detect tempo maps and time signatures, including odd meters, though very fluid rubato is harder to track.',
      },
      {
        q: 'Which output format should I use?',
        a: 'MusicXML for editing in notation software, MIDI for DAWs, and PDF for reading or printing.',
      },
    ],
  },
  {
    id: 'publishing',
    label: 'Publishing & Explore',
    items: [
      {
        q: 'How do I publish a score?',
        a: 'Open a finished score and hit Publish to share it on Explore.',
      },
      {
        q: 'What do the visibility options mean?',
        a: 'Public appears on Explore and in search. Unlisted is reachable by link only. Private is visible to just you.',
      },
      {
        q: 'Who can download my published score?',
        a: 'You choose: allow downloads for everyone, for signed-in users only, or for no one.',
      },
      {
        q: 'How do I unpublish?',
        a: 'Open the score → Publishing → Unpublish. It is removed from Explore immediately.',
      },
      {
        q: 'What shows on my creator profile?',
        a: 'Your public scores (and unlisted ones opened via link), your display name, and your avatar.',
      },
    ],
  },
];
