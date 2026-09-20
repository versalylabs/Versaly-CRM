export interface SmartReplySuggestion {
  id: string;
  label: string;
  text: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X';
}

/**
 * Standard library of canned responses.
 */
export const CANNED_RESPONSES = [
  {
    id: 'intro',
    title: 'Warm Discovery Introduction',
    content: `Hi {{name}}, thanks for reaching out to us! We'd love to learn more about your goals at {{company}} and see how Versaly CRM can streamline your sales pipeline. When would be a good time for a brief 15-minute introductory call?`,
  },
  {
    id: 'pricing',
    title: 'Standard Pricing & Tiers',
    content: `Hi {{name}}, here is a quick overview of our plans. Our Growth Pro plan includes unlimited pipeline tracking, automated outreach cadences, and AI deal intelligence. Let us know if you'd like a customized quote for {{company}}.`,
  },
  {
    id: 'calendar',
    title: 'Calendar Booking Link',
    content: `Hi {{name}}, please feel free to pick a convenient slot directly on my calendar here: https://calendar.versaly.io/sync. Excited to speak with you!`,
  },
  {
    id: 'followup',
    title: 'Gentle Value Follow-Up',
    content: `Hi {{name}}, wanted to follow up on our previous note. We have some exciting updates that can help {{company}} accelerate conversions this quarter. Are you available for a quick touchpoint this week?`,
  },
];

/**
 * Generates 3 intelligent, 1-click suggested replies based on recent conversation context.
 */
export function generateSmartReplySuggestions(lead: any, lastMessageText: string = ''): SmartReplySuggestion[] {
  const firstName = lead?.contactName?.split(' ')[0] || lead?.contactName || 'there';
  const company = lead?.companyName || 'your team';
  const lower = lastMessageText.toLowerCase();

  if (lower.includes('price') || lower.includes('cost') || lower.includes('quote') || lower.includes('discount')) {
    return [
      {
        id: 'pricing-1',
        label: 'Flexible Milestones',
        text: `Hi ${firstName}, thanks for asking! We offer flexible milestone-based payment schedules tailored for ${company}. Would a quick 10-minute overview call work for you this Thursday?`,
        channel: 'EMAIL',
      },
      {
        id: 'pricing-2',
        label: 'Send Formal Proposal',
        text: `Hi ${firstName}, I can prepare a custom commercial proposal breaking down exact deliverables and ROI for ${company}. What target go-live date are you aiming for?`,
        channel: 'EMAIL',
      },
      {
        id: 'pricing-3',
        label: 'WhatsApp Quick Sync',
        text: `Hey ${firstName}, happy to share pricing tiers that fit your budget. Are you free for a 5-min WhatsApp call today?`,
        channel: 'WHATSAPP',
      },
    ];
  }

  if (lower.includes('demo') || lower.includes('call') || lower.includes('meet') || lower.includes('available') || lower.includes('schedule')) {
    return [
      {
        id: 'demo-1',
        label: 'Share Calendar Link',
        text: `Hi ${firstName}, absolutely! You can grab any 20-minute slot on my calendar that suits you best: https://calendar.versaly.io/sync. Looking forward to our demo!`,
        channel: 'EMAIL',
      },
      {
        id: 'demo-2',
        label: 'Propose Tomorrow Times',
        text: `Hi ${firstName}, glad to connect! Does tomorrow at 11:00 AM or 3:00 PM work for an interactive walkthrough for ${company}?`,
        channel: 'EMAIL',
      },
      {
        id: 'demo-3',
        label: 'WhatsApp Confirmation',
        text: `Sounds great ${firstName}! I'll send over a calendar invite shortly. Who else from your team should join?`,
        channel: 'WHATSAPP',
      },
    ];
  }

  return [
    {
      id: 'default-1',
      label: 'Check-in & Next Steps',
      text: `Hi ${firstName}, following up on our recent sync regarding ${company}. Let me know if you have any questions or if you'd like to review next steps!`,
      channel: 'EMAIL',
    },
    {
      id: 'default-2',
      label: 'Share Case Study & ROI',
      text: `Hi ${firstName}, thought you might find this relevant—we recently helped a similar team in your space increase deal velocity by 40%. Would love to share the brief case study!`,
      channel: 'EMAIL',
    },
    {
      id: 'default-3',
      label: 'Casual Touchpoint',
      text: `Hey ${firstName}, hope you're having a productive week! Just checking in to see if you had a chance to review our notes.`,
      channel: 'WHATSAPP',
    },
  ];
}
